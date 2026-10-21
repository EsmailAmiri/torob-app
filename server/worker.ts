import { handleApi, json } from "./api";
import type { Sql, Runtime } from "./types";
interface Env extends Runtime {
  DB: D1Database;
  ASSETS: Fetcher;
}
export function d1Adapter(db: D1Database): Sql {
  return {
    async all(sql, params = []) {
      return (
        await db
          .prepare(sql)
          .bind(...params)
          .all()
      ).results;
    },
    async run(sql, params = []) {
      const r = await db
        .prepare(sql)
        .bind(...params)
        .run();
      return { changes: r.meta.changes };
    },
    async batch(statements) {
      await db.batch(
        statements.map((s) => db.prepare(s.sql).bind(...s.params)),
      );
    },
  };
}
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!env.DB) return json({ error: "دیتابیس هنوز متصل نشده است." }, 503);
    // Private Sites dispatch authenticates all traffic, including service access.
    // User-scoped sessions use its trusted identity header; service jobs stay separate.
    const owner =
      request.headers.get("oai-authenticated-user-id") || "owner-service";
    const readAsset = async (shard: string) => {
      const asset = new URL(
        shard === "shops"
          ? "/data/shops.json.gz"
          : `/data/products-${shard}.json.gz`,
        url,
      );
      const r = await env.ASSETS.fetch(new Request(asset));
      if (!r.ok) throw Error("Missing catalogue asset");
      const bytes = new Uint8Array(await r.arrayBuffer());
      return bytes[0] === 31 && bytes[1] === 139
        ? new Response(
            new Blob([bytes])
              .stream()
              .pipeThrough(new DecompressionStream("gzip")),
          ).json()
        : JSON.parse(new TextDecoder().decode(bytes));
    };
    return handleApi(request, {
      db: d1Adapter(env.DB),
      env,
      owner,
      importAsset: readAsset,
      loadDetail: async (id) => (await readAsset(id.slice(-2)))[id],
    });
  },
} satisfies ExportedHandler<Env>;
