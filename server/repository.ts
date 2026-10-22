import { z } from "zod";
import {
  normalize,
  places,
  distance,
  hoursStatus,
  hasInPersonCredit,
  inferCategory,
} from "../src/catalogue.js";
import type { Sql, Product, StoredSession, SearchContext } from "./types";
import shopLinks from "../src/shop-links.json";
export const productId = z.string().regex(/^product_[a-f0-9]{24}$/);
export const shopId = z.string().regex(/^shop_[a-f0-9]{24}$/);
export const searchSchema = z.object({
  query: z.string().trim().max(160).default(""),
  budget: z.number().finite().positive().max(1e13).nullable().optional(),
  brand: z.string().max(80).optional(),
  category: z.string().max(160).optional(),
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
    const category = args.category || inferCategory(args.query);
    if (category) {
      conditions.push("p.category = ?");
      params.push(category);
    }
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
    return {
      ...JSON.parse(rows[0].data),
      ...(shopLinks as Record<string, any>)[id],
    };
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
    budget?: number | null;
    position?: [number, number] | null;
    excludeShopId?: string;
    excludedShopIds?: string[];
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
      input.position ||
      places[input.place as keyof typeof places] ||
      places["مرکز تهران"];
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
          paymentChannelDeclared: hasInPersonCredit(shop),
          paymentChannelVerified: false,
        },
      ];
    });
    rows = rows.filter(
      (o) =>
        o.shop.shop_id !== input.excludeShopId &&
        !input.excludedShopIds?.includes(o.shop.shop_id) &&
        (input.budget == null ||
          (o.price != null && o.price <= input.budget)) &&
        o.distance != null &&
        o.distance <= (input.radius ?? 30) &&
        (!input.installment || hasInPersonCredit(o.shop)) &&
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
      registeredOfferCount: offers.length,
      filters: {
        place: input.place,
        radius: input.radius,
        budget: input.budget,
        installment: input.installment,
        onlyOpen: input.onlyOpen,
      },
      offers: rows.slice(0, input.limit ?? 20),
      note: "نتیجه صفر فقط یعنی با فیلترهای فعلی آفر مطابق نیست، نه اینکه محصول هیچ فروشنده‌ای ندارد. کانال حضوری صرفاً اعلام‌شده است، نه تأییدشده. فاصله مستقیم است؛ آفر و ساعت کاری ثبت‌شده تأیید موجودی یا قیمت امروز نیست.",
    };
  }
  async alternatives(
    id: string,
    budget?: number | null,
    excludeShopId?: string,
    context: {
      place?: string;
      radius?: number;
      installment?: boolean;
      onlyOpen?: boolean;
      position?: [number, number] | null;
      brand?: string;
      excludedShopIds?: string[];
    } = {},
  ) {
    const p = await this.product(id);
    const related = await this.search({
      query: "",
      category: p.category,
      brand: context.brand || p.brand || "",
      budget,
      limit: 60,
    });
    related.products.sort(
      (a, b) =>
        Math.abs((a.price ?? Infinity) - (p.price || 0)) -
        Math.abs((b.price ?? Infinity) - (p.price || 0)),
    );
    const same = await this.sellers({
      ...context,
      productId: id,
      budget,
      excludeShopId,
      limit: 30,
    });
    return {
      sameProductSellers: same.offers
        .filter((o) => o.shop.shop_id !== excludeShopId)
        .slice(0, 8),
      products: related.products.filter((x) => x.id !== id).slice(0, 8),
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
    if (!/^[a-f0-9-]{36}$/i.test(id)) {
      const bytes = new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(owner + ":" + thread + ":" + id),
        ),
      );
      bytes[6] = (bytes[6] & 15) | 64;
      bytes[8] = (bytes[8] & 63) | 128;
      const hex = Array.from(bytes.slice(0, 16), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      id = [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20),
      ].join("-");
    }
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
  async simulate(
    owner: string,
    id: string,
    status: string,
    context?: SearchContext,
  ) {
    const [inquiry] = await this.db.all(
      "SELECT * FROM inquiries WHERE owner=? AND id=?",
      [owner, id],
    );
    if (!inquiry) throw new NotFound("استعلام پیدا نشد.");
    const product = await this.product(inquiry.product_id);
    const offer = product.offers?.find((o) => o.id === inquiry.offer_id);
    const shop = await this.shop(offer.shop);
    const r = await this.db.run(
      "UPDATE inquiries SET status=?,updated=? WHERE owner=? AND id=?",
      [status, Date.now(), owner, id],
    );
    if (!r.changes) throw new NotFound("استعلام پیدا نشد.");
    await this.lock(owner, inquiry.thread);
    try {
      const session = await this.loadSession(owner, inquiry.thread);
      if (context)
        session.context = {
          ...context,
          excludedShopIds: session.context?.excludedShopIds || [],
        };
      if (status !== "available_demo")
        session.context = {
          query: "",
          budget: null,
          brand: "",
          place: "مرکز تهران",
          radius: 30,
          installment: false,
          onlyOpen: false,
          sort: "recommended",
          selectedId: product.id,
          compareIds: [],
          ...session.context,
          excludedShopIds: [
            ...new Set([
              ...(session.context?.excludedShopIds || []),
              shop.shop_id,
            ]),
          ].slice(-30),
        };
      const alternatives =
        status === "available_demo"
          ? null
          : await this.alternatives(
              product.id,
              session.context?.budget,
              shop.shop_id,
              session.context,
            );
      const message =
        status === "available_demo"
          ? "پاسخ فرضی فروشنده: موجود است. قیمت و ساعت زیر از دیتاست‌اند؛ این پاسخ تأیید واقعی نیست."
          : status === "noanswer_demo"
            ? "در سناریوی آزمایشی فروشنده پاسخ نداد. گزینه‌های جایگزین با حفظ شرایط خرید بررسی شدند."
            : "در سناریوی آزمایشی کالا ناموجود است. گزینه‌های جایگزین با حفظ شرایط خرید بررسی شدند.";
      const demoResponse = {
        label: "پاسخ فرضی؛ بدون تماس واقعی",
        price: offer.price,
        changed: offer.changed,
        hours: shop.weekly_hours || null,
        availability:
          status === "available_demo" ? "available_demo" : "unknown",
        source: "dataset_and_user_simulation",
      };
      const actions: any[] = [
        {
          type: "inquiry",
          inquiry: {
            id,
            status,
            productId: product.id,
            offerId: offer.id,
            productTitle: product.title,
            shop,
            mode: "simulation",
            inventory: "unverified",
            demoResponse,
          },
        },
      ];
      if (alternatives)
        actions.push(
          { type: "sellers", offers: alternatives.sameProductSellers },
          { type: "results", products: alternatives.products },
        );
      if (inquiry.status !== status) {
        session.history = [
          ...session.history.slice(-5),
          [
            {
              role: "user",
              content: `نتیجه شبیه‌سازی استعلام فروشگاه ${shop.name}: ${status === "available_demo" ? "موجود است" : status === "noanswer_demo" ? "عدم پاسخ" : "ناموجود"}`,
            },
            { role: "assistant", content: message, ui_actions: actions },
          ],
        ];
        await this.saveSession(owner, inquiry.thread, session);
      }
      return {
        id,
        status,
        mode: "simulation",
        inventory: "unverified",
        message,
        demoResponse,
        actions,
      };
    } finally {
      await this.unlock(owner, inquiry.thread);
    }
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
