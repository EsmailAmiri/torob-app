import test from "node:test";
import assert from "node:assert/strict";
import worker from "../server/worker";
test("Catalogue object upload validates checksum and serves identical bytes", async () => {
  const objects = new Map<string, any>();
  const DB = {
    prepare: () => ({
      bind() {
        return this;
      },
      async all() {
        return { results: [] };
      },
    }),
  };
  const BUCKET = {
    async head(name: string) {
      return objects.get(name) || null;
    },
    async put(name: string, bytes: ArrayBuffer, options: any) {
      objects.set(name, {
        body: new Uint8Array(bytes),
        httpEtag: '"test-etag"',
        customMetadata: options.customMetadata,
      });
    },
    async get(name: string) {
      return objects.get(name) || null;
    },
  };
  const env = { DB, BUCKET, CATALOG_IMPORT_ENABLED: "true" } as any;
  const bytes = new Uint8Array([31, 139, 8, 0]);
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  const upload = (checksum: string) =>
    new Request("https://site.example/api/admin/assets?name=shops.json.gz", {
      method: "POST",
      headers: { "X-Content-Sha256": checksum },
      body: bytes,
    });
  const wrong = await worker.fetch(upload("0".repeat(64)), env);
  assert.equal(wrong.status, 400);
  const good = await worker.fetch(upload(hash), env);
  assert.equal(good.status, 200);
  assert.equal(objects.size, 1);
  const served = await worker.fetch(
    new Request("https://site.example/data/shops.json.gz"),
    env,
  );
  assert.deepEqual(new Uint8Array(await served.arrayBuffer()), bytes);
  assert.equal(served.headers.get("content-encoding"), null);
  const missing = await worker.fetch(
    new Request("https://site.example/data/products-00.json.gz"),
    env,
  );
  assert.equal(missing.status, 503);
  const disabled = await worker.fetch(upload(hash), {
    ...env,
    CATALOG_IMPORT_ENABLED: "false",
  });
  assert.equal(disabled.status, 403);
});
