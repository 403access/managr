import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

type Slot = "demo" | "production";

const dataDir = path.join(process.cwd(), "data");
const activePath = path.join(dataDir, "managr.db");
const markerPath = path.join(dataDir, "managr.active");

const slotPaths: Record<Slot, string> = {
  demo: path.join(dataDir, "managr.demo.db"),
  production: path.join(dataDir, "managr.production.db"),
};

const setCommands: Record<Slot, string> = {
  demo: "db:demo:set",
  production: "db:prod:set",
};

class ScriptError extends Error {}

function relative(file: string): string {
  return path.relative(process.cwd(), file) || ".";
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function removeSidecars(file: string): void {
  fs.rmSync(`${file}-wal`, { force: true });
  fs.rmSync(`${file}-shm`, { force: true });
}

/**
 * VACUUM INTO writes a consistent single-file copy, including pages still in
 * the source WAL. Copying the database file alone could drop those pages.
 */
function copyDatabase(source: string, destination: string): void {
  if (!fs.existsSync(source)) {
    throw new ScriptError(`No database at ${relative(source)}.`);
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = path.join(
    path.dirname(destination),
    `.${path.basename(destination)}.${process.pid}.tmp`,
  );
  fs.rmSync(temporary, { force: true });

  try {
    const sqlite = new Database(source);
    try {
      sqlite.exec(`VACUUM INTO ${sqlString(temporary)}`);
    } finally {
      sqlite.close();
    }
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    if (error instanceof Error) {
      throw new ScriptError(`Could not read ${relative(source)} as a SQLite database: ${error.message}`);
    }
    throw error;
  }

  fs.renameSync(temporary, destination);
  removeSidecars(destination);
}

function readActiveSlot(): Slot | null {
  try {
    const value = fs.readFileSync(markerPath, "utf8").trim();
    if (value === "demo" || value === "production") return value;
  } catch {
    // A missing marker means the active database has not been saved as a slot yet.
  }
  return null;
}

function writeActiveSlot(slot: Slot): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(markerPath, `${slot}\n`);
}

function parseSlot(value: string | undefined): Slot {
  if (value === "demo") return "demo";
  if (value === "production" || value === "prod") return "production";
  throw new ScriptError(`Unknown database "${value ?? ""}". Use "demo" or "production".`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function describe(file: string): string {
  if (!fs.existsSync(file)) return "not saved";
  const stat = fs.statSync(file);
  return `${relative(file)} (${formatBytes(stat.size)})`;
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/** Returns null when the database has no company record, which the desk cannot open. */
function isSampleDatabase(file: string): boolean | null {
  const sqlite = new Database(file, { readonly: true });
  try {
    const row = sqlite.prepare("SELECT is_sample FROM companies LIMIT 1").get() as
      | { is_sample: number }
      | undefined;
    return row ? row.is_sample !== 0 : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ScriptError(`Could not inspect ${relative(file)} as a managr database: ${message}`);
  } finally {
    sqlite.close();
  }
}

function ensureProductionSource(source: string): void {
  if (path.resolve(source) === path.resolve(slotPaths.demo)) {
    throw new ScriptError(
      'Refusing to use the demo database as production. Pass "--from <file>" with your production database.',
    );
  }

  const sample = isSampleDatabase(source);
  if (sample === null) {
    throw new ScriptError(
      `${relative(source)} has no company record. The desk would seed the sample company into it. Import your production database with "--from <file>".`,
    );
  }
  if (sample) {
    throw new ScriptError(
      `${relative(source)} still contains the sample company. Production must start from your own books.`,
    );
  }
}

function use(slot: Slot, force: boolean): void {
  const target = slotPaths[slot];
  if (!fs.existsSync(target)) {
    const hint =
      slot === "production"
        ? `Import one with "npm run ${setCommands[slot]} -- --from <file>".`
        : `Save one with "npm run ${setCommands[slot]}".`;
    throw new ScriptError(`There is no ${slot} database yet. ${hint}`);
  }

  const current = readActiveSlot();
  const hasActive = fs.existsSync(activePath);

  if (hasActive && current === slot && !force) {
    console.log(`Already using the ${slot} database. Add "--force" to load the saved copy again.`);
    return;
  }

  if (hasActive && !current) {
    const backup = path.join(dataDir, `managr.unsaved-${timestamp()}.db`);
    copyDatabase(activePath, backup);
    console.log(`The active database was not linked to a copy. Saved it as ${relative(backup)}.`);
  }

  if (hasActive && current && current !== slot) {
    copyDatabase(activePath, slotPaths[current]);
    console.log(`Saved the active ${current} database back to ${relative(slotPaths[current])}.`);
  }

  copyDatabase(target, activePath);
  writeActiveSlot(slot);
  console.log(`Now using the ${slot} database. Stop and start the desk so it opens the swapped file.`);
}

function set(slot: Slot, from: string | undefined): void {
  const current = readActiveSlot();
  const source = from ? path.resolve(from) : activePath;

  if (slot === "production" && !from && current !== "production") {
    throw new ScriptError(
      'Refusing to save the active database as production. Pass "--from <file>" with your production database, or switch to production first.',
    );
  }

  if (slot === "production") ensureProductionSource(source);

  const savingActive = source === activePath;

  copyDatabase(source, slotPaths[slot]);
  if (savingActive) writeActiveSlot(slot);

  console.log(`Saved ${relative(source)} as the ${slot} database (${relative(slotPaths[slot])}).`);
}

function status(): void {
  const current = readActiveSlot();
  const active = fs.existsSync(activePath)
    ? `${relative(activePath)} (${formatBytes(fs.statSync(activePath).size)})`
    : "missing";

  console.log(`Active: ${current ?? "not linked"} — ${active}`);
  console.log(`Demo:   ${describe(slotPaths.demo)}`);
  console.log(`Prod:   ${describe(slotPaths.production)}`);
  console.log("");
  console.log("Switch: npm run db:demo | npm run db:prod");
  console.log("Save:   npm run db:demo:set | npm run db:prod:set [-- --from <file>]");
  console.log("Uploads in data/uploads are shared by both databases.");
}

function help(): void {
  console.log(`Usage: tsx scripts/databases.ts <command>

Commands:
  status                  Show the active database and both saved copies.
  use demo|production     Open a saved copy as data/managr.db.
                         Add "--force" to reload it when it is already active.
  set demo|production     Save data/managr.db as a copy.
                         Production needs "--from <file>" unless production is active.
                         Add "--from <file>" to save another SQLite file instead.
                         A sample database is refused for production.

The active database is saved back to its copy before switching, so edits are
not lost. Stop the desk before switching; the running server keeps its open
connection. Uploads in data/uploads are shared.`);
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    help();
    return;
  }

  if (command === "status") {
    status();
    return;
  }

  if (command === "use") {
    use(parseSlot(args[1]), args.includes("--force"));
    return;
  }

  if (command === "set") {
    const slot = parseSlot(args[1]);
    const fromIndex = args.indexOf("--from");
    const from = fromIndex >= 0 ? args[fromIndex + 1] : undefined;
    if (fromIndex >= 0 && !from) {
      throw new ScriptError('"--from" needs a file path.');
    }
    set(slot, from);
    return;
  }

  throw new ScriptError(`Unknown command "${command}". Run with --help for usage.`);
}

try {
  main();
} catch (error) {
  if (error instanceof ScriptError) {
    console.error(`error: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
}
