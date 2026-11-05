import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "@/db/client";
import { companies, customers, invoices, journalEntries } from "@/db/schema";

const files: string[] = [];

afterEach(() => {
  for (const file of files.splice(0)) {
    fs.rmSync(file, { force: true });
    fs.rmSync(`${file}-wal`, { force: true });
    fs.rmSync(`${file}-shm`, { force: true });
  }
});

function oldDatabase(file: string) {
  const sqlite = new Database(file);
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec("CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const name of ["0001_init.sql", "0002_buyer_reference.sql"]) {
    sqlite.exec(fs.readFileSync(path.join(process.cwd(), "src/db/migrations", name), "utf8"));
    sqlite.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(name, new Date().toISOString());
  }
  sqlite.prepare("INSERT INTO companies (legal_name, share_capital_cents, founding_date) VALUES (?, ?, ?)").run("Alte UG (haftungsbeschränkt)", 250_000, "2024-03-15");
  sqlite.prepare("INSERT INTO customers (name) VALUES (?)").run("Bestandskunde");
  sqlite.prepare("INSERT INTO invoices (customer_id, number, status, issue_date, service_date, due_date) VALUES (1, 'RE-2026-0001', 'issued', '2026-01-01', '2026-01-01', '2026-01-15')").run();
  sqlite.prepare("INSERT INTO journal_entries (entry_date, memo, source, source_id, created_at) VALUES ('2026-01-01', 'Alt', 'invoice', '1', ?)").run(new Date().toISOString());
  sqlite.close();
}

describe("multi-company migration", () => {
  it("puts existing books in company 1, activates it, and allows the same invoice number in another company", () => {
    const file = path.join(os.tmpdir(), `managr-migration-${Date.now()}.db`);
    files.push(file);
    oldDatabase(file);

    const db = openDatabase(file);
    const first = db.select().from(companies).all();
    expect(first).toHaveLength(1);
    expect(first[0].isActive).toBe(true);
    expect(first[0].legalForm).toBe("ug");

    const invoice = db.select().from(invoices).get();
    expect(invoice?.companyId).toBe(1);
    expect(db.select().from(journalEntries).get()?.companyId).toBe(1);

    const secondId = Number(
      db
        .insert(companies)
        .values({ legalName: "Zweites Einzelunternehmen", legalForm: "einzelunternehmen", shareCapitalCents: 0, foundingDate: "2026-01-01", isActive: false })
        .run().lastInsertRowid,
    );
    const customerId = Number(db.insert(customers).values({ companyId: secondId, name: "Neukunde" }).run().lastInsertRowid);
    expect(() =>
      db
        .insert(invoices)
        .values({ companyId: secondId, customerId, number: "RE-2026-0001", status: "issued", issueDate: "2026-01-01", serviceDate: "2026-01-01", dueDate: "2026-01-15" })
        .run(),
    ).not.toThrow();
  });
});
