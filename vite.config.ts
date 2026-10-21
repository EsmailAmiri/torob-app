import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { sites } from "./scripts/vite/sites-vite-plugin";
export default defineConfig({
  build: { outDir: "dist" },
  plugins: [
    sites({ mockAuth: false }),
    cloudflare({
      viteEnvironment: { name: "server" },
      config: {
        name: "torob-hamrah",
        main: "./server/worker.ts",
        compatibility_date: "2026-10-21",
        compatibility_flags: ["nodejs_compat"],
        assets: {
          binding: "ASSETS",
          directory: "./dist/client",
          not_found_handling: "single-page-application",
          run_worker_first: ["/api/*"],
        },
        d1_databases: [
          {
            binding: "DB",
            database_name: "torob-hamrah",
            database_id: "00000000-0000-4000-8000-000000000000",
            migrations_dir: "drizzle",
          },
        ],
      },
      inspectorPort: false,
    }),
  ],
});
