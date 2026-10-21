import { handleApi, json } from "./api";
import { Repository } from "./repository";
import type { Sql, Runtime } from "./types";
interface Env extends Runtime {
  DB: D1Database;
  ASSETS: Fetcher;
  BUCKET: R2Bucket;
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
    const dataMatch = url.pathname.match(
      /^\/data\/((?:products-[a-f0-9]{2}|shops|search)\.json\.gz)$/,
    );
    if (dataMatch && request.method === "GET") {
      const object = await env.BUCKET?.get(dataMatch[1]);
      if (!object)
        return json({ error: "فایل کاتالوگ هنوز وارد نشده است." }, 503);
      if (request.headers.get("if-none-match") === object.httpEtag)
        return new Response(null, { status: 304 });
      return new Response(object.body, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Cache-Control": "private, max-age=3600",
          ETag: object.httpEtag,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!env.DB) return json({ error: "دیتابیس هنوز متصل نشده است." }, 503);
    if (url.pathname === "/api/admin/assets" && request.method === "POST") {
      if (env.CATALOG_IMPORT_ENABLED !== "true" || !env.BUCKET)
        return json({ error: "ورود داده غیرفعال است." }, 403);
      if (
        request.headers.get("origin") &&
        request.headers.get("origin") !== url.origin
      )
        return json({ error: "مبدأ درخواست مجاز نیست." }, 403);
      const name = url.searchParams.get("name") || "";
      const hash = request.headers.get("x-content-sha256") || "";
      if (
        !/^(products-[a-f0-9]{2}|shops|search)\.json\.gz$/.test(name) ||
        !/^[a-f0-9]{64}$/.test(hash)
      )
        return json({ error: "نام فایل یا checksum معتبر نیست." }, 400);
      const ready = await new Repository(d1Adapter(env.DB)).ready();
      if (ready.shards === 256 && ready.shops === 6476)
        return json({ complete: true });
      const existing = await env.BUCKET.head(name);
      if (existing?.customMetadata?.sha256 === hash)
        return json({ name, skipped: true });
      if (Number(request.headers.get("content-length")) > 20 * 1024 * 1024)
        return json({ error: "فایل بزرگ است." }, 413);
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > 20 * 1024 * 1024)
        return json({ error: "فایل بزرگ است." }, 413);
      const actual = Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      if (actual !== hash)
        return json({ error: "checksum فایل تطبیق ندارد." }, 400);
      await env.BUCKET.put(name, bytes, {
        customMetadata: { sha256: hash },
        httpMetadata: { contentType: "application/octet-stream" },
      });
      return json({ name, bytes: bytes.byteLength });
    }
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
      const object = await env.BUCKET.get(asset.pathname.split("/").at(-1)!);
      if (!object) throw Error("Missing catalogue object");
      const bytes = new Uint8Array(await object.arrayBuffer());
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
