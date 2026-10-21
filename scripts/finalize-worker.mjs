import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  existsSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
const path = resolve("dist/server/wrangler.json");
const config = JSON.parse(readFileSync(path, "utf8"));
const main = resolve(dirname(path), config.main);
if (main !== resolve("dist/server/index.js"))
  copyFileSync(main, "dist/server/index.js");
config.main = "index.js";
writeFileSync(path, JSON.stringify(config, null, 2));
// Hosted catalogue blobs live in R2. Keep local source and Node builds intact.
for (const directory of ["dist/client/data", "dist/data"]) {
  const data = resolve(directory);
  if (existsSync(data))
    for (const name of readdirSync(data))
      if (/^(products-[a-f0-9]{2}|shops|search)\.json\.gz$/.test(name))
        unlinkSync(resolve(data, name));
}
if (!existsSync("dist/.openai/hosting.json"))
  throw Error("Sites hosting metadata is missing");
