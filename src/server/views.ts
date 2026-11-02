import "server-only";
import { CHART, ACCOUNTS, signedBalance } from "@/domain/accounts";
import { addDays, fiscalYearContaining, todayIso } from "@/domain/calendar";
import { reviewInvoice } from "@/domain/invoice";
import { XRECHNUNG_NUMBER_BLOCKER, reviewXRechnung } from "@/domain/xrechnung";
import { policyReminders } from "@/domain/obligations";
import { conversionGap, reserveDutyActive } from "@/domain/reserve";
import { balanceSheetTotals, summarizeProfit } from "@/domain/reporting";
import { kleinunternehmerAssessment, estimateCorporateTax } from "@/domain/tax";
import { durationMinutes, minimumVacationDays, timeWarnings, vacationShortfall } from "@/domain/time";
import { euroInput, quantityInput } from "@/components/amounts";
import {
  accountBalances,
  listCompliance,
  listCustomers,
  listDeadlines,
  listDocuments,
  listInvoices,
  listJournal,
  listObligations,
  listPeople,
  listPolicies,
  listReserveMovements,
  listResolutions,
  listTasks,
  listTime,
  loadCompany,
  loadInvoice,
  loadPerson,
  loadShareholders,
  signedAccount,
  vatPayableCents,
} from "./queries";
import { parseViewQuery, viewIsReady, type ViewName } from "./view-request";
import { toXRechnungInput } from "./xrechnung";

function sellerFrom(company: ReturnType<typeof loadCompany>) {
  return {
    legalName: company.legalName,
    street: company.street,
    postalCode: company.postalCode,
    city: company.city,
    taxNumber: company.taxNumber,
    vatId: company.vatId,
    registerCourt: company.registerCourt,
    registerNumber: company.registerNumber,
    managingDirector: company.managingDirector,
    iban: company.iban,
    bic: company.bic,
    email: company.email,
    phone: company.phone,
    country: company.country,
    kleinunternehmer: company.kleinunternehmer,
  };
}

function kleinSnapshot(company: ReturnType<typeof loadCompany>) {
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const currentYearTurnoverCents = summarizeProfit(accountBalances(`${year}-01-01`, today)).revenueCents;
  const assessment = kleinunternehmerAssessment({
    foundingDate: company.foundingDate,
    calendarYear: year,
    priorYearTurnoverCents: company.priorYearRevenueCents,
    currentYearTurnoverCents,
    claimsExemption: company.kleinunternehmer,
  });
  return {
    year,
    priorYearTurnoverCents: company.priorYearRevenueCents,
    currentYearTurnoverCents,
    ...assessment,
  };
}

function customerOptions() {
  return listCustomers().map((customer) => ({
    id: customer.id,
    name: customer.name,
    street: customer.street,
    postalCode: customer.postalCode,
    city: customer.city,
    country: customer.country,
    email: customer.email,
    vatId: customer.vatId,
    buyerReference: customer.buyerReference,
  }));
}

export function shellView() {
  const company = loadCompany();
  return { legalName: company.legalName, isSample: company.isSample };
}

export function deskView() {
  const company = loadCompany();
  const today = todayIso();
  const yearNumber = Number(today.slice(0, 4));
  const fy = fiscalYearContaining(today, company.fiscalYearStartMonth);
  const yearRows = accountBalances(fy.start, today);
  const profit = summarizeProfit(yearRows);
  const balances = accountBalances();
  const reserve = signedAccount(balances, ACCOUNTS.reserve);
  const gap = conversionGap(company.shareCapitalCents, reserve);
  const klein = kleinSnapshot(company);
  const horizon = addDays(today, 45);
  const dates = [...listObligations(yearNumber), ...listObligations(yearNumber + 1)]
    .filter((item) => item.status !== "done" && item.status !== "skipped" && item.dueDate <= horizon)
    .map((item) => ({ due: item.dueDate, title: item.title, href: "/obligations", tone: item.dueDate < today ? "overdue" : "open" }));
  for (const deadline of listDeadlines()) {
    if (deadline.status === "open" && deadline.dueDate <= horizon) {
      dates.push({ due: deadline.dueDate, title: deadline.title, href: "/obligations", tone: deadline.dueDate < today ? "overdue" : "open" });
    }
  }
  for (const reminder of policyReminders(listPolicies(), today)) {
    dates.push({ due: reminder.renewalDate, title: reminder.label, href: "/company", tone: reminder.overdue ? "overdue" : "open" });
  }
  dates.sort((a, b) => a.due.localeCompare(b.due));
  const week = listTime(today);
  const minutes = week.entries.reduce((sum, entry) => {
    try {
      return sum + durationMinutes(entry.startedAt, entry.endedAt, entry.breakMinutes);
    } catch {
      return sum;
    }
  }, 0);
  return {
    legalName: company.legalName,
    today,
    bankCents: signedAccount(balances, ACCOUNTS.bank),
    receivablesCents: signedAccount(balances, ACCOUNTS.receivables),
    profitBeforeTaxCents: profit.profitBeforeTaxCents,
    fyLabel: fy.label,
    gap,
    kleinNotes: klein.notes,
    invoices: listInvoices()
      .filter((invoice) => ["open", "overdue", "partial", "draft"].includes(invoice.displayStatus))
      .slice(0, 5)
      .map((invoice) => ({
        id: invoice.id,
        customerName: invoice.customerName,
        number: invoice.number,
        dueDate: invoice.dueDate,
        openCents: invoice.openCents,
        displayStatus: invoice.displayStatus,
      })),
    dates: dates.slice(0, 7),
    tasks: listTasks()
      .filter((task) => task.status !== "done")
      .slice(0, 5)
      .map((task) => ({ id: task.id, title: task.title, dueDate: task.dueDate, status: task.status })),
    weekStart: week.start,
    weekEnd: week.end,
    minutes,
  };
}

export function companyView() {
  const company = loadCompany();
  const holders = loadShareholders();
  const reserve = signedAccount(accountBalances(), ACCOUNTS.reserve);
  return {
    company,
    holders,
    shareBps: holders.reduce((sum, holder) => sum + holder.shareBps, 0),
    reserve,
    gap: conversionGap(company.shareCapitalCents, reserve),
    duty: reserveDutyActive(company.shareCapitalCents),
    klein: kleinSnapshot(company),
    today: todayIso(),
    movements: listReserveMovements(),
    policies: listPolicies(),
  };
}

export function invoicesView() {
  return { invoices: listInvoices(), customers: listCustomers() };
}

export function invoiceView(id: number) {
  const loaded = loadInvoice(id);
  if (!loaded) return null;
  const company = loadCompany();
  const { invoice, customer, lines } = loaded;
  const review = reviewInvoice({
    legalName: company.legalName,
    supplierStreet: company.street,
    supplierPostalCode: company.postalCode,
    supplierCity: company.city,
    taxNumber: company.taxNumber,
    vatId: company.vatId,
    registerCourt: company.registerCourt,
    registerNumber: company.registerNumber,
    managingDirector: company.managingDirector,
    iban: company.iban,
    customerName: customer.name,
    customerStreet: customer.street,
    customerPostalCode: customer.postalCode,
    customerCity: customer.city,
    issueDate: invoice.issueDate,
    serviceDate: invoice.serviceDate,
    lines: lines.map((line) => ({ description: line.description, quantityMilli: line.quantityMilli, netCents: line.netCents })),
    kleinunternehmer: Boolean(invoice.exemptionNote),
    exemptionNote: invoice.exemptionNote,
    vatCents: loaded.vatCents,
  });
  const fileBlockers = reviewXRechnung(toXRechnungInput(company, loaded)).blockers;
  const eInvoiceBlockers = loaded.invoice.status === "draft"
    ? fileBlockers.filter((item) => item !== XRECHNUNG_NUMBER_BLOCKER && !review.blockers.includes(item))
    : fileBlockers;
  return { ...loaded, blockers: review.blockers, eInvoiceBlockers, today: todayIso() };
}

export function invoiceNewView() {
  const company = loadCompany();
  return {
    seller: sellerFrom(company),
    customers: customerOptions(),
    today: todayIso(),
    termsDays: company.paymentTermsDays,
    defaultVatBps: company.defaultVatBps,
    draft: null,
  };
}

export function invoiceEditView(id: number) {
  const loaded = loadInvoice(id);
  if (!loaded) return { kind: "missing" as const };
  if (loaded.invoice.status !== "draft") return { kind: "issued" as const };
  const company = loadCompany();
  return {
    kind: "draft" as const,
    seller: sellerFrom(company),
    customers: customerOptions(),
    today: todayIso(),
    termsDays: company.paymentTermsDays,
    defaultVatBps: company.defaultVatBps,
    draft: {
      id: loaded.invoice.id,
      customerId: loaded.invoice.customerId,
      issueDate: loaded.invoice.issueDate,
      serviceDate: loaded.invoice.serviceDate,
      dueDate: loaded.invoice.dueDate,
      notes: loaded.invoice.notes,
      buyerReference: loaded.invoice.buyerReference,
      lines: loaded.lines.map((line) => ({
        description: line.description,
        quantity: quantityInput(line.quantityMilli),
        unitNet: euroInput(line.unitNetCents),
        vatBps: line.vatBps,
      })),
    },
  };
}

export function ledgerView(all: boolean) {
  const company = loadCompany();
  const today = todayIso();
  const fy = fiscalYearContaining(today, company.fiscalYearStartMonth);
  const period = accountBalances(fy.start, today);
  const profit = summarizeProfit(period);
  const rows = accountBalances();
  const tax = estimateCorporateTax(profit.profitBeforeTaxCents, company.hebesatzPercent, company.lossCarryforwardCents);
  const sheet = balanceSheetTotals(rows);
  const allProfit = summarizeProfit(rows);
  const visible = all ? rows : rows.filter((row) => row.debitCents !== 0 || row.creditCents !== 0);
  return {
    today,
    all,
    fy,
    profit,
    tax,
    hebesatzPercent: company.hebesatzPercent,
    equation: sheet.assetsCents - sheet.liabilitiesCents - sheet.equityCents - allProfit.profitAfterTaxCents,
    vat: vatPayableCents(rows),
    kleinunternehmer: company.kleinunternehmer,
    rows: visible.map((row) => ({
      code: row.code,
      name: row.name,
      debitCents: row.debitCents,
      creditCents: row.creditCents,
      signedCents: signedBalance(row.type, row.debitCents, row.creditCents),
    })),
    expenses: CHART.filter((account) => account.type === "expense").map((account) => ({ code: account.code, name: account.name })),
    accounts: CHART.map((account) => ({ code: account.code, name: account.name })),
    journal: listJournal(),
    bankCents: signedAccount(rows, ACCOUNTS.bank),
  };
}

export function peopleView() {
  return {
    people: listPeople().map(({ employee, estimate, estimateError }) => ({
      id: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      role: employee.role,
      kind: employee.kind,
      endDate: employee.endDate,
      grossMonthlyCents: employee.grossMonthlyCents,
      shortfall: vacationShortfall(employee.vacationDays, employee.workdaysPerWeek),
      estimateError,
      regime: estimate?.regime ?? "",
    })),
  };
}

export function personView(id: number) {
  const loaded = loadPerson(id);
  if (!loaded) return null;
  const { employee, estimate, estimateError, absences, postedMonths, vacationUsed, company } = loaded;
  return {
    employee,
    company: { stateCode: company.stateCode, additionalKvBps: company.additionalKvBps },
    estimate,
    estimateError,
    absences,
    postedMonths,
    vacationUsed,
    shortfall: vacationShortfall(employee.vacationDays, employee.workdaysPerWeek),
    minimumDays: minimumVacationDays(employee.workdaysPerWeek),
    today: todayIso(),
  };
}

export function timeView(anchor: string) {
  const week = listTime(anchor);
  const people = listPeople();
  const tasks = listTasks();
  const entries = week.entries.map((entry) => {
    let minutes = 0;
    let warnings: { level: "stop" | "watch"; message: string }[] = [];
    let error = "";
    try {
      minutes = durationMinutes(entry.startedAt, entry.endedAt, entry.breakMinutes);
      warnings = timeWarnings(minutes, entry.breakMinutes);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Check this entry.";
    }
    const person = people.find((item) => item.employee.id === entry.employeeId);
    return {
      id: entry.id,
      entryDate: entry.entryDate,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      breakMinutes: entry.breakMinutes,
      memo: entry.memo,
      billable: entry.billable,
      firstName: person?.employee.firstName ?? "",
      minutes,
      warnings,
      error,
    };
  });
  return {
    anchor,
    start: week.start,
    end: week.end,
    previous: addDays(week.start, -7),
    next: addDays(week.start, 7),
    entries,
    total: entries.reduce((sum, entry) => sum + (entry.error ? 0 : entry.minutes), 0),
    people: people.map((item) => ({ id: item.employee.id, firstName: item.employee.firstName, lastName: item.employee.lastName })),
    tasks,
  };
}

export function obligationsView(year: number) {
  const today = todayIso();
  const company = loadCompany();
  const items = listObligations(year);
  const due = items.filter((item) => item.status !== "done" && item.status !== "skipped" && item.dueDate <= today);
  return {
    year,
    today,
    kleinunternehmer: company.kleinunternehmer,
    usesTaxAdvisor: company.usesTaxAdvisor,
    reminders: policyReminders(listPolicies(), today),
    due,
    later: items.filter((item) => !due.includes(item)),
    deadlines: listDeadlines(),
  };
}

export function documentsView() {
  return { documents: listDocuments() };
}

export function legalView() {
  return { items: listCompliance(), resolutions: listResolutions(), today: todayIso() };
}

export function loadView(name: ViewName, params: URLSearchParams) {
  const query = parseViewQuery(params, todayIso());
  if (!viewIsReady(name, query)) return null;
  switch (name) {
    case "shell":
      return shellView();
    case "desk":
      return deskView();
    case "company":
      return companyView();
    case "invoices":
      return invoicesView();
    case "invoice":
      return invoiceView(query.id!);
    case "invoice-new":
      return invoiceNewView();
    case "invoice-edit": {
      const result = invoiceEditView(query.id!);
      return result.kind === "draft" ? result : null;
    }
    case "ledger":
      return ledgerView(query.all);
    case "people":
      return peopleView();
    case "person":
      return personView(query.id!);
    case "time":
      return timeView(query.week);
    case "obligations":
      return obligationsView(query.year);
    case "documents":
      return documentsView();
    case "legal":
      return legalView();
  }
}
