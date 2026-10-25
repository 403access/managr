import "server-only";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { databasePath } from "./paths";
import { seedIfEmpty } from "./seed";

export type DB = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { managrDb?: DB };

function migrate(sqlite: Database.Database) {
  sqlite.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const appliedRows = sqlite.prepare("SELECT id FROM schema_migrations").all() as { id: string }[];
  const applied = new Set(appliedRows.map((row) => row.id));
  const directory = path.join(process.cwd(), "src/db/migrations");
  const files = fs.readdirSync(directory).filter((file) => file.endsWith(".sql")).sort();
  const insert = sqlite.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)");
  for (const file of files) {
    if (applied.has(file)) continue;
    sqlite.exec(fs.readFileSync(path.join(directory, file), "utf8"));
    insert.run(file, new Date().toISOString());
  }
}

export function openDatabase(filename: string): DB {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const sqlite = new Database(filename);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  migrate(sqlite);
  return drizzle(sqlite, { schema });
}

export function getDb(): DB {
  if (!globalForDb.managrDb) {
    const db = openDatabase(databasePath());
    seedIfEmpty(db);
    globalForDb.managrDb = db;
  }
  return globalForDb.managrDb;
}
