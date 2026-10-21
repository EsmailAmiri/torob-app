import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { handleApi, json } from "./api";
import { sqliteAdapter } from "./sqlite";
import { modelConfig } from "./model";
const db = new DatabaseSync(
  process.env.DATABASE_PATH || "runtime/torob.sqlite",
);
db.exec("PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;");
const sql = sqliteAdapter(db);
const root = resolve("dist/client");
const host = process.env.HOST || "127.0.0.1",
  port = Number(process.env.PORT || 8787);
if (
  !["127.0.0.1", "localhost", "::1"].includes(host) &&
  !process.env.APP_ACCESS_TOKEN
)
  throw Error(
    "Set APP_ACCESS_TOKEN or use an authenticated reverse proxy before exposing the API. Default HOST=127.0.0.1 is supported without a token.",
  );
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".gz": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};
const server = createServer(async (req, res) => {
  try {
    const authority = req.headers.host || `127.0.0.1:${port}`;
    const url = new URL(req.url || "/", `http://${authority}`);
    let response: Response;
    if (url.pathname.startsWith("/api/")) {
      if (
        process.env.APP_ACCESS_TOKEN &&
        req.headers.authorization !== `Bearer ${process.env.APP_ACCESS_TOKEN}`
      ) {
        response = json({ error: "دسترسی مجاز نیست." }, 401);
      } else {
        const chunks: Buffer[] = [];
        let length = 0;
        for await (const c of req) {
          length += c.length;
          if (length > 65536) {
            res.writeHead(413);
            res.end();
            return;
          }
          chunks.push(c);
        }
        const request = new Request(url, {
          method: req.method,
          headers: req.headers as any,
          body: ["GET", "HEAD"].includes(req.method || "GET")
            ? undefined
            : Buffer.concat(chunks),
        });
        response = await handleApi(request, {
          db: sql,
          env: process.env,
          owner: "local-owner",
        });
      }
    } else {
      let filename = resolve(root, "." + decodeURIComponent(url.pathname));
      if (filename !== root && !filename.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      try {
        if (!(await stat(filename)).isFile())
          filename = resolve(root, "index.html");
      } catch {
        filename = resolve(root, "index.html");
      }
      const content = await readFile(filename);
      response = new Response(content, {
        headers: {
          "Content-Type": mime[extname(filename)] || "application/octet-stream",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Server request failed" }));
  }
});
server.listen(port, host, () =>
  console.log(
    `Torob API ready: http://${host}:${port} · ${modelConfig(process.env).configured ? "LLM configured" : "local assistant (no API key)"}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
