import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { openDatabase } from "@/db/client";
import { seedIfEmpty } from "@/db/seed";
import { companies, journalLines } from "@/db/schema";

const files: string[] = [];

afterEach(() => {
  for (const file of files.splice(0)) fs.rmSync(file, { force: true });
});

describe("sample ledger", () => {
  it("seeds a balanced set of books", () => {
    const file = path.join(os.tmpdir(), `managr-${Date.now()}.db`);
    files.push(file);
    const db = openDatabase(file);
    seedIfEmpty(db);
    seedIfEmpty(db);
    const company = db.select().from(companies).get();
    expect(company?.legalName).toContain("UG");
    const totals = db
      .select({
        debit: sql<number>`coalesce(sum(${journalLines.debitCents}), 0)`,
        credit: sql<number>`coalesce(sum(${journalLines.creditCents}), 0)`,
      })
      .from(journalLines)
      .get();
    expect(Number(totals?.debit)).toBeGreaterThan(0);
    expect(Number(totals?.debit)).toBe(Number(totals?.credit));
  });
});
