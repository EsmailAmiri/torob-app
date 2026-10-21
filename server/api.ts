import { z, ZodError } from "zod";
import { Repository, NotFound, BusyError, productId } from "./repository";
import { contextSchema } from "./tools";
import { runAgent, PendingTurnError } from "./agent";
import type { Runtime, Sql } from "./types";
import { modelConfig } from "./model";
const uuid = z.string().uuid();
export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const chatSchema = z.object({
  threadId: uuid,
  requestId: uuid,
  message: z.string().trim().min(1).max(4000),
  context: contextSchema,
});
async function body(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return {};
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 65536) {
      await reader.cancel();
      throw new ZodError([
        { code: "custom", message: "Request too large", path: [] },
      ]);
    }
    chunks.push(value);
  }
  const raw = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    raw.set(chunk, at);
    at += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new ZodError([{ code: "custom", message: "Invalid JSON", path: [] }]);
  }
}
export async function handleApi(
  request: Request,
  options: {
    db: Sql;
    env: Runtime;
    owner: string;
    importAsset?: (shard: string) => Promise<any>;
    loadDetail?: (id: string) => Promise<any>;
  },
) {
  const url = new URL(request.url),
    { env, owner } = options;
  const repo = new Repository(options.db, options.loadDetail);
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      if (
        request.headers.get("origin") &&
        request.headers.get("origin") !== url.origin
      )
        return json({ error: "درخواست از مبدأ مجاز ارسال نشده است." }, 403);
      if (request.headers.get("sec-fetch-site") === "cross-site")
        return json({ error: "مبدأ درخواست مجاز نیست." }, 403);
      if (!request.headers.get("content-type")?.includes("application/json"))
        return json({ error: "بدنه درخواست باید JSON باشد." }, 415);
    }
    if (url.pathname === "/api/health" && request.method === "GET") {
      const catalogue = await repo.ready(),
        model = modelConfig(env);
      return json({
        ok: true,
        catalogue,
        catalogueReady: catalogue.shards === 256 && catalogue.shops === 6476,
        assistant: {
          provider: model.configured ? model.provider : "local",
          model: model.configured ? model.model : null,
          configured: model.configured,
        },
        inquiryMode: "simulation",
      });
    }
    if (url.pathname === "/api/products" && request.method === "GET") {
      const args = {
        query: url.searchParams.get("query") ?? "",
        brand: url.searchParams.get("brand") ?? "",
        budget: url.searchParams.has("budget")
          ? Number(url.searchParams.get("budget"))
          : undefined,
        sort: url.searchParams.get("sort") ?? "recommended",
        limit: Number(url.searchParams.get("limit") ?? 60),
        offset: Number(url.searchParams.get("offset") ?? 0),
      };
      return json(await repo.search(args));
    }
    const productMatch = url.pathname.match(
      /^\/api\/products\/(product_[a-f0-9]{24})$/,
    );
    if (productMatch && request.method === "GET")
      return json(await repo.product(productMatch[1]));
    if (url.pathname === "/api/compare" && request.method === "POST") {
      const data = z
        .object({ productIds: z.array(productId).min(2).max(3) })
        .parse(await body(request));
      return json({ products: await repo.compare(data.productIds) });
    }
    if (url.pathname === "/api/sellers" && request.method === "POST") {
      const { productId: id, ...context } = contextSchema
        .extend({ productId })
        .parse(await body(request));
      return json(
        await repo.sellers({
          ...context,
          productId: id,
          sort: context.sort === "price" ? "price" : "distance",
        }),
      );
    }
    if (url.pathname === "/api/chat" && request.method === "POST") {
      const input = chatSchema.parse(await body(request));
      const window = Math.floor(Date.now() / 60000);
      await options.db.run(
        "INSERT INTO rate_limits(owner,window,count) VALUES(?,?,1) ON CONFLICT(owner) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window",
        [owner, window],
      );
      const [limit] = await options.db.all(
        "SELECT count FROM rate_limits WHERE owner=?",
        [owner],
      );
      if (limit.count > 20)
        return json(
          {
            error:
              "تعداد پیام‌ها در این دقیقه زیاد است. کمی بعد دوباره تلاش کنید.",
          },
          429,
        );
      return json(await runAgent({ ...input, repo, env, owner }));
    }
    const threadMatch = url.pathname.match(/^\/api\/chat\/([a-f0-9-]{36})$/);
    if (threadMatch && request.method === "GET") {
      uuid.parse(threadMatch[1]);
      const state = await repo.loadSession(owner, threadMatch[1]);
      const messages = state.history.flat().flatMap((item: any) => {
        if (item.role === "user") return [{ role: "user", text: item.content }];
        if (item.type === "message")
          return [
            {
              role: "assistant",
              text: item.content
                ?.filter((c: any) => c.type === "output_text")
                .map((c: any) => c.text)
                .join("\n"),
            },
          ];
        if (item.role === "assistant" && typeof item.content === "string")
          return [{ role: "assistant", text: item.content }];
        return [];
      });
      return json({
        messages,
        context: state.context,
        pending: !!state.pending,
      });
    }
    if (url.pathname === "/api/inquiries" && request.method === "POST") {
      const data = z
        .object({
          threadId: uuid,
          productId,
          offerId: z.string().regex(/^offer_[a-f0-9]{24}$/),
          requestId: uuid,
        })
        .parse(await body(request));
      return json(
        await repo.inquiry(
          owner,
          data.threadId,
          data.productId,
          data.offerId,
          data.requestId,
        ),
        201,
      );
    }
    const inquiryMatch = url.pathname.match(
      /^\/api\/inquiries\/([a-f0-9-]{36})\/simulate$/,
    );
    if (inquiryMatch && request.method === "POST") {
      uuid.parse(inquiryMatch[1]);
      const data = z
        .object({
          status: z.enum([
            "available_demo",
            "unavailable_demo",
            "noanswer_demo",
          ]),
        })
        .parse(await body(request));
      return json(await repo.simulate(owner, inquiryMatch[1], data.status));
    }
    if (url.pathname === "/api/admin/import" && request.method === "POST") {
      if (env.CATALOG_IMPORT_ENABLED !== "true" || !options.importAsset)
        return json({ error: "ورود داده غیرفعال است." }, 403);
      const ready = await repo.ready();
      if (ready.shards === 256 && ready.shops === 6476)
        return json({ complete: true, ...ready });
      const data = z
        .object({ shard: z.string().regex(/^(shops|[a-f0-9]{2})$/) })
        .parse(await body(request));
      const raw = await options.importAsset(data.shard);
      return json(
        data.shard === "shops"
          ? await repo.importShops(raw)
          : await repo.importProducts(data.shard, raw),
      );
    }
    return json({ error: "مسیر API پیدا نشد." }, 404);
  } catch (e) {
    if (e instanceof ZodError)
      return json({ error: "پارامترهای درخواست معتبر نیستند." }, 400);
    if (e instanceof NotFound) return json({ error: e.message }, 404);
    if (e instanceof BusyError || e instanceof PendingTurnError)
      return json({ error: e.message }, 409);
    // Never return provider errors, request headers, secrets or stack traces to the client.
    console.error("API request failed", {
      path: url.pathname,
      type: e instanceof Error ? e.name : "UnknownError",
    });
    return json(
      {
        error:
          url.pathname === "/api/chat"
            ? "پاسخ مدل دریافت نشد. اتصال و تنظیمات مدل را بررسی کنید و همان پیام را دوباره تلاش کنید."
            : "دریافت اطلاعات با خطا مواجه شد.",
      },
      503,
    );
  }
}
