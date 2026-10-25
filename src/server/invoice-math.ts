import "server-only";
import { asc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { invoiceLines, payments } from "@/db/schema";
import { lineNetCents, summarizeVat } from "@/domain/vat";

export function invoiceMoney(db: DB, invoiceId: number) {
  const lines = db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId)).orderBy(asc(invoiceLines.position)).all();
  const paid = db.select().from(payments).where(eq(payments.invoiceId, invoiceId)).orderBy(asc(payments.paidOn)).all();
  const priced = lines.map((line) => ({ ...line, netCents: lineNetCents(line.quantityMilli, line.unitNetCents) }));
  const totals = summarizeVat(
    priced.map((line) => ({ netCents: line.netCents, vatBps: line.vatBps })),
    false,
  );
  const paidCents = paid.reduce((sum, payment) => sum + payment.amountCents, 0);
  return { lines: priced, payments: paid, ...totals, paidCents, openCents: Math.max(0, totals.grossCents - paidCents) };
}
