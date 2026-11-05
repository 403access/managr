import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  absences,
  accounts,
  companies,
  complianceItems,
  customers,
  customDeadlines,
  documents,
  employees,
  invoiceLines,
  invoices,
  journalEntries,
  journalLines,
  obligationStates,
  payments,
  policies,
  reserveMovements,
  resolutions,
  shareholders,
  tasks,
  timeEntries,
} from "@/db/schema";
import type { AccountType, PnlGroup } from "@/domain/accounts";
import { ACCOUNTS, signedBalance } from "@/domain/accounts";
import { addDays, todayIso } from "@/domain/calendar";
import { statutoryObligations } from "@/domain/obligations";
import { estimateContributions, type ContributionEstimate } from "@/domain/social";
import { countWorkdays, weekStart } from "@/domain/time";
import { lineNetCents, summarizeVat } from "@/domain/vat";
import { invoiceMoney } from "./invoice-math";
import { socialInput } from "./people";

export type BalanceRow = {
  code: string;
  name: string;
  type: AccountType;
  pnl: PnlGroup;
  debitCents: number;
  creditCents: number;
};

export function loadCompany() {
  const db = getDb();
  const row = db.select().from(companies).where(eq(companies.isActive, true)).get()
    ?? db.select().from(companies).orderBy(asc(companies.id)).get();
  if (!row) throw new Error("The company record is missing.");
  return row;
}

export function listCompanies() {
  return getDb().select().from(companies).orderBy(asc(companies.legalName)).all();
}

export function loadShareholders() {
  return getDb().select().from(shareholders).where(eq(shareholders.companyId, loadCompany().id)).orderBy(asc(shareholders.name)).all();
}

export function listCustomers(companyId = loadCompany().id) {
  return getDb().select().from(customers).where(eq(customers.companyId, companyId)).orderBy(asc(customers.name)).all();
}

export function listPolicies() {
  return getDb().select().from(policies).where(eq(policies.companyId, loadCompany().id)).orderBy(asc(policies.renewalDate)).all();
}

export function listReserveMovements() {
  return getDb().select().from(reserveMovements).where(eq(reserveMovements.companyId, loadCompany().id)).orderBy(desc(reserveMovements.movedOn)).all();
}

/** Date limits sit on the join. A WHERE on the entry would drop accounts with no lines in range. */
export function accountBalances(from = "0001-01-01", to = "9999-12-31"): BalanceRow[] {
  const companyId = loadCompany().id;
  const rows = getDb().all<BalanceRow>(sql`
    SELECT
      a.code AS code,
      a.name AS name,
      a.type AS type,
      a.pnl AS pnl,
      CAST(COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.debit_cents ELSE 0 END), 0) AS INTEGER) AS debitCents,
      CAST(COALESCE(SUM(CASE WHEN e.id IS NOT NULL THEN l.credit_cents ELSE 0 END), 0) AS INTEGER) AS creditCents
    FROM accounts a
    LEFT JOIN journal_lines l ON l.account_id = a.id
    LEFT JOIN journal_entries e ON e.id = l.entry_id AND e.entry_date >= ${from} AND e.entry_date <= ${to} AND e.company_id = ${companyId}
    GROUP BY a.id
    ORDER BY a.code
  `);
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    type: row.type,
    pnl: row.pnl,
    debitCents: Number(row.debitCents),
    creditCents: Number(row.creditCents),
  }));
}

export function signedAccount(rows: BalanceRow[], code: string): number {
  const row = rows.find((item) => item.code === code);
  if (!row) return 0;
  return signedBalance(row.type, row.debitCents, row.creditCents);
}

export function vatPayableCents(rows: BalanceRow[]): number {
  const of = (code: string) => signedAccount(rows, code);
  return of(ACCOUNTS.vat19) + of(ACCOUNTS.vat7) - of(ACCOUNTS.inputVat19) - of(ACCOUNTS.inputVat7) - of(ACCOUNTS.vatPrepayments) - of(ACCOUNTS.vatSpecialPrepayment);
}

export function displayStatus(status: string, dueDate: string, today: string): string {
  if ((status === "issued" || status === "partial") && dueDate < today) return "overdue";
  if (status === "issued") return "open";
  return status;
}

export function listInvoices() {
  const db = getDb();
  const today = todayIso();
  const rows = db
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      customerId: invoices.customerId,
      customerName: customers.name,
    })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .where(eq(invoices.companyId, loadCompany().id))
    .orderBy(desc(invoices.issueDate), desc(invoices.id))
    .all();
  const lineRows = db.select().from(invoiceLines).all();
  const paymentRows = db.select().from(payments).all();
  return rows.map((row) => {
    const lines = lineRows.filter((line) => line.invoiceId === row.id);
    const paidCents = paymentRows.filter((payment) => payment.invoiceId === row.id).reduce((sum, payment) => sum + payment.amountCents, 0);
    const totals = summarizeVat(
      lines.map((line) => ({ netCents: lineNetCents(line.quantityMilli, line.unitNetCents), vatBps: line.vatBps })),
      false,
    );
    return {
      ...row,
      grossCents: totals.grossCents,
      paidCents,
      openCents: row.status === "void" ? 0 : Math.max(0, totals.grossCents - paidCents),
      displayStatus: displayStatus(row.status, row.dueDate, today),
    };
  });
}

export function loadInvoice(id: number) {
  const db = getDb();
  const invoice = db.select().from(invoices).where(eq(invoices.id, id)).get();
  if (!invoice) return null;
  const company = db.select().from(companies).where(eq(companies.id, invoice.companyId)).get();
  if (!company) return null;
  const customer = db.select().from(customers).where(and(eq(customers.id, invoice.customerId), eq(customers.companyId, invoice.companyId))).get();
  if (!customer) return null;
  const money = invoiceMoney(db, id);
  return {
    invoice,
    company,
    customer,
    ...money,
    openCents: invoice.status === "void" ? 0 : money.openCents,
    displayStatus: displayStatus(invoice.status, invoice.dueDate, todayIso()),
  };
}

export function listPeople() {
  const company = loadCompany();
  return getDb()
    .select()
    .from(employees)
    .where(eq(employees.companyId, company.id))
    .orderBy(asc(employees.lastName), asc(employees.firstName))
    .all()
    .map((employee) => {
      try {
        const estimate: ContributionEstimate | null = estimateContributions(socialInput(employee, company, employee.grossMonthlyCents));
        return { employee, estimate, estimateError: "" };
      } catch (error) {
        return { employee, estimate: null, estimateError: error instanceof Error ? error.message : "Estimate unavailable." };
      }
    });
}

export function postedPayrollMonths(employeeId: number): string[] {
  const prefix = `${employeeId}:`;
  return getDb()
    .select({ sourceId: journalEntries.sourceId })
    .from(journalEntries)
    .where(and(eq(journalEntries.source, "payroll"), eq(journalEntries.companyId, loadCompany().id)))
    .all()
    .flatMap((row) => (row.sourceId?.startsWith(prefix) ? [row.sourceId.slice(prefix.length)] : []))
    .sort();
}

export function loadPerson(id: number) {
  const company = loadCompany();
  const db = getDb();
  const employee = db.select().from(employees).where(and(eq(employees.id, id), eq(employees.companyId, company.id))).get();
  if (!employee) return null;
  const absenceRows = db.select().from(absences).where(eq(absences.employeeId, id)).orderBy(desc(absences.startDate)).all();
  let estimate: ContributionEstimate | null = null;
  let estimateError = "";
  try {
    estimate = estimateContributions(socialInput(employee, company, employee.grossMonthlyCents));
  } catch (error) {
    estimateError = error instanceof Error ? error.message : "Estimate unavailable.";
  }
  const year = todayIso().slice(0, 4);
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const vacationUsed = absenceRows
    .filter((absence) => absence.kind === "vacation" && absence.status !== "rejected")
    .reduce((sum, absence) => {
      const start = absence.startDate < yearStart ? yearStart : absence.startDate;
      const end = absence.endDate > yearEnd ? yearEnd : absence.endDate;
      return sum + countWorkdays(start, end, employee.workdaysPerWeek);
    }, 0);
  return { employee, absences: absenceRows, postedMonths: postedPayrollMonths(id), estimate, estimateError, vacationUsed, company };
}

export function payrollObligationsApply(): boolean {
  const company = loadCompany();
  return getDb()
    .select()
    .from(employees)
    .where(eq(employees.companyId, company.id))
    .all()
    .some((person) => {
      try {
        return estimateContributions(socialInput(person, company, Math.max(0, person.grossMonthlyCents))).regime !== "exempt";
      } catch {
        return true;
      }
    });
}

export function listObligations(year: number) {
  const company = loadCompany();
  const showPayroll = payrollObligationsApply();
  const items = statutoryObligations(year, {
    fiscalYearStartMonth: company.fiscalYearStartMonth,
    vatPermanentExtension: company.vatPermanentExtension,
    usesTaxAdvisor: company.usesTaxAdvisor,
  }).filter((item) => {
    if (item.when === "vat" && company.kleinunternehmer) return false;
    if (item.when === "payroll" && !showPayroll) return false;
    return true;
  });
  const states = getDb().select().from(obligationStates).where(eq(obligationStates.companyId, company.id)).all();
  const byKey = new Map(states.map((state) => [state.key, state]));
  return items.map((item) => ({
    ...item,
    status: byKey.get(item.key)?.status ?? "open",
    note: byKey.get(item.key)?.note ?? "",
  }));
}

export function listDeadlines() {
  return getDb().select().from(customDeadlines).where(eq(customDeadlines.companyId, loadCompany().id)).orderBy(asc(customDeadlines.dueDate)).all();
}

export function listTasks() {
  const rank = (status: string) => (status === "done" ? 2 : status === "doing" ? 1 : 0);
  return getDb()
    .select()
    .from(tasks)
    .where(eq(tasks.companyId, loadCompany().id))
    .all()
    .sort((a, b) => rank(a.status) - rank(b.status) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.id - b.id);
}

export function listTime(anchor: string) {
  const start = weekStart(anchor);
  const end = addDays(start, 6);
  const entries = getDb()
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.companyId, loadCompany().id), gte(timeEntries.entryDate, start), lte(timeEntries.entryDate, end)))
    .orderBy(asc(timeEntries.entryDate), asc(timeEntries.startedAt))
    .all();
  return { start, end, entries };
}

export function listDocuments() {
  return getDb().select().from(documents).where(eq(documents.companyId, loadCompany().id)).orderBy(desc(documents.uploadedAt)).all();
}

export function listCompliance() {
  return getDb().select().from(complianceItems).where(eq(complianceItems.companyId, loadCompany().id)).orderBy(asc(complianceItems.sortOrder)).all();
}

export function listResolutions() {
  return getDb().select().from(resolutions).where(eq(resolutions.companyId, loadCompany().id)).orderBy(desc(resolutions.resolvedOn), desc(resolutions.id)).all();
}

export function listJournal(limit = 20) {
  const db = getDb();
  const entries = db.select().from(journalEntries).where(eq(journalEntries.companyId, loadCompany().id)).orderBy(desc(journalEntries.entryDate), desc(journalEntries.id)).limit(limit).all();
  if (entries.length === 0) return [];
  const lines = db
    .select({
      entryId: journalLines.entryId,
      code: accounts.code,
      name: accounts.name,
      debitCents: journalLines.debitCents,
      creditCents: journalLines.creditCents,
    })
    .from(journalLines)
    .innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .where(inArray(journalLines.entryId, entries.map((entry) => entry.id)))
    .all();
  return entries.map((entry) => ({ ...entry, lines: lines.filter((line) => line.entryId === entry.id) }));
}
