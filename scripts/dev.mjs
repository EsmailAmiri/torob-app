import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
const children = [];
function run(args) {
  const p = spawn(process.execPath, args, {
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(p);
  p.on("exit", (code) => {
    if (code) stop(code);
  });
  return p;
}
function stop(code = 0) {
  for (const p of children) p.kill();
  process.exit(code);
}
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => stop());
if (!existsSync("runtime/torob.sqlite")) {
  const p = spawn("python", ["scripts/seed_sqlite.py"], {
    stdio: "inherit",
    windowsHide: true,
  });
  const code = await new Promise((r) => p.on("exit", r));
  if (code) process.exit(code);
}
run(["--env-file-if-exists=.env", "--import", "tsx", "server/node.ts"]);
run([
  "node_modules/vite/bin/vite.js",
  "--config",
  "vite.node.config.ts",
  "--host",
  "127.0.0.1",
  ...process.argv.slice(2),
]);
