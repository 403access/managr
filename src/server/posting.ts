import "server-only";
import { eq } from "drizzle-orm";
import { journalImbalance, type DraftLine } from "@/domain/accounts";
import type { DB } from "@/db/client";
import { accounts, journalEntries, journalLines } from "@/db/schema";

export function payrollSourceId(employeeId: number, month: string): string {
  return `${employeeId}:${month}`;
}

export function postJournal(
  db: DB,
  input: { companyId: number; date: string; memo: string; source: string; sourceId?: string | null; lines: DraftLine[] },
): number {
  const problem = journalImbalance(input.lines);
  if (problem) throw new Error(problem);
  return db.transaction((tx) => {
    const chart = tx.select().from(accounts).all();
    const ids = new Map(chart.map((account) => [account.code, account.id]));
    const created = tx
      .insert(journalEntries)
      .values({
        companyId: input.companyId,
        entryDate: input.date,
        memo: input.memo,
        source: input.source,
        sourceId: input.sourceId ?? null,
        createdAt: new Date().toISOString(),
      })
      .run();
    const entryId = Number(created.lastInsertRowid);
    for (const entry of input.lines) {
      const accountId = ids.get(entry.accountCode);
      if (!accountId) throw new Error(`Unknown account ${entry.accountCode}.`);
      tx.insert(journalLines)
        .values({ entryId, accountId, debitCents: entry.debitCents, creditCents: entry.creditCents })
        .run();
    }
    return entryId;
  });
}

export function entryLines(db: DB, entryId: number): DraftLine[] {
  return db
    .select({
      accountCode: accounts.code,
      debitCents: journalLines.debitCents,
      creditCents: journalLines.creditCents,
    })
    .from(journalLines)
    .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .where(eq(journalLines.entryId, entryId))
    .all();
}
