// Owner-private Sites bootstrap. Supply the service token through hidden stdin only.
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
let request = "";
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stderr.write("Ready for import JSON on stdin (input is hidden).\n");
}
process.stdin.setEncoding("utf8");
const input = await new Promise((resolve, reject) => {
  process.stdin.on("data", (chunk) => {
    request += chunk;
    if (request.includes("\u0003")) reject(Error("Cancelled"));
    if (request.length > 16384) reject(Error("Input too large"));
    if (/[\r\n]/.test(request)) resolve(request.trim());
  });
});
if (process.stdin.isTTY) process.stdin.setRawMode(false);
process.stdin.pause();
const { url, token } = JSON.parse(input);
const origin = new URL(url);
if (origin.protocol !== "https:" || !token)
  throw Error("Expected the private Site URL and its service token.");
const headers = {
  "OAI-Sites-Authorization": "Bearer " + token,
  "Content-Type": "application/json",
};
async function call(path, body) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(new URL(path, origin), {
        method: body ? "POST" : "GET",
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(120000),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || `HTTP ${r.status}`);
      return data;
    } catch (e) {
      last = e;
      if (attempt < 3)
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw last;
}
let health = await call("/api/health");
if (!health.catalogueReady) {
  const files = (await readdir("public/data")).filter((name) =>
    /^(products-[a-f0-9]{2}|shops|search)\.json\.gz$/.test(name),
  );
  let assetNext = 0,
    assetDone = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (assetNext < files.length) {
        const name = files[assetNext++];
        const bytes = await readFile("public/data/" + name);
        const hash = createHash("sha256").update(bytes).digest("hex");
        let success = false;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const r = await fetch(
              new URL(
                "/api/admin/assets?name=" + encodeURIComponent(name),
                origin,
              ),
              {
                method: "POST",
                headers: {
                  "OAI-Sites-Authorization": "Bearer " + token,
                  "Content-Type": "application/octet-stream",
                  "X-Content-Sha256": hash,
                },
                body: bytes,
                signal: AbortSignal.timeout(180000),
              },
            );
            const result = await r.json();
            if (!r.ok) throw Error(result.error || "Asset upload failed");
            success = true;
            break;
          } catch (e) {
            if (attempt === 3) throw e;
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
        if (!success) throw Error("Asset upload incomplete");
        assetDone++;
        if (assetDone % 16 === 0 || assetDone === files.length)
          console.log(
            `Uploaded ${assetDone}/${files.length} catalogue objects`,
          );
      }
    }),
  );
  await call("/api/admin/import", { shard: "shops" });
  console.log("Shops imported");
  const shards = Array.from({ length: 256 }, (_, i) =>
    i.toString(16).padStart(2, "0"),
  );
  let next = 0,
    done = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (next < shards.length) {
        const shard = shards[next++];
        await call("/api/admin/import", { shard });
        done++;
        if (done % 16 === 0 || done === 256)
          console.log(`Imported ${done}/256 shards`);
      }
    }),
  );
  health = await call("/api/health");
}
if (!health.catalogueReady)
  throw Error("Catalogue did not reach the expected row counts.");
console.log(
  JSON.stringify({
    complete: true,
    catalogue: health.catalogue,
    assistantConfigured: health.assistant.configured,
  }),
);
