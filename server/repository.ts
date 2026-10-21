import { z } from "zod";
import { normalize, places, distance, hoursStatus } from "../src/catalogue.js";
import type { Sql, Product, StoredSession } from "./types";
export const productId = z.string().regex(/^product_[a-f0-9]{24}$/);
export const shopId = z.string().regex(/^shop_[a-f0-9]{24}$/);
export const searchSchema = z.object({
  query: z.string().trim().max(160).default(""),
  budget: z.number().finite().positive().max(1e13).nullable().optional(),
  brand: z.string().max(80).optional(),
  sort: z.enum(["recommended", "price"]).default("recommended"),
  limit: z.number().int().min(1).max(60).default(20),
  offset: z.number().int().min(0).max(10000).default(0),
});
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");
export class Repository {
  constructor(
    public db: Sql,
    private loadDetail?: (id: string) => Promise<Product>,
  ) {}
  async ready() {
    const rows = await this.db.all("SELECT id,count FROM catalogue_imports");
    return {
      products: rows
        .filter((r) => r.id !== "shops")
        .reduce((sum, r) => sum + r.count, 0),
      shops: rows.find((r) => r.id === "shops")?.count ?? 0,
      shards: rows.filter((r) => r.id !== "shops").length,
    };
  }
  async search(input: unknown) {
    const args = searchSchema.parse(input);
    const terms = normalize(args.query).match(/[\p{L}\p{N}]+/gu) || [];
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (terms.length) {
      conditions.push(
        "p.rowid IN (SELECT rowid FROM product_search WHERE product_search MATCH ?)",
      );
      params.push(terms.map((t: string) => '"' + t + '"*').join(" AND "));
    }
    if (args.budget != null) {
      conditions.push("p.price IS NOT NULL AND p.price <= ?");
      params.push(args.budget);
    }
    if (args.brand) {
      conditions.push("p.search LIKE ? ESCAPE '\\'");
      params.push("%" + escapeLike(normalize(args.brand)) + "%");
    }
    const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
    const [count, rows] = await Promise.all([
      this.db.all("SELECT count(*) total FROM products p" + where, params),
      this.db.all(
        "SELECT summary FROM products p" +
          where +
          " ORDER BY " +
          (args.sort === "price"
            ? "(p.price IS NULL),p.price ASC,p.id"
            : "p.offer_count DESC,(p.price IS NULL),p.id") +
          " LIMIT ? OFFSET ?",
        [...params, args.limit, args.offset],
      ),
    ]);
    return {
      total: count[0]?.total || 0,
      products: rows.map((r) => JSON.parse(r.summary)) as Product[],
    };
  }
  async product(id: string): Promise<Product> {
    productId.parse(id);
    const rows = await this.db.all("SELECT detail FROM products WHERE id=?", [
      id,
    ]);
    if (!rows.length) throw new NotFound("محصول در دیتاست پیدا نشد.");
    return this.loadDetail ? this.loadDetail(id) : JSON.parse(rows[0].detail);
  }
  async shop(id: string) {
    shopId.parse(id);
    const rows = await this.db.all("SELECT data FROM shops WHERE id=?", [id]);
    if (!rows.length) throw new NotFound("فروشگاه در دیتاست پیدا نشد.");
    return JSON.parse(rows[0].data);
  }
  async compare(ids: string[]) {
    z.array(productId).min(2).max(3).parse(ids);
    return Promise.all([...new Set(ids)].map((id) => this.product(id)));
  }
  async sellers(input: {
    productId: string;
    place?: string;
    radius?: number;
    installment?: boolean;
    onlyOpen?: boolean;
    sort?: "price" | "distance";
    limit?: number;
  }) {
    const p = await this.product(input.productId);
    const offers = p.offers || [];
    const ids = [...new Set(offers.map((o) => o.shop))];
    let shops: any[] = [];
    for (let i = 0; i < ids.length; i += 80)
      shops.push(
        ...(await this.db.all(
          "SELECT id,data FROM shops WHERE id IN (" +
            ids
              .slice(i, i + 80)
              .map(() => "?")
              .join(",") +
            ")",
          ids.slice(i, i + 80),
        )),
      );
    const byId = new Map(shops.map((r) => [r.id, JSON.parse(r.data)]));
    const center =
      places[input.place as keyof typeof places] || places["مرکز تهران"];
    let rows = offers.flatMap((o) => {
      const shop = byId.get(o.shop);
      if (!shop) return [];
      const km = distance(center, [shop.lat, shop.lon]);
      const hours = hoursStatus(shop);
      return [
        {
          ...o,
          shop,
          distance: km,
          hours,
          inventory: "unverified",
          paymentChannelVerified: false,
        },
      ];
    });
    rows = rows.filter(
      (o) =>
        (o.distance == null || o.distance <= (input.radius ?? 30)) &&
        (!input.installment || o.shop.payment_options?.length > 0) &&
        (!input.onlyOpen || o.hours.state === "open"),
    );
    rows.sort(
      input.sort === "price"
        ? (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)
        : (a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity),
    );
    return {
      product: { id: p.id, title: p.title },
      total: rows.length,
      offers: rows.slice(0, input.limit ?? 20),
      note: "فاصله مستقیم است؛ آفر و ساعت کاری ثبت‌شده تأیید موجودی یا قیمت امروز نیست.",
    };
  }
  async alternatives(
    id: string,
    budget?: number | null,
    excludeShopId?: string,
  ) {
    const p = await this.product(id);
    const related = await this.search({ query: p.category, budget, limit: 8 });
    const same = await this.sellers({ productId: id, limit: 30 });
    return {
      sameProductSellers: same.offers
        .filter((o) => o.shop.shop_id !== excludeShopId)
        .slice(0, 8),
      products: related.products.filter((x) => x.id !== id),
      note: "موجودی هیچ گزینه‌ای تأیید نشده است.",
    };
  }
  async loadSession(owner: string, id: string): Promise<StoredSession> {
    const rows = await this.db.all(
      "SELECT state FROM sessions WHERE owner=? AND id=?",
      [owner, id],
    );
    return rows.length ? JSON.parse(rows[0].state) : { history: [] };
  }
  async saveSession(owner: string, id: string, state: StoredSession) {
    await this.db.run(
      "UPDATE sessions SET state=?,updated=? WHERE owner=? AND id=?",
      [JSON.stringify(state), Date.now(), owner, id],
    );
  }
  async lock(owner: string, id: string) {
    const now = Date.now();
    await this.db.run(
      "INSERT INTO sessions(owner,id,state,updated,locked_until) VALUES(?,?,?, ?,0) ON CONFLICT(owner,id) DO NOTHING",
      [owner, id, JSON.stringify({ history: [] }), now],
    );
    const r = await this.db.run(
      "UPDATE sessions SET locked_until=? WHERE owner=? AND id=? AND locked_until<?",
      [now + 240000, owner, id, now],
    );
    if (!r.changes) throw new BusyError("درخواست قبلی هنوز در حال پردازش است.");
  }
  async unlock(owner: string, id: string) {
    await this.db.run(
      "UPDATE sessions SET locked_until=0 WHERE owner=? AND id=?",
      [owner, id],
    );
  }
  async inquiry(
    owner: string,
    thread: string,
    product: string,
    offerId: string,
    id: string,
  ) {
    const p = await this.product(product);
    const offer = p.offers?.find((o) => o.id === offerId);
    if (!offer) throw new NotFound("آفر مربوط به این محصول پیدا نشد.");
    await this.db.run(
      "INSERT INTO inquiries(owner,id,thread,product_id,offer_id,status,updated) VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner,id) DO NOTHING",
      [owner, id, thread, product, offerId, "not_contacted", Date.now()],
    );
    return {
      id,
      productId: product,
      offerId,
      status: "not_contacted",
      mode: "simulation",
      inventory: "unverified",
      message:
        "شماره‌های دیتاست جعلی‌اند. هیچ تماس یا پیامی ارسال نشده؛ پاسخ فقط با انتخاب صریح سناریوی آزمایشی ثبت می‌شود.",
    };
  }
  async simulate(owner: string, id: string, status: string) {
    const r = await this.db.run(
      "UPDATE inquiries SET status=?,updated=? WHERE owner=? AND id=?",
      [status, Date.now(), owner, id],
    );
    if (!r.changes) throw new NotFound("استعلام پیدا نشد.");
    return { id, status, mode: "simulation", inventory: "unverified" };
  }
  async importProducts(key: string, products: Record<string, Product>) {
    const statements = Object.values(products).map((p) => {
      const { specs, offers, ...summary } = p;
      return {
        sql: "INSERT INTO products(id,title,category,brand,price,offer_count,search,summary,detail) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,brand=excluded.brand,price=excluded.price,offer_count=excluded.offer_count,search=excluded.search,summary=excluded.summary,detail=excluded.detail",
        params: [
          p.id,
          p.title,
          p.category,
          p.brand,
          p.price,
          p.count,
          normalize(p.title + " " + p.category + " " + (p.brand || "")),
          JSON.stringify(summary),
          JSON.stringify(this.loadDetail ? summary : p),
        ],
      };
    });
    for (let i = 0; i < statements.length; i += 30)
      await this.db.batch(statements.slice(i, i + 30));
    await this.db.run(
      "INSERT INTO catalogue_imports(id,count,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET count=excluded.count,updated=excluded.updated",
      [key, statements.length, Date.now()],
    );
    return { shard: key, count: statements.length };
  }
  async importShops(shops: Record<string, any>) {
    const statements = Object.entries(shops).map(([id, data]) => ({
      sql: "INSERT INTO shops(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      params: [id, JSON.stringify(data)],
    }));
    for (let i = 0; i < statements.length; i += 50)
      await this.db.batch(statements.slice(i, i + 50));
    await this.db.run(
      "INSERT INTO catalogue_imports(id,count,updated) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET count=excluded.count,updated=excluded.updated",
      ["shops", statements.length, Date.now()],
    );
    return { shard: "shops", count: statements.length };
  }
}
export class NotFound extends Error {}
export class BusyError extends Error {}
