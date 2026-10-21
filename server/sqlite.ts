import { DatabaseSync } from "node:sqlite";
import type { Sql } from "./types";
export function sqliteAdapter(db: DatabaseSync): Sql {
  return {
    async all(sql, params = []) {
      return db.prepare(sql).all(...(params as any[]));
    },
    async run(sql, params = []) {
      return {
        changes: Number(db.prepare(sql).run(...(params as any[])).changes),
      };
    },
    async batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try {
        for (const s of statements)
          db.prepare(s.sql).run(...(s.params as any[]));
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
