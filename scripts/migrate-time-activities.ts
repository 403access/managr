/**
 * One-time data move for the time screen.
 *
 * Older entries kept the individual activities in `time_entries.memo`, which is
 * now the internal note. This script applies the schema, splits each old memo
 * into one activity per line, writes them to `time_entry_activities`, and
 * clears the memo. It only touches entries that have no activities yet, so a
 * second run is a no-op. A backup is written before the first change.
 *
 * Usage:
 *   bun run db:time-activities
 *   bun run db:time-activities -- --dry-run
 *   bun run db:time-activities -- --db data/managr.demo.db
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { parseTimeActivities } from "../src/domain/time";

type EntryRow = { id: number; entryDate: string; memo: string };
type PlannedEntry = EntryRow & { activities: string[] };

const dataDir = path.join(process.cwd(), "data");
const migrationsDir = path.join(process.cwd(), "src/db/migrations");

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`"${name}" needs a value.`);
  return value;
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function migrate(sqlite: Database.Database): string[] {
  sqlite.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = new Set(
    (sqlite.prepare("SELECT id FROM schema_migrations").all() as { id: string }[]).map((row) => row.id),
  );
  const insert = sqlite.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)");
  const appliedNow: string[] = [];
  sqlite.pragma("foreign_keys = OFF");
  try {
    for (const file of fs.readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort()) {
      if (applied.has(file)) continue;
      sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
      insert.run(file, new Date().toISOString());
      appliedNow.push(file);
    }
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
  return appliedNow;
}

function backup(sqlite: Database.Database, source: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(path.dirname(source), `${path.basename(source, ".db")}.before-time-activities-${stamp}.db`);
  fs.rmSync(target, { force: true });
  sqlite.exec(`VACUUM INTO ${sqlString(target)}`);
  return target;
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Splits old time-entry memos into activities. Options: --dry-run, --db <file>.");
    return;
  }

  const file = path.resolve(option(args, "--db") ?? path.join(dataDir, "managr.db"));
  if (!fs.existsSync(file)) throw new Error(`No database at ${path.relative(process.cwd(), file) || file}.`);

  const sqlite = new Database(file);
  try {
    const appliedNow = migrate(sqlite);
    if (appliedNow.length > 0) {
      console.log(`Applied migrations: ${appliedNow.join(", ")}`);
    }

    const entries = sqlite
      .prepare(
        "SELECT id, entry_date AS entryDate, memo FROM time_entries WHERE trim(memo) <> '' ORDER BY entry_date, started_at, id",
      )
      .all() as EntryRow[];
    const countActivities = sqlite.prepare("SELECT COUNT(*) AS count FROM time_entry_activities WHERE time_entry_id = ?");
    const planned: PlannedEntry[] = [];
    for (const entry of entries) {
      const existing = (countActivities.get(entry.id) as { count: number }).count;
      if (existing > 0) continue;
      const activities = parseTimeActivities(entry.memo);
      if (activities.length > 0) planned.push({ ...entry, activities });
    }

    if (planned.length === 0) {
      console.log("Nothing to migrate. No entry has an old memo without activities.");
      return;
    }

    const activityCount = planned.reduce((sum, entry) => sum + entry.activities.length, 0);
    console.log(
      `${planned.length} ${planned.length === 1 ? "entry" : "entries"} with an old memo, ${activityCount} activities.`,
    );
    for (const entry of planned) {
      console.log(`  #${entry.id} ${entry.entryDate}: ${entry.activities.length} ${entry.activities.length === 1 ? "activity" : "activities"}`);
    }
    if (args.includes("--dry-run")) {
      console.log("Dry run. No activities or notes were changed.");
      return;
    }

    const backupFile = backup(sqlite, file);
    console.log(`Backup: ${path.relative(process.cwd(), backupFile) || backupFile}`);

    const insertActivity = sqlite.prepare(
      "INSERT INTO time_entry_activities (time_entry_id, position, description) VALUES (?, ?, ?)",
    );
    const clearMemo = sqlite.prepare("UPDATE time_entries SET memo = '' WHERE id = ?");
    sqlite.transaction(() => {
      for (const entry of planned) {
        entry.activities.forEach((description, position) => insertActivity.run(entry.id, position, description));
        clearMemo.run(entry.id);
      }
    })();

    console.log(`Migrated ${planned.length} ${planned.length === 1 ? "entry" : "entries"}. The memo is now empty; the note field stays internal.`);
    console.log("Only line breaks split activities. Text with commas stays one activity, so check /time once.");
  } finally {
    sqlite.close();
  }
}

try {
  main();
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}