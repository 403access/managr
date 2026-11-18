import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  absences,
  accounts,
  bankAccounts,
  bankConnections,
  bankTransactions,
  companies,
  complianceItems,
  customers,
  customDeadlines,
  directorContracts,
  documents,
  employees,
  founderHealth,
  invoiceLines,
  invoices,
  journalEntries,
  journalLines,
  milestoneCompanies,
  milestones,
  obligationStates,
  payments,
  policies,
  projects,
  reserveMovements,
  resolutions,
  salaryPeriods,
  shareholderLoanMovements,
  shareholderLoans,
  shareholders,
  tasks,
  timeEntries,
} from "@/db/schema";
import type { AccountType, PnlGroup } from "@/domain/accounts";
import { ACCOUNTS, signedBalance } from "@/domain/accounts";
import { addDays, todayIso } from "@/domain/calendar";
import { statutoryObligations } from "@/domain/obligations";
import { salaryForMonth, type SalaryPeriod } from "@/domain/salary";
import { loanInterestCents, loanOutstandingCents, reviewShareholderLoan } from "@/domain/shareholder-loan";
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

export function listProjects(companyId = loadCompany().id) {
  return getDb()
    .select({
      id: projects.id,
      customerId: projects.customerId,
      customerName: customers.name,
      name: projects.name,
      status: projects.status,
      startedOn: projects.startedOn,
      endedOn: projects.endedOn,
      notes: projects.notes,
    })
    .from(projects)
    .leftJoin(customers, eq(customers.id, projects.customerId))
    .where(eq(projects.companyId, companyId))
    .orderBy(asc(projects.status), asc(projects.name))
    .all();
}

/** Cross-company goals with the companies they name. Not scoped to the active company. */
export function listMilestones() {
  const db = getDb();
  const rows = db.select().from(milestones).orderBy(asc(milestones.targetDate), asc(milestones.title)).all();
  const links = db.select().from(milestoneCompanies).all();
  return rows.map((row) => ({
    ...row,
    companyIds: links
      .filter((link) => link.milestoneId === row.id)
      .map((link) => link.companyId)
      .sort((left, right) => left - right),
  }));
}

export function listTimeInRange(from: string, to: string) {
  return getDb()
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.companyId, loadCompany().id), gte(timeEntries.entryDate, from), lte(timeEntries.entryDate, to)))
    .orderBy(asc(timeEntries.entryDate), asc(timeEntries.startedAt))
    .all();
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
      netCents: totals.netCents,
      vatCents: totals.vatCents,
      grossCents: totals.grossCents,
      paidCents,
      openCents: row.status === "void" ? 0 : Math.max(0, totals.grossCents - paidCents),
      displayStatus: displayStatus(row.status, row.dueDate, today),
    };
  });
}

export type CashMovement = {
  id: number;
  entryDate: string;
  memo: string;
  source: string;
  deltaCents: number;
};

/**
 * Every journal entry in the range that touches the bank account, with its net
 * bank change. The page groups these movements by source so the cash view and
 * the accrual view can be read side by side.
 */
export function listCashMovements(from: string, to: string): CashMovement[] {
  const companyId = loadCompany().id;
  return getDb()
    .all<CashMovement>(sql`
      SELECT
        e.id AS id,
        e.entry_date AS entryDate,
        e.memo AS memo,
        e.source AS source,
        CAST(COALESCE(SUM(l.debit_cents - l.credit_cents), 0) AS INTEGER) AS deltaCents
      FROM journal_entries e
      JOIN journal_lines l ON l.entry_id = e.id
      JOIN accounts a ON a.id = l.account_id
      WHERE e.company_id = ${companyId}
        AND e.entry_date >= ${from}
        AND e.entry_date <= ${to}
        AND a.code = ${ACCOUNTS.bank}
      GROUP BY e.id
      ORDER BY e.entry_date, e.id
    `)
    .map((row) => ({ ...row, deltaCents: Number(row.deltaCents) }));
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
  const month = todayIso().slice(0, 7);
  const schedules = salaryPeriodsByEmployee();
  return getDb()
    .select()
    .from(employees)
    .where(eq(employees.companyId, company.id))
    .orderBy(asc(employees.lastName), asc(employees.firstName))
    .all()
    .map((employee) => {
      const currentGrossCents = salaryForMonth(schedules.get(employee.id) ?? [], employee.grossMonthlyCents, month);
      try {
        const estimate: ContributionEstimate | null = estimateContributions(socialInput(employee, company, currentGrossCents));
        return { employee: { ...employee, grossMonthlyCents: currentGrossCents }, estimate, estimateError: "" };
      } catch (error) {
        return { employee: { ...employee, grossMonthlyCents: currentGrossCents }, estimate: null, estimateError: error instanceof Error ? error.message : "Estimate unavailable." };
      }
    });
}

/** Just the fields the org chart needs, without the payroll estimates. */
export function listOrgMembers() {
  const company = loadCompany();
  return getDb()
    .select({
      id: employees.id,
      firstName: employees.firstName,
      lastName: employees.lastName,
      role: employees.role,
      kind: employees.kind,
      endDate: employees.endDate,
      managerId: employees.managerId,
    })
    .from(employees)
    .where(eq(employees.companyId, company.id))
    .orderBy(asc(employees.lastName), asc(employees.firstName))
    .all();
}

export function listSalaryPeriods(employeeId: number) {
  return getDb().select().from(salaryPeriods).where(eq(salaryPeriods.employeeId, employeeId)).orderBy(desc(salaryPeriods.validFrom)).all();
}

export function getFounderHealth(employeeId: number) {
  return getDb()
    .select()
    .from(founderHealth)
    .where(and(eq(founderHealth.employeeId, employeeId), eq(founderHealth.companyId, loadCompany().id)))
    .get() ?? null;
}

export function listShareholderLoans() {
  const companyId = loadCompany().id;
  const db = getDb();
  const rows = db
    .select({
      id: shareholderLoans.id,
      companyId: shareholderLoans.companyId,
      shareholderId: shareholderLoans.shareholderId,
      shareholderName: shareholders.name,
      label: shareholderLoans.label,
      openedOn: shareholderLoans.openedOn,
      principalCents: shareholderLoans.principalCents,
      interestBps: shareholderLoans.interestBps,
      notes: shareholderLoans.notes,
      createdAt: shareholderLoans.createdAt,
    })
    .from(shareholderLoans)
    .innerJoin(shareholders, eq(shareholders.id, shareholderLoans.shareholderId))
    .where(eq(shareholderLoans.companyId, companyId))
    .orderBy(desc(shareholderLoans.openedOn), desc(shareholderLoans.id))
    .all();
  const movements = db.select().from(shareholderLoanMovements).all();
  return rows.map((loan) => {
    const own = movements
      .filter((movement) => movement.loanId === loan.id)
      .sort((left, right) => left.movedOn.localeCompare(right.movedOn) || left.id - right.id);
    const outstandingCents = loanOutstandingCents(loan.principalCents, own);
    return {
      ...loan,
      movements: own,
      outstandingCents,
      interestSuggestionCents: loanInterestCents(outstandingCents, loan.interestBps),
      review: reviewShareholderLoan({
        label: loan.label,
        outstandingCents,
        interestBps: loan.interestBps,
        hasNotes: loan.notes.trim().length > 0,
      }),
    };
  });
}

export function listDirectorContracts(employeeId: number) {
  return getDb()
    .select()
    .from(directorContracts)
    .where(and(eq(directorContracts.employeeId, employeeId), eq(directorContracts.companyId, loadCompany().id)))
    .orderBy(desc(directorContracts.validFrom), desc(directorContracts.id))
    .all();
}

/** Every salary change grouped by person, oldest first. Used for the current salary in lists. */
export function salaryPeriodsByEmployee(): Map<number, SalaryPeriod[]> {
  const rows = getDb().select().from(salaryPeriods).orderBy(asc(salaryPeriods.validFrom)).all();
  const map = new Map<number, SalaryPeriod[]>();
  for (const row of rows) {
    const list = map.get(row.employeeId) ?? [];
    list.push({ validFrom: row.validFrom, grossMonthlyCents: row.grossMonthlyCents });
    map.set(row.employeeId, list);
  }
  return map;
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
  const periods = listSalaryPeriods(id);
  const currentSalaryCents = salaryForMonth(periods, employee.grossMonthlyCents, todayIso().slice(0, 7));
  let estimate: ContributionEstimate | null = null;
  let estimateError = "";
  try {
    estimate = estimateContributions(socialInput(employee, company, currentSalaryCents));
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
  return { employee, absences: absenceRows, postedMonths: postedPayrollMonths(id), estimate, estimateError, vacationUsed, company, salaryPeriods: periods, currentSalaryCents };
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

export function loadBankConnection(companyId = loadCompany().id) {
  return getDb()
    .select()
    .from(bankConnections)
    .where(and(eq(bankConnections.companyId, companyId), eq(bankConnections.provider, "qonto")))
    .get();
}

export function listBankAccounts(companyId = loadCompany().id) {
  return getDb()
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.companyId, companyId))
    .orderBy(desc(bankAccounts.main), asc(bankAccounts.status), asc(bankAccounts.name))
    .all();
}

export function listBankTransactions(companyId = loadCompany().id, from?: string, to?: string) {
  const conditions = [eq(bankTransactions.companyId, companyId)];
  if (from) conditions.push(gte(bankTransactions.bookedOn, from));
  if (to) conditions.push(lte(bankTransactions.bookedOn, to));
  return getDb()
    .select({
      id: bankTransactions.id,
      accountId: bankTransactions.accountId,
      accountName: bankAccounts.name,
      accountIban: bankAccounts.iban,
      externalRef: bankTransactions.externalRef,
      status: bankTransactions.status,
      side: bankTransactions.side,
      amountCents: bankTransactions.amountCents,
      currency: bankTransactions.currency,
      bookedOn: bankTransactions.bookedOn,
      settledAt: bankTransactions.settledAt,
      label: bankTransactions.label,
      counterpartyName: bankTransactions.counterpartyName,
      reference: bankTransactions.reference,
      note: bankTransactions.note,
      operationType: bankTransactions.operationType,
      subjectType: bankTransactions.subjectType,
      category: bankTransactions.category,
      cashflowCategory: bankTransactions.cashflowCategory,
      cashflowSubcategory: bankTransactions.cashflowSubcategory,
      vatAmountCents: bankTransactions.vatAmountCents,
      vatRateBps: bankTransactions.vatRateBps,
      cardLastDigits: bankTransactions.cardLastDigits,
      counterpartyIban: bankTransactions.counterpartyIban,
      counterpartyBic: bankTransactions.counterpartyBic,
      attachmentCount: bankTransactions.attachmentCount,
    })
    .from(bankTransactions)
    .innerJoin(bankAccounts, eq(bankAccounts.id, bankTransactions.accountId))
    .where(and(...conditions))
    .orderBy(desc(bankTransactions.bookedOn), desc(bankTransactions.settledAt), desc(bankTransactions.id))
    .limit(5000)
    .all();
}

export function listBankYears(companyId = loadCompany().id): number[] {
  return getDb()
    .select({ year: sql<string>`substr(${bankTransactions.bookedOn}, 1, 4)` })
    .from(bankTransactions)
    .where(eq(bankTransactions.companyId, companyId))
    .groupBy(sql`substr(${bankTransactions.bookedOn}, 1, 4)`)
    .all()
    .map((row) => Number(row.year))
    .filter((year) => Number.isInteger(year) && year >= 2000);
}
