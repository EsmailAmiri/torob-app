import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
const path = resolve("dist/server/wrangler.json");
const config = JSON.parse(readFileSync(path, "utf8"));
const main = resolve(dirname(path), config.main);
if (main !== resolve("dist/server/index.js"))
  copyFileSync(main, "dist/server/index.js");
config.main = "index.js";
writeFileSync(path, JSON.stringify(config, null, 2));
if (!existsSync("dist/.openai/hosting.json"))
  throw Error("Sites hosting metadata is missing");
