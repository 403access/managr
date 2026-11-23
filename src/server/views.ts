import "server-only";
import { CHART, ACCOUNTS, signedBalance } from "@/domain/accounts";
import { addDays, fiscalYearContaining, formatDate, todayIso } from "@/domain/calendar";
import { normalizeCustomerKind } from "@/domain/customers";
import { currentDirectorContract, reviewDirectorContract } from "@/domain/director-contract";
import { reviewDirectorSalary } from "@/domain/director-salary";
import { reviewFounderHealth } from "@/domain/founder-health";
import { reviewInvoice, compareInvoiceDates, resolveInvoiceLineGrouping, sortInvoicePositions } from "@/domain/invoice";
import { invoiceLetterFromInvoice } from "@/domain/invoice-letter";
import { activityQuantityMilli, invoiceLineDescription } from "@/domain/invoice-time";
import { XRECHNUNG_NUMBER_BLOCKER, reviewXRechnung } from "@/domain/xrechnung";
import { policyReminders } from "@/domain/obligations";
import { nextSalaryChange } from "@/domain/salary";
import { conversionGap, reserveDutyActive } from "@/domain/reserve";
import { balanceSheetTotals, summarizeProfit } from "@/domain/reporting";
import { addWork, emptyWorkTotals, isProductiveTaskType, monthlyWork, projectCounts, sharePercent, taskTypeMinutes, workTotals, type WorkTotals } from "@/domain/analytics";
import { flowShareBps, moneyFlow } from "@/domain/money-flow";
import { bankPeriodSummary, bankTotals, maskSecret } from "@/domain/bank";
import { analyzeMilestones, analyzeMilestonesByCompany, milestoneIsOverdue, milestoneProgress, milestoneYears, sortMilestones } from "@/domain/milestones";
import { buildOrgChart } from "@/domain/org";
import { kleinunternehmerAssessment, estimateCorporateTax } from "@/domain/tax";
import {
  checkSummary,
  filingKindsFor,
  filingPeriod,
  filingPeriods,
  formatPeriod,
  isAnnualKind,
  isEditable,
  isSubmitted,
  nextStatuses,
  obligationKeyFor,
  type TaxFilingKind,
  type TaxFilingStatus,
} from "@/domain/tax-filing";
import { daySpan, durationMinutes, minimumVacationDays, resolveTimeRange, timeWarnings, vacationShortfall, weekStart } from "@/domain/time";
import { effectiveHourlyRate, timeValueCents } from "@/domain/rates";
import { euroInput, quantityInput } from "@/components/amounts";
import { formatEuro, formatPercentBps } from "@/domain/money";
import {
  accountBalances,
  billedTimeActivityIds,
  getFounderHealth,
  listBankAccounts,
  listBankTransactions,
  listBankYears,
  listCompliance,
  listCashMovements,
  listCustomers,
  listDeadlines,
  listDirectorContracts,
  listDocuments,
  listInvoices,
  listInvoiceTemplates,
  listJournal,
  listMilestones,
  listObligations,
  listOrgMembers,
  listPeople,
  listPolicies,
  listProjects,
  listReserveMovements,
  listResolutions,
  listShareholderLoans,
  listTasks,
  listTime,
  listTimeActivities,
  listTimeInRange,
  listCompanies,
  listContacts,
  timeEntryDates,
  loadBankConnection,
  loadCompany,
  loadInvoice,
  loadPerson,
  loadShareholders,
  readUiSettings,
  signedAccount,
  vatPayableCents,
} from "./queries";
import {
  getElsterSettings,
  listFilingEvents,
  listFilingTransmissions,
  listTaxFilings,
  loadTaxFiling,
  parseChecks,
  parseFigures,
} from "./tax-filings";
import { parseViewQuery, viewIsReady, type ViewName } from "./view-request";
import { toXRechnungInput } from "./xrechnung";

function sellerFrom(company: ReturnType<typeof loadCompany>) {
  return {
    legalName: company.legalName,
    legalForm: company.legalForm,
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
    bankName: company.bankName,
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

function customerOptions(companyId = loadCompany().id) {
  return listCustomers(companyId).map((customer) => ({
    id: customer.id,
    kind: normalizeCustomerKind(customer.kind),
    name: customer.name,
    street: customer.street,
    postalCode: customer.postalCode,
    city: customer.city,
    country: customer.country,
    email: customer.email,
    website: customer.website,
    vatId: customer.vatId,
    buyerReference: customer.buyerReference,
  }));
}

export function shellView() {
  const company = loadCompany();
  return {
    legalName: company.legalName,
    legalForm: company.legalForm,
    isSample: company.isSample,
    activeCompanyId: company.id,
    companies: listCompanies().map((item) => ({ id: item.id, legalName: item.legalName, legalForm: item.legalForm })),
    settings: readUiSettings(),
  };
}

export function settingsView() {
  return {
    settings: readUiSettings(),
    hourlyRateCents: loadCompany().hourlyRateCents,
    templates: listInvoiceTemplates(),
  };
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
  const analytics = analyticsView(yearNumber);
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
    analytics: {
      minutes: analytics.totals.minutes,
      productiveShare: analytics.productiveShare,
      billableMinutes: analytics.totals.billableMinutes,
      projectCounts: analytics.projectCounts,
      projectRows: analytics.projectRows.filter((row) => !row.unassigned).slice(0, 3),
      typeRows: analytics.typeRows.slice(0, 3),
      deliverables: analytics.deliverables.length,
      openDeliverables: analytics.openDeliverables.length,
    },
  };
}

export function companyView() {
  const company = loadCompany();
  const holders = loadShareholders();
  const balances = accountBalances();
  const reserve = signedAccount(balances, ACCOUNTS.reserve);
  const loans = listShareholderLoans();
  return {
    company,
    holders,
    shareBps: holders.reduce((sum, holder) => sum + holder.shareBps, 0),
    companies: listCompanies().map((item) => ({ id: item.id, legalName: item.legalName, legalForm: item.legalForm, isActive: item.isActive })),
    reserve,
    retained: signedAccount(balances, ACCOUNTS.retained),
    shareholdersPayable: signedAccount(balances, ACCOUNTS.shareholdersPayable),
    loans,
    loanTotalCents: loans.reduce((sum, loan) => sum + loan.outstandingCents, 0),
    gap: conversionGap(company.shareCapitalCents, reserve),
    duty: reserveDutyActive(company.shareCapitalCents),
    klein: kleinSnapshot(company),
    today: todayIso(),
    movements: listReserveMovements(),
    policies: listPolicies(),
  };
}

export function invoicesView() {
  return { invoices: listInvoices() };
}

type CustomerTotals = {
  projectCount: number;
  minutes: number;
  billableMinutes: number;
  billableValueCents: number;
  invoiceCount: number;
  revenueCents: number;
  openCents: number;
  lastActivity: string | null;
};

function emptyCustomerTotals(): CustomerTotals {
  return { projectCount: 0, minutes: 0, billableMinutes: 0, billableValueCents: 0, invoiceCount: 0, revenueCents: 0, openCents: 0, lastActivity: null };
}

function latestDate(current: string | null, candidate: string | null): string | null {
  if (!candidate) return current;
  return !current || candidate > current ? candidate : current;
}

/** Projects, booked time, and invoiced totals keyed by customer. */
function customerTotals(): Map<number, CustomerTotals> {
  const company = loadCompany();
  const projects = listProjects();
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const customerById = new Map(listCustomers(company.id).map((customer) => [customer.id, customer]));
  const taskProject = new Map(listTasks().map((task) => [task.id, task.projectId]));
  const totals = new Map<number, CustomerTotals>();
  const bucket = (customerId: number | null): CustomerTotals | null => {
    if (customerId === null) return null;
    const existing = totals.get(customerId);
    if (existing) return existing;
    const created = emptyCustomerTotals();
    totals.set(customerId, created);
    return created;
  };

  for (const project of projects) {
    const row = bucket(project.customerId);
    if (!row) continue;
    row.projectCount += 1;
    row.lastActivity = latestDate(row.lastActivity, project.endedOn ?? project.startedOn);
  }

  for (const entry of listTimeInRange("0001-01-01", "9999-12-31")) {
    const projectId = entry.projectId ?? (entry.taskId === null ? null : taskProject.get(entry.taskId) ?? null);
    const project = projectId === null ? null : projectById.get(projectId) ?? null;
    const row = bucket(project?.customerId ?? null);
    if (!row) continue;
    const minutes = timeEntryMinutes(entry);
    if (minutes > 0) {
      row.minutes += minutes;
      if (entry.billable) {
        row.billableMinutes += minutes;
        const rate = effectiveHourlyRate({
          entryCents: entry.hourlyRateCents,
          projectCents: project?.hourlyRateCents ?? null,
          customerCents: project?.customerId == null ? null : customerById.get(project.customerId)?.hourlyRateCents ?? null,
          globalCents: company.hourlyRateCents,
        });
        if (rate) row.billableValueCents += timeValueCents(minutes, rate.cents);
      }
    }
    row.lastActivity = latestDate(row.lastActivity, entry.entryDate);
  }

  for (const invoice of listInvoices()) {
    if (invoice.status === "void" || invoice.status === "draft") continue;
    const row = bucket(invoice.customerId);
    if (!row) continue;
    row.invoiceCount += 1;
    row.revenueCents += invoice.grossCents;
    row.openCents += invoice.openCents;
    row.lastActivity = latestDate(row.lastActivity, invoice.issueDate);
  }

  return totals;
}

export function customersView() {
  const company = loadCompany();
  const totals = customerTotals();
  return {
    customers: listCustomers(company.id).map((customer) => ({
      ...customer,
      ...(totals.get(customer.id) ?? emptyCustomerTotals()),
    })),
  };
}

export function customerView(id: number) {
  const company = loadCompany();
  const customer = listCustomers(company.id).find((item) => item.id === id);
  if (!customer) return null;

  const projects = listProjects(company.id).filter((project) => project.customerId === id);
  const projectIds = new Set(projects.map((project) => project.id));
  const tasks = listTasks();
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const people = listOrgMembers();
  const personById = new Map(people.map((person) => [person.id, `${person.firstName} ${person.lastName}`.trim()]));
  const allContacts = listContacts(company.id, true);
  const contactById = new Map(allContacts.map((person) => [person.id, `${person.firstName} ${person.lastName}`.trim()]));

  const allEntries = listTimeInRange("0001-01-01", "9999-12-31");
  const activitiesByEntry = new Map<number, string[]>();
  for (const activity of listTimeActivities(allEntries.map((entry) => entry.id))) {
    const list = activitiesByEntry.get(activity.timeEntryId);
    if (list) list.push(activity.description);
    else activitiesByEntry.set(activity.timeEntryId, [activity.description]);
  }

  const entries = allEntries
    .flatMap((entry) => {
      const projectId = entry.projectId ?? (entry.taskId === null ? null : taskById.get(entry.taskId)?.projectId ?? null);
      if (projectId === null || !projectIds.has(projectId)) return [];
      const project = projects.find((item) => item.id === projectId);
      const minutes = timeEntryMinutes(entry);
      const rate = effectiveHourlyRate({
        entryCents: entry.hourlyRateCents,
        projectCents: project?.hourlyRateCents ?? null,
        customerCents: customer.hourlyRateCents,
        globalCents: company.hourlyRateCents,
      });
      return [{
        id: entry.id,
        entryDate: entry.entryDate,
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        memo: entry.memo,
        activities: activitiesByEntry.get(entry.id) ?? [],
        billable: entry.billable,
        taskType: entry.taskType,
        projectId,
        projectName: project?.name ?? "",
        employeeName:
          entry.employeeId !== null
            ? personById.get(entry.employeeId) ?? ""
            : entry.contactId !== null
              ? contactById.get(entry.contactId) ?? ""
              : "",
        minutes,
        rate,
        valueCents: rate ? timeValueCents(minutes, rate.cents) : 0,
      }];
    })
    .sort((left, right) => right.entryDate.localeCompare(left.entryDate) || right.startedAt.localeCompare(left.startedAt));

  const projectRows = projects.map((project) => {
    const projectEntries = entries.filter((entry) => entry.projectId === project.id);
    const projectTasks = tasks.filter((task) => task.projectId === project.id);
    const minutes = projectEntries.reduce((sum, entry) => sum + entry.minutes, 0);
    const effectiveRate = effectiveHourlyRate({
      projectCents: project.hourlyRateCents,
      customerCents: customer.hourlyRateCents,
      globalCents: company.hourlyRateCents,
    });
    return {
      ...project,
      minutes,
      billableMinutes: projectEntries.reduce((sum, entry) => sum + (entry.billable ? entry.minutes : 0), 0),
      effectiveRate,
      valueCents: projectEntries.reduce((sum, entry) => sum + entry.valueCents, 0),
      taskCount: projectTasks.length,
      openTasks: projectTasks.filter((task) => task.status !== "done").length,
      openDeliverables: projectTasks.filter((task) => task.deliverable && task.status !== "done").length,
    };
  });

  const invoices = listInvoices().filter((invoice) => invoice.customerId === id);
  const bookedInvoices = invoices.filter((invoice) => invoice.status !== "void" && invoice.status !== "draft");
  const totals: CustomerTotals = {
    projectCount: projects.length,
    minutes: entries.reduce((sum, entry) => sum + entry.minutes, 0),
    billableMinutes: entries.reduce((sum, entry) => sum + (entry.billable ? entry.minutes : 0), 0),
    billableValueCents: entries.reduce((sum, entry) => sum + (entry.billable ? entry.valueCents : 0), 0),
    invoiceCount: bookedInvoices.length,
    revenueCents: bookedInvoices.reduce((sum, invoice) => sum + invoice.grossCents, 0),
    openCents: bookedInvoices.reduce((sum, invoice) => sum + invoice.openCents, 0),
    lastActivity: latestDate(
      latestDate(
        projects.reduce<string | null>((latest, project) => latestDate(latest, project.endedOn ?? project.startedOn), null),
        entries.reduce<string | null>((latest, entry) => latestDate(latest, entry.entryDate), null),
      ),
      bookedInvoices.reduce<string | null>((latest, invoice) => latestDate(latest, invoice.issueDate), null),
    ),
  };

  return {
    customer,
    totals,
    contacts: allContacts.filter((person) => person.customerId === id && person.deletedAt === null),
    projects: projectRows,
    entries,
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      displayStatus: invoice.displayStatus,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      grossCents: invoice.grossCents,
      openCents: invoice.openCents,
    })),
    today: todayIso(),
  };
}

export function invoiceView(id: number) {
  const loaded = loadInvoice(id);
  if (!loaded) return null;
  const company = loaded.company;
  const { invoice, customer, lines } = loaded;
  const review = reviewInvoice({
    legalName: company.legalName,
    legalForm: company.legalForm,
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
  const eInvoiceNotApplicable = normalizeCustomerKind(customer.kind) === "private";
  const fileBlockers = reviewXRechnung(toXRechnungInput(company, loaded)).blockers;
  const eInvoiceBlockers = eInvoiceNotApplicable
    ? []
    : loaded.invoice.status === "draft"
      ? fileBlockers.filter((item) => item !== XRECHNUNG_NUMBER_BLOCKER && !review.blockers.includes(item))
      : fileBlockers;
  const effectiveLineGrouping = resolveInvoiceLineGrouping(invoice.lineGrouping, readUiSettings().invoiceLineGrouping);
  return { ...loaded, blockers: review.blockers, eInvoiceBlockers, eInvoiceNotApplicable, effectiveLineGrouping, today: todayIso() };
}

export type InvoiceTimeActivity = {
  id: number;
  timeEntryId: number;
  customerId: number;
  entryDate: string;
  projectName: string;
  description: string;
  lineDescription: string;
  quantity: string;
  unitNet: string;
  hourlyRateCents: number | null;
  vatBps: number;
};

/**
 * The billable activities of a customer's time entries that no live invoice
 * carries yet. Each activity becomes one invoice line; the entry's duration is
 * split evenly across the entry's activities.
 */
function invoiceTimeActivities(invoiceId: number | null): InvoiceTimeActivity[] {
  const company = loadCompany();
  const billed = new Set(billedTimeActivityIds(invoiceId));
  const entries = listTimeInRange("0001-01-01", "9999-12-31").filter((entry) => entry.billable);
  if (entries.length === 0) return [];

  const activities = listTimeActivities(entries.map((entry) => entry.id));
  const activitiesByEntry = new Map<number, typeof activities>();
  for (const activity of activities) {
    const list = activitiesByEntry.get(activity.timeEntryId);
    if (list) list.push(activity);
    else activitiesByEntry.set(activity.timeEntryId, [activity]);
  }

  const projectById = new Map(listProjects(company.id).map((project) => [project.id, project]));
  const taskProjectId = new Map(listTasks().map((task) => [task.id, task.projectId]));
  const customerById = new Map(listCustomers(company.id).map((customer) => [customer.id, customer]));
  const order = readUiSettings().invoiceLineOrder;

  return entries
    .flatMap((entry) => {
      const entryActivities = activitiesByEntry.get(entry.id) ?? [];
      if (entryActivities.length === 0) return [];
      const projectId = entry.projectId ?? (entry.taskId === null ? null : taskProjectId.get(entry.taskId) ?? null);
      const project = projectId === null ? null : projectById.get(projectId) ?? null;
      const customerId = project?.customerId ?? null;
      if (customerId === null) return [];
      let minutes: number;
      try {
        minutes = durationMinutes(entry.startedAt, entry.endedAt, entry.breakMinutes);
      } catch {
        return [];
      }
      if (minutes <= 0) return [];
      const rate = effectiveHourlyRate({
        entryCents: entry.hourlyRateCents,
        projectCents: project?.hourlyRateCents ?? null,
        customerCents: customerById.get(customerId)?.hourlyRateCents ?? null,
        globalCents: company.hourlyRateCents,
      });
      const quantities = activityQuantityMilli(minutes, entryActivities.length);
      return entryActivities.map((activity, index) => ({
        id: activity.id,
        timeEntryId: entry.id,
        customerId,
        entryDate: entry.entryDate,
        projectName: project?.name ?? "",
        description: activity.description,
        lineDescription: invoiceLineDescription(project?.name ?? "", activity.description),
        quantity: quantityInput(quantities[index]),
        unitNet: rate ? euroInput(rate.cents) : "",
        hourlyRateCents: rate?.cents ?? null,
        vatBps: company.kleinunternehmer ? 0 : company.defaultVatBps,
      }));
    })
    .filter((activity) => !billed.has(activity.id))
    .sort(
      (left, right) =>
        compareInvoiceDates(left.entryDate, right.entryDate, order) ||
        left.projectName.localeCompare(right.projectName, "de") ||
        left.description.localeCompare(right.description, "de"),
    );
}

export function invoiceNewView() {
  const company = loadCompany();
  return {
    seller: sellerFrom(company),
    customers: customerOptions(),
    timeActivities: invoiceTimeActivities(null),
    templates: listInvoiceTemplates(company.id),
    today: todayIso(),
    termsDays: company.paymentTermsDays,
    defaultVatBps: company.defaultVatBps,
    defaultLineGrouping: readUiSettings().invoiceLineGrouping,
    amountDisplay: "net" as const,
    draft: null,
  };
}

export function invoiceEditView(id: number) {
  const loaded = loadInvoice(id);
  if (!loaded) return { kind: "missing" as const };
  if (loaded.invoice.status !== "draft") return { kind: "issued" as const };
  const company = loaded.company;
  const order = readUiSettings().invoiceLineOrder;
  const lineGrouping: "none" | "date" | null =
    loaded.invoice.lineGrouping === "none" || loaded.invoice.lineGrouping === "date" ? loaded.invoice.lineGrouping : null;
  const entryDates = timeEntryDates(
    loaded.lines.map((line) => line.timeEntryId).filter((entryId): entryId is number => entryId !== null),
  );
  return {
    kind: "draft" as const,
    seller: sellerFrom(company),
    customers: customerOptions(company.id),
    timeActivities: invoiceTimeActivities(loaded.invoice.id),
    templates: listInvoiceTemplates(company.id),
    today: todayIso(),
    termsDays: company.paymentTermsDays,
    defaultVatBps: company.defaultVatBps,
    defaultLineGrouping: readUiSettings().invoiceLineGrouping,
    draft: {
      id: loaded.invoice.id,
      customerId: loaded.invoice.customerId,
      issueDate: loaded.invoice.issueDate,
      serviceDate: loaded.invoice.serviceDate,
      dueDate: loaded.invoice.dueDate,
      notes: loaded.invoice.notes,
      buyerReference: loaded.invoice.buyerReference,
      amountDisplay: loaded.invoice.amountDisplay,
      lineGrouping,
      letter: invoiceLetterFromInvoice(loaded.invoice),
      lines: sortInvoicePositions(
        loaded.lines.map((line) => ({
          description: line.description,
          quantity: quantityInput(line.quantityMilli),
          unitNet: euroInput(line.unitNetCents),
          vatBps: line.vatBps,
          timeEntryId: line.timeEntryId,
          timeActivityId: line.timeActivityId,
          entryDate: line.timeEntryId === null ? null : entryDates.get(line.timeEntryId) ?? null,
        })),
        order,
      ),
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

export function orgView() {
  const today = todayIso();
  return { today, ...buildOrgChart(listOrgMembers(), today) };
}

/** The People screen: the employment list with the org chart above it. */
export function peoplePageView() {
  return { ...peopleView(), org: orgView() };
}

export function personView(id: number) {
  const loaded = loadPerson(id);
  if (!loaded) return null;
  const { employee, estimate, estimateError, absences, postedMonths, vacationUsed, company, salaryPeriods, currentSalaryCents } = loaded;
  const holders = loadShareholders();
  const shareholder = employee.shareholderId === null ? null : holders.find((holder) => holder.id === employee.shareholderId) ?? null;
  const colleagues = listOrgMembers()
    .filter((member) => member.id !== id)
    .map((member) => ({ id: member.id, name: `${member.firstName} ${member.lastName}`, role: member.role }));
  const salaryResolutionDates = listResolutions()
    .filter((resolution) => resolution.kind === "salary" && resolution.employeeId === employee.id)
    .map((resolution) => resolution.resolvedOn)
    .sort();
  const salaryResolutionDate = salaryResolutionDates[0] ?? null;
  const contracts = listDirectorContracts(employee.id);
  const currentContract = currentDirectorContract(contracts, todayIso());
  const founderHealthCover = getFounderHealth(employee.id);
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
    salaryPeriods,
    currentSalaryCents,
    nextChange: nextSalaryChange(salaryPeriods, todayIso().slice(0, 7)),
    shareholders: holders.map((holder) => ({ id: holder.id, name: holder.name, shareBps: holder.shareBps })),
    colleagues,
    shareholder,
    contracts,
    currentContract,
    founderHealth: founderHealthCover,
    healthReview: reviewFounderHealth({
      kind: employee.kind,
      ownershipBps: employee.ownershipBps,
      cover: founderHealthCover,
      startDate: employee.startDate,
      today: todayIso(),
    }),
    salaryResolutionDate,
    contractReview: reviewDirectorContract({
      kind: employee.kind,
      ownershipBps: employee.ownershipBps,
      contract: currentContract,
      employeeGrossCents: currentSalaryCents,
      salaryResolutionDates,
      salaryChanges: salaryPeriods.map((period) => ({ validFrom: period.validFrom, grossMonthlyCents: period.grossMonthlyCents })),
    }),
    directorReview: reviewDirectorSalary({
      kind: employee.kind,
      ownershipBps: employee.ownershipBps,
      shareholderLinked: shareholder !== null,
      salaryResolutionDate,
      startDate: employee.startDate,
      grossMonthlyCents: currentSalaryCents,
    }),
    shareholderPayableCents: signedAccount(accountBalances(), ACCOUNTS.shareholdersPayable),
    today: todayIso(),
  };
}

export function projectsView() {
  const company = loadCompany();
  const projects = listProjects(company.id);
  const customers = listCustomers(company.id);
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const tasks = listTasks();
  const entries = listTimeInRange("0001-01-01", "9999-12-31");
  const totalsByProject = new Map<number, WorkTotals>();
  const valueByProject = new Map<number, number>();
  for (const entry of entries) {
    if (entry.projectId === null) continue;
    const totals = totalsByProject.get(entry.projectId) ?? emptyWorkTotals();
    const minutes = timeEntryMinutes(entry);
    if (minutes > 0) {
      addWork(totals, minutes, entry.taskType, entry.billable);
      const project = projectById.get(entry.projectId);
      const rate = effectiveHourlyRate({
        entryCents: entry.hourlyRateCents,
        projectCents: project?.hourlyRateCents ?? null,
        customerCents: project?.customerId == null ? null : customerById.get(project.customerId)?.hourlyRateCents ?? null,
        globalCents: company.hourlyRateCents,
      });
      if (rate) valueByProject.set(entry.projectId, (valueByProject.get(entry.projectId) ?? 0) + timeValueCents(minutes, rate.cents));
    }
    totalsByProject.set(entry.projectId, totals);
  }
  return {
    today: todayIso(),
    globalHourlyRateCents: company.hourlyRateCents,
    projects: projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id);
      const minutes = totalsByProject.get(project.id)?.minutes ?? 0;
      const customerRate = project.customerId === null ? null : customerById.get(project.customerId)?.hourlyRateCents ?? null;
      const effectiveRate = effectiveHourlyRate({
        projectCents: project.hourlyRateCents,
        customerCents: customerRate,
        globalCents: company.hourlyRateCents,
      });
      return {
        ...project,
        minutes,
        effectiveRate,
        valueCents: valueByProject.get(project.id) ?? 0,
        taskCount: projectTasks.length,
        openTasks: projectTasks.filter((task) => task.status !== "done").length,
        deliverables: projectTasks.filter((task) => task.deliverable && task.status === "done").length,
        openDeliverables: projectTasks.filter((task) => task.deliverable && task.status !== "done").length,
      };
    }),
    customers: customers.map((customer) => ({ id: customer.id, name: customer.name, hourlyRateCents: customer.hourlyRateCents })),
  };
}

function timeEntryMinutes(entry: { startedAt: string; endedAt: string; breakMinutes: number }): number {
  try {
    return durationMinutes(entry.startedAt, entry.endedAt, entry.breakMinutes);
  } catch {
    return 0;
  }
}

export function analyticsView(year: number, customerId: number | null = null) {
  const company = loadCompany();
  const today = todayIso();
  const allProjects = listProjects(company.id);
  const allCustomers = listCustomers(company.id);
  const tasks = listTasks();
  const people = listPeople();
  const contacts = listContacts(company.id, true);
  const projectById = new Map(allProjects.map((project) => [project.id, project]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const employeeById = new Map(people.map(({ employee }) => [employee.id, employee]));
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const customer = customerId === null ? null : allCustomers.find((item) => item.id === customerId) ?? null;
  const projects = customerId === null ? allProjects : allProjects.filter((project) => project.customerId === customerId);
  const projectIdsInScope = new Set(projects.map((project) => project.id));
  const invoices = listInvoices().filter((invoice) => invoice.issueDate.startsWith(`${year}-`) && invoice.status !== "void" && invoice.status !== "draft");

  const work: { month: string; minutes: number; taskType: string; billable: boolean; projectId: number | null; employeeId: number | null; contactId: number | null }[] = [];
  for (const entry of listTimeInRange(`${year}-01-01`, `${year}-12-31`)) {
    const task = entry.taskId === null ? null : taskById.get(entry.taskId) ?? null;
    const projectId = entry.projectId ?? task?.projectId ?? null;
    const project = projectId === null ? null : projectById.get(projectId) ?? null;
    if (customerId !== null && (!project || project.customerId !== customerId)) continue;
    const taskType = entry.taskType !== "other" ? entry.taskType : task?.taskType ?? entry.taskType;
    const minutes = timeEntryMinutes(entry);
    if (minutes <= 0) continue;
    work.push({
      month: entry.entryDate.slice(0, 7),
      minutes,
      taskType,
      billable: entry.billable,
      projectId,
      employeeId: entry.employeeId,
      contactId: entry.contactId,
    });
  }

  const projectWork = new Map<string, WorkTotals & { projectId: number | null; minutes: number }>();
  const personWork = new Map<string, WorkTotals & { employeeId: number | null; contactId: number | null; projectIds: Set<number> }>();
  const customerWork = new Map<number, WorkTotals>();
  for (const row of work) {
    const project = row.projectId === null ? null : projectById.get(row.projectId) ?? null;
    const projectKey = String(row.projectId ?? "none");
    const projectTotals = projectWork.get(projectKey) ?? { ...emptyWorkTotals(), projectId: row.projectId, minutes: 0 };
    addWork(projectTotals, row.minutes, row.taskType, row.billable);
    projectWork.set(projectKey, projectTotals);

    const personKey = row.employeeId !== null ? `employee:${row.employeeId}` : row.contactId !== null ? `contact:${row.contactId}` : "none";
    const personTotals = personWork.get(personKey) ?? { ...emptyWorkTotals(), employeeId: row.employeeId, contactId: row.contactId, projectIds: new Set<number>() };
    addWork(personTotals, row.minutes, row.taskType, row.billable);
    if (row.projectId !== null) personTotals.projectIds.add(row.projectId);
    personWork.set(personKey, personTotals);

    if (project?.customerId !== null && project?.customerId !== undefined) {
      const totals = customerWork.get(project.customerId) ?? emptyWorkTotals();
      addWork(totals, row.minutes, row.taskType, row.billable);
      customerWork.set(project.customerId, totals);
    }
  }

  const projectRows = [...projectWork.values()]
    .map((totals) => {
      const project = totals.projectId === null ? null : projectById.get(totals.projectId) ?? null;
      return {
        ...totals,
        name: project?.name ?? "",
        customerId: project?.customerId ?? null,
        customerName: project?.customerName ?? "",
        status: project?.status ?? "",
        unassigned: project === null,
      };
    })
    .sort((a, b) => b.minutes - a.minutes);

  const peopleRows = [...personWork.values()]
    .map((totals) => {
      const employee = totals.employeeId === null ? null : employeeById.get(totals.employeeId) ?? null;
      const contact = totals.contactId === null ? null : contactById.get(totals.contactId) ?? null;
      return {
        employeeId: totals.employeeId,
        contactId: totals.contactId,
        kind: totals.employeeId !== null ? "employee" : totals.contactId !== null ? "contact" : "none",
        firstName: employee?.firstName ?? contact?.firstName ?? "",
        lastName: employee?.lastName ?? contact?.lastName ?? "",
        role: employee?.role ?? contact?.role ?? "",
        customerId: contact?.customerId ?? null,
        customerName: contact?.customerName ?? "",
        projectCount: totals.projectIds.size,
        minutes: totals.minutes,
        productiveMinutes: totals.productiveMinutes,
        unproductiveMinutes: totals.unproductiveMinutes,
        billableMinutes: totals.billableMinutes,
        productiveShare: sharePercent(totals.productiveMinutes, totals.minutes),
      };
    })
    .sort((a, b) => b.minutes - a.minutes);

  const customerRows = allCustomers
    .filter((item) => customerId === null || item.id === customerId)
    .map((item) => {
      const totals = customerWork.get(item.id) ?? emptyWorkTotals();
      const invoicedCents = invoices.filter((invoice) => invoice.customerId === item.id).reduce((sum, invoice) => sum + invoice.grossCents, 0);
      return {
        customerId: item.id,
        name: item.name,
        projectCount: allProjects.filter((project) => project.customerId === item.id).length,
        minutes: totals.minutes,
        billableMinutes: totals.billableMinutes,
        productiveMinutes: totals.productiveMinutes,
        invoicedCents,
      };
    })
    .filter((row) => row.minutes > 0 || row.projectCount > 0 || row.invoicedCents > 0)
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));

  const taskCounts = new Map<string, number>();
  const scopedTasks = tasks.filter((task) => customerId === null || (task.projectId !== null && projectIdsInScope.has(task.projectId)));
  for (const task of scopedTasks) taskCounts.set(task.taskType, (taskCounts.get(task.taskType) ?? 0) + 1);
  const typeMinutes = taskTypeMinutes(work);
  const typeRows = [...new Set([...typeMinutes.map((row) => row.taskType), ...taskCounts.keys()])]
    .map((taskType) => {
      const found = typeMinutes.find((row) => row.taskType === taskType);
      return {
        taskType,
        minutes: found?.minutes ?? 0,
        productive: found?.productive ?? isProductiveTaskType(taskType),
        taskCount: taskCounts.get(taskType) ?? 0,
      };
    })
    .filter((row) => row.minutes > 0 || row.taskCount > 0)
    .sort((a, b) => b.minutes - a.minutes || a.taskType.localeCompare(b.taskType));

  const completionDate = (task: (typeof tasks)[number]) => task.completedAt ?? task.dueDate ?? "";
  const describeTask = (task: (typeof tasks)[number]) => {
    const project = task.projectId === null ? null : projectById.get(task.projectId) ?? null;
    return {
      id: task.id,
      title: task.title,
      taskType: task.taskType,
      dueDate: task.dueDate,
      completedAt: completionDate(task) || null,
      projectId: project?.id ?? null,
      projectName: project?.name ?? "",
      customerId: project?.customerId ?? null,
      customerName: project?.customerName ?? "",
    };
  };
  const scopedDeliverables = scopedTasks.filter((task) => task.deliverable);
  const deliverables = scopedDeliverables
    .filter((task) => task.status === "done" && (completionDate(task) === "" || completionDate(task).startsWith(`${year}-`)))
    .map(describeTask)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const openDeliverables = scopedDeliverables
    .filter((task) => task.status !== "done")
    .map(describeTask)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

  const totals = workTotals(work);
  return {
    year,
    today,
    company: { id: company.id, legalName: company.legalName, city: company.city },
    customer: customer ? { id: customer.id, name: customer.name, email: customer.email, city: customer.city } : null,
    totals,
    productiveShare: sharePercent(totals.productiveMinutes, totals.minutes),
    billableShare: sharePercent(totals.billableMinutes, totals.minutes),
    projectCounts: projectCounts(projects, year),
    projectRows,
    months: monthlyWork(work, year),
    typeRows,
    peopleRows,
    customerRows,
    deliverables,
    openDeliverables,
    taskCount: scopedTasks.length,
    openTaskCount: scopedTasks.filter((task) => task.status !== "done").length,
  };
}

function timeViewForRange(start: string, end: string, anchor: string) {
  const company = loadCompany();
  const people = listPeople();
  const allContacts = listContacts(company.id, true);
  const contacts = allContacts.filter((contact) => contact.deletedAt === null);
  const contactById = new Map(allContacts.map((contact) => [contact.id, contact]));
  const tasks = listTasks();
  const projects = listProjects();
  const customers = listCustomers(company.id);
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const projectFor = (id: number | null) => (id === null ? null : projectById.get(id) ?? null);
  const storedEntries = listTimeInRange(start, end);
  const activitiesByEntry = new Map<number, string[]>();
  for (const activity of listTimeActivities(storedEntries.map((entry) => entry.id))) {
    const list = activitiesByEntry.get(activity.timeEntryId);
    if (list) list.push(activity.description);
    else activitiesByEntry.set(activity.timeEntryId, [activity.description]);
  }
  const entries = storedEntries.map((entry) => {
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
    const contact = entry.contactId === null ? null : contactById.get(entry.contactId) ?? null;
    const project = projectFor(entry.projectId);
    const customer = project?.customerId == null ? null : customerById.get(project.customerId) ?? null;
    const effectiveRate = effectiveHourlyRate({
      entryCents: entry.hourlyRateCents,
      projectCents: project?.hourlyRateCents ?? null,
      customerCents: customer?.hourlyRateCents ?? null,
      globalCents: company.hourlyRateCents,
    });
    return {
      id: entry.id,
      entryDate: entry.entryDate,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      breakMinutes: entry.breakMinutes,
      memo: entry.memo,
      activities: activitiesByEntry.get(entry.id) ?? [],
      billable: entry.billable,
      taskId: entry.taskId,
      employeeId: entry.employeeId,
      contactId: entry.contactId,
      contactName: contact ? `${contact.firstName} ${contact.lastName}`.trim() : "",
      contactCustomerId: contact?.customerId ?? null,
      contactCustomerName: contact?.customerName ?? "",
      projectId: entry.projectId,
      projectName: project?.name ?? "",
      customerId: project?.customerId ?? null,
      customerName: project?.customerName ?? "",
      taskType: entry.taskType,
      firstName: person?.employee.firstName ?? contact?.firstName ?? "",
      personName: person
        ? `${person.employee.firstName} ${person.employee.lastName}`.trim()
        : contact
          ? `${contact.firstName} ${contact.lastName}`.trim()
          : "",
      minutes,
      warnings,
      error,
      hourlyRateCents: entry.hourlyRateCents,
      rate: effectiveRate,
      valueCents: effectiveRate && minutes > 0 ? timeValueCents(minutes, effectiveRate.cents) : 0,
    };
  });
  const span = daySpan(start, end);
  return {
    anchor,
    today: todayIso(),
    start,
    end,
    previous: addDays(start, -span),
    next: addDays(end, 1),
    entries,
    total: entries.reduce((sum, entry) => sum + (entry.error ? 0 : entry.minutes), 0),
    billableTotal: entries.reduce((sum, entry) => sum + (entry.error || !entry.billable ? 0 : entry.minutes), 0),
    billableValueCents: entries.reduce((sum, entry) => sum + (entry.error || !entry.billable ? 0 : entry.valueCents), 0),
    globalHourlyRateCents: company.hourlyRateCents,
    people: people.map((item) => ({ id: item.employee.id, firstName: item.employee.firstName, lastName: item.employee.lastName })),
    contacts: contacts.map((contact) => ({
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      role: contact.role,
      customerId: contact.customerId,
      customerName: contact.customerName ?? "",
    })),
    tasks: tasks.map((task) => ({ ...task, projectName: projectFor(task.projectId)?.name ?? "" })),
    projects: projects.map((project) => ({ id: project.id, name: project.name, customerId: project.customerId, customerName: project.customerName, hourlyRateCents: project.hourlyRateCents })),
  };
}

export function timeView(anchor: string) {
  const start = weekStart(anchor);
  return timeViewForRange(start, addDays(start, 6), anchor);
}

export function timeRangeView(from: string, to: string) {
  const today = todayIso();
  const range = resolveTimeRange(from, to, today);
  const anchor = range.from <= today && today <= range.to ? today : range.from;
  return timeViewForRange(range.from, range.to, anchor);
}

/** Just the number of entries per day, for marking busy days in the range calendar. */
export function timeDaysView(from: string, to: string) {
  const range = resolveTimeRange(from, to, todayIso());
  const days: Record<string, number> = {};
  for (const entry of listTimeInRange(range.from, range.to)) {
    days[entry.entryDate] = (days[entry.entryDate] ?? 0) + 1;
  }
  return { from: range.from, to: range.to, days };
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

function elsterPublic(companyId: number) {
  const settings = getElsterSettings(companyId);
  return {
    configured: Boolean(settings?.certificateName),
    environment: settings?.environment ?? "test",
    herstellerId: settings?.herstellerId ?? "",
    softwareName: settings?.softwareName ?? "managr",
    privacyAcknowledged: Boolean(settings?.privacyAcknowledgedAt),
    privacyAcknowledgedAt: settings?.privacyAcknowledgedAt ?? null,
    certificateName: settings?.certificateName ?? "",
    certificateValidUntil: settings?.certificateValidUntil ?? null,
    certificateFingerprint: settings?.certificateFingerprint ?? "",
    ericVersion: settings?.ericVersion ?? "",
    lastCheckedAt: settings?.lastCheckedAt ?? null,
  };
}

export function taxView(year: number) {
  const company = loadCompany();
  const monthly = filingPeriods("ustva", year, company.fiscalYearStartMonth, "monthly");
  const quarterly = filingPeriods("ustva", year, company.fiscalYearStartMonth, "quarterly");
  const filings = listTaxFilings(year).map((filing) => {
    const figures = parseFigures(filing.figuresJson);
    const checks = parseChecks(filing.checksJson);
    const summary = checkSummary(checks);
    const latest = listFilingTransmissions(filing.id)[0];
    return {
      id: filing.id,
      kind: filing.kind as TaxFilingKind,
      year: filing.year,
      periodKey: filing.periodKey,
      periodLabel: formatPeriod(filing.kind as TaxFilingKind, filing.year, filing.periodKey),
      period: filingPeriod(filing.kind as TaxFilingKind, filing.year, filing.periodKey, company.fiscalYearStartMonth),
      status: filing.status as TaxFilingStatus,
      dueDate: filing.dueDate,
      figures,
      checks,
      summary,
      figuresHash: filing.figuresHash,
      formatVersion: filing.formatVersion,
      replacesId: filing.replacesId,
      submittedAt: filing.submittedAt,
      notes: filing.notes,
      canEdit: isEditable(filing.status as TaxFilingStatus),
      submitted: isSubmitted(filing.status as TaxFilingStatus),
      submission: latest
        ? {
            id: latest.id,
            ticket: latest.ticket,
            transport: latest.transport,
            submittedAt: latest.finishedAt ?? latest.startedAt,
            protocolName: latest.protocolName,
            status: latest.status,
          }
        : null,
    };
  });
  const aggregate = filings.reduce(
    (sum, filing) =>
      filing.canEdit
        ? {
            block: sum.block + filing.summary.block,
            warn: sum.warn + filing.summary.warn,
            info: sum.info + filing.summary.info,
          }
        : sum,
    { block: 0, warn: 0, info: 0 },
  );
  return {
    year,
    today: todayIso(),
    company: {
      legalName: company.legalName,
      kleinunternehmer: company.kleinunternehmer,
      usesTaxAdvisor: company.usesTaxAdvisor,
      fiscalYearStartMonth: company.fiscalYearStartMonth,
    },
    filings,
    kinds: filingKindsFor(company),
    periods: { monthly, quarterly },
    aggregate,
    elster: elsterPublic(company.id),
  };
}

export function taxFilingView(id: number) {
  const filing = loadTaxFiling(id);
  if (!filing) return null;
  const company = loadCompany();
  const kind = filing.kind as TaxFilingKind;
  const status = filing.status as TaxFilingStatus;
  const figures = parseFigures(filing.figuresJson);
  const checks = parseChecks(filing.checksJson);
  const summary = checkSummary(checks);
  const transmissions = listFilingTransmissions(filing.id).map((row) => ({
    id: row.id,
    environment: row.environment,
    transport: row.transport,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    status: row.status,
    ticket: row.ticket,
    protocolName: row.protocolName,
    protocolSizeBytes: row.protocolSizeBytes,
    errorCode: row.errorCode,
    errorText: row.errorText,
  }));
  const events = listFilingEvents(filing.id).map((event) => {
    let detail: Record<string, unknown> = {};
    try {
      detail = JSON.parse(event.detailJson) as Record<string, unknown>;
    } catch {
      detail = {};
    }
    return {
      id: event.id,
      at: event.at,
      type: event.type,
      actor: event.actor,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      detail,
    };
  });
  return {
    today: todayIso(),
    filing: {
      id: filing.id,
      kind,
      year: filing.year,
      periodKey: filing.periodKey,
      periodLabel: formatPeriod(kind, filing.year, filing.periodKey),
      period: filingPeriod(kind, filing.year, filing.periodKey, company.fiscalYearStartMonth),
      status,
      dueDate: filing.dueDate,
      figures,
      figuresHash: filing.figuresHash,
      checks,
      summary,
      formatVersion: filing.formatVersion,
      replacesId: filing.replacesId,
      submittedAt: filing.submittedAt,
      acceptedAt: filing.acceptedAt,
      notes: filing.notes,
      canEdit: isEditable(status),
      canSubmit: status === "ready",
      submitted: isSubmitted(status),
      nextStatuses: nextStatuses(status),
      obligationKey: obligationKeyFor(kind, filing.year, filing.periodKey),
      hasFigures: figures !== null,
    },
    transmissions,
    events,
    elster: elsterPublic(company.id),
    company: {
      legalName: company.legalName,
      taxNumber: company.taxNumber,
      vatId: company.vatId,
      kleinunternehmer: company.kleinunternehmer,
    },
    exportFormats: kind === "ustva" ? ["xml", "csv", "json"] : ["csv", "json"],
    annual: isAnnualKind(kind),
  };
}

export function documentsView() {
  return { documents: listDocuments() };
}

export function legalView() {
  return {
    items: listCompliance(),
    resolutions: listResolutions(),
    people: listPeople().map(({ employee }) => ({ id: employee.id, firstName: employee.firstName, lastName: employee.lastName })),
    today: todayIso(),
  };
}

const CASH_CATEGORIES = ["customer", "expense", "payroll", "vat", "owner", "capital", "loan", "other"] as const;
type CashCategory = (typeof CASH_CATEGORIES)[number];

function cashCategory(source: string): CashCategory {
  switch (source) {
    case "payment":
      return "customer";
    case "expense":
      return "expense";
    case "payroll":
      return "payroll";
    case "vat-prepayment":
      return "vat";
    case "shareholder-payout":
    case "distribution":
      return "owner";
    case "shareholder-loan":
      return "loan";
    case "opening":
      return "capital";
    default:
      return "other";
  }
}

export function bankView(year: number, all = false) {
  const company = loadCompany();
  const connection = loadBankConnection(company.id);
  const accounts = listBankAccounts(company.id);
  const transactions = listBankTransactions(
    company.id,
    all ? undefined : `${year}-01-01`,
    all ? undefined : `${year}-12-31`,
  );
  const years = [...new Set([Number(todayIso().slice(0, 4)), year, ...listBankYears(company.id)])].sort(
    (left, right) => right - left,
  );
  return {
    today: todayIso(),
    year,
    all,
    years,
    connection: connection
      ? {
          id: connection.id,
          provider: connection.provider,
          label: connection.label,
          login: connection.login,
          environment: connection.environment,
          orgName: connection.orgName,
          orgSlug: connection.orgSlug,
          status: connection.status,
          lastError: connection.lastError,
          lastSyncedAt: connection.lastSyncedAt,
          secretHint: maskSecret(connection.secretKey),
          stagingTokenSet: Boolean(connection.stagingToken),
        }
      : null,
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      iban: account.iban,
      bic: account.bic,
      currency: account.currency,
      balanceCents: account.balanceCents,
      authorizedBalanceCents: account.authorizedBalanceCents,
      status: account.status,
      main: account.main,
      external: account.external,
      updatedAt: account.updatedAt,
    })),
    totals: bankTotals(accounts),
    summary: bankPeriodSummary(transactions),
    transactions,
    truncated: transactions.length === 5000,
  };
}

export function cashflowView(year: number) {
  const company = loadCompany();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const rows = accountBalances(from, to);
  const profit = summarizeProfit(rows);
  const of = (code: string) => signedAccount(rows, code);

  const outputVatCents = of(ACCOUNTS.vat19) + of(ACCOUNTS.vat7);
  const inputVatCents = of(ACCOUNTS.inputVat19) + of(ACCOUNTS.inputVat7);
  const vatPrepaidCents = of(ACCOUNTS.vatPrepayments) + of(ACCOUNTS.vatSpecialPrepayment);
  const grossWagesCents = of(ACCOUNTS.salaries) + of(ACCOUNTS.minijobWages);
  const employerSocialCents = of(ACCOUNTS.socialExpense) + of(ACCOUNTS.minijobSocial);
  const flatTaxCents = of(ACCOUNTS.minijobFlatTax);
  const personnelExpenseCents = grossWagesCents + employerSocialCents + flatTaxCents;
  const wageTaxCents = of(ACCOUNTS.wageTaxPayable);
  const socialCents = of(ACCOUNTS.socialPayable);

  const tax = estimateCorporateTax(profit.profitBeforeTaxCents, company.hebesatzPercent, company.lossCarryforwardCents);
  const flow = moneyFlow({
    revenueCents: profit.revenueCents,
    outputVatCents,
    expenseCents: profit.expenseCents,
    inputVatCents,
    personnelExpenseCents,
    wageTaxCents,
    socialCents,
    vatPrepaidCents,
    taxCents: { corporateCents: tax.corporateCents, soliCents: tax.soliCents, tradeCents: tax.tradeCents },
  });

  const invoices = listInvoices().filter(
    (invoice) => invoice.issueDate.startsWith(`${year}-`) && invoice.status !== "draft" && invoice.status !== "void",
  );
  const billing = {
    count: invoices.length,
    netCents: invoices.reduce((sum, invoice) => sum + invoice.netCents, 0),
    vatCents: invoices.reduce((sum, invoice) => sum + invoice.vatCents, 0),
    grossCents: invoices.reduce((sum, invoice) => sum + invoice.grossCents, 0),
    paidCents: invoices.reduce((sum, invoice) => sum + invoice.paidCents, 0),
    openCents: invoices.reduce((sum, invoice) => sum + invoice.openCents, 0),
  };

  const categoryTotals = new Map<CashCategory, { key: CashCategory; inflowCents: number; outflowCents: number; count: number }>(
    CASH_CATEGORIES.map((key) => [key, { key, inflowCents: 0, outflowCents: 0, count: 0 }]),
  );
  for (const movement of listCashMovements(from, to)) {
    const bucket = categoryTotals.get(cashCategory(movement.source))!;
    bucket.count += 1;
    if (movement.deltaCents >= 0) bucket.inflowCents += movement.deltaCents;
    else bucket.outflowCents += -movement.deltaCents;
  }
  const openingCents = signedAccount(accountBalances("0001-01-01", `${year - 1}-12-31`), ACCOUNTS.bank);
  const closingCents = signedAccount(accountBalances("0001-01-01", to), ACCOUNTS.bank);
  const cash = {
    openingCents,
    closingCents,
    changeCents: closingCents - openingCents,
    inflowCents: [...categoryTotals.values()].reduce((sum, row) => sum + row.inflowCents, 0),
    outflowCents: [...categoryTotals.values()].reduce((sum, row) => sum + row.outflowCents, 0),
    categories: [...categoryTotals.values()]
      .filter((row) => row.count > 0)
      .sort((a, b) => b.inflowCents + b.outflowCents - (a.inflowCents + a.outflowCents)),
  };

  const obligations = listObligations(year);
  const filingCount = (prefix: string) => {
    const items = obligations.filter((item) => item.key.startsWith(prefix));
    return { total: items.length, done: items.filter((item) => item.status === "done").length };
  };

  return {
    year,
    today: todayIso(),
    company: {
      legalName: company.legalName,
      kleinunternehmer: company.kleinunternehmer,
      hebesatzPercent: company.hebesatzPercent,
      usesTaxAdvisor: company.usesTaxAdvisor,
    },
    billing: {
      ...billing,
      paidSharePercent: flowShareBps(billing.paidCents, billing.grossCents),
      openSharePercent: flowShareBps(billing.openCents, billing.grossCents),
    },
    flow,
    vat: {
      output19Cents: of(ACCOUNTS.vat19),
      output7Cents: of(ACCOUNTS.vat7),
      input19Cents: of(ACCOUNTS.inputVat19),
      input7Cents: of(ACCOUNTS.inputVat7),
      outputCents: outputVatCents,
      inputCents: inputVatCents,
      payableCents: flow.vatPayableCents,
      prepaidCents: vatPrepaidCents,
      openCents: flow.vatOpenCents,
    },
    payroll: {
      grossWagesCents,
      employerSocialCents,
      flatTaxCents,
      personnelExpenseCents,
      netPayCents: flow.netWagesCents,
      wageTaxCents,
      socialCents,
    },
    bookedTaxCents: of(ACCOUNTS.corporateTax) + of(ACCOUNTS.solidarity) + of(ACCOUNTS.tradeTax),
    tax: { ...tax, hebesatzPercent: company.hebesatzPercent },
    cash,
    filings: {
      vat: filingCount("ustva-"),
      wageTax: filingCount("lst-"),
    },
  };
}

export function milestonesView(year: number) {
  const today = todayIso();
  const all = listMilestones();
  const companies = listCompanies().map((company) => ({ id: company.id, name: company.legalName }));
  const companyName = new Map(companies.map((company) => [company.id, company.name]));
  const milestones = sortMilestones(all.filter((milestone) => milestone.targetDate.startsWith(`${year}-`))).map((milestone) => ({
    ...milestone,
    companyNames: milestone.companyIds.flatMap((id) => {
      const name = companyName.get(id);
      return name ? [{ id, name }] : [];
    }),
    overdue: milestoneIsOverdue(milestone, today),
    effectiveProgress: milestoneProgress(milestone),
  }));
  const years = new Set(milestoneYears(all));
  const currentYear = Number(today.slice(0, 4));
  // Neighbouring years stay reachable so a goal can be planned ahead of time.
  for (const candidate of [currentYear - 1, currentYear, currentYear + 1, year - 1, year, year + 1]) {
    years.add(candidate);
  }
  const yearList = [...years].sort((left, right) => left - right);
  return {
    today,
    year,
    years: yearList,
    companies,
    milestones,
    analysis: analyzeMilestones(all, year, today),
    companyRows: analyzeMilestonesByCompany(all, companies, year, today),
  };
}

export const COMMAND_PAGE_KEYS = [
  "invoices",
  "customers",
  "people",
  "projects",
  "documents",
  "obligations",
  "milestones",
  "legal",
  "company",
  "ledger",
] as const;

export type CommandPageKey = (typeof COMMAND_PAGE_KEYS)[number];

export type CommandEntry = {
  page: CommandPageKey;
  id: string;
  title: string;
  detail: string;
  href: string;
  keywords: string;
};

function commandDetail(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" · ");
}

/**
 * The command bar searches pages and the records they hold. The index is built
 * from the same list queries the screens use, so a record appears with the
 * label and link its page would show.
 */
export function commandView() {
  const company = loadCompany();
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const entries: CommandEntry[] = [];

  for (const invoice of listInvoices()) {
    entries.push({
      page: "invoices",
      id: `invoice-${invoice.id}`,
      title: invoice.number || `#${invoice.id}`,
      detail: commandDetail([invoice.customerName, formatEuro(invoice.grossCents)]),
      href: `/invoices/${invoice.id}`,
      keywords: commandDetail([invoice.number, invoice.customerName, invoice.status, invoice.displayStatus, invoice.issueDate]),
    });
  }

  for (const customer of listCustomers(company.id)) {
    entries.push({
      page: "customers",
      id: `customer-${customer.id}`,
      title: customer.name,
      detail: commandDetail([customer.city, customer.email]),
      href: `/customers#customer-${customer.id}`,
      keywords: commandDetail([customer.name, customer.street, customer.postalCode, customer.city, customer.email, customer.website, customer.vatId, customer.buyerReference]),
    });
  }

  for (const person of listOrgMembers()) {
    entries.push({
      page: "people",
      id: `person-${person.id}`,
      title: `${person.firstName} ${person.lastName}`.trim(),
      detail: person.role,
      href: `/people/${person.id}`,
      keywords: commandDetail([person.firstName, person.lastName, person.role, person.kind]),
    });
  }

  const projects = listProjects(company.id);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  for (const project of projects) {
    entries.push({
      page: "projects",
      id: `project-${project.id}`,
      title: project.name,
      detail: commandDetail([project.customerName]),
      href: `/projects#project-${project.id}`,
      keywords: commandDetail([project.name, project.customerName, project.status, project.notes]),
    });
  }

  for (const task of listTasks()) {
    const project = task.projectId === null ? null : projectById.get(task.projectId) ?? null;
    entries.push({
      page: "projects",
      id: `task-${task.id}`,
      title: task.title,
      detail: commandDetail([project?.name, task.dueDate ? formatDate(task.dueDate) : null]),
      href: project ? `/projects#project-${project.id}` : "/projects",
      keywords: commandDetail([task.title, project?.name, task.notes, task.area, task.status, task.deliverable ? "deliverable" : null]),
    });
  }

  for (const document of listDocuments()) {
    entries.push({
      page: "documents",
      id: `document-${document.id}`,
      title: document.title || document.fileName,
      detail: commandDetail([document.fileName]),
      href: `/documents#document-${document.id}`,
      keywords: commandDetail([document.title, document.fileName, document.category, document.notes]),
    });
  }

  for (const obligationYear of [year, year + 1]) {
    for (const item of listObligations(obligationYear)) {
      entries.push({
        page: "obligations",
        id: `obligation-${item.key}`,
        title: item.title,
        detail: commandDetail([formatDate(item.dueDate)]),
        href: `/obligations?year=${item.dueDate.slice(0, 4)}#year`,
        keywords: commandDetail([item.title, item.detail, item.key, item.category, item.status]),
      });
    }
  }

  for (const deadline of listDeadlines()) {
    entries.push({
      page: "obligations",
      id: `deadline-${deadline.id}`,
      title: deadline.title,
      detail: commandDetail([formatDate(deadline.dueDate)]),
      href: `/obligations?year=${deadline.dueDate.slice(0, 4)}#custom`,
      keywords: commandDetail([deadline.title, deadline.notes, deadline.category, deadline.status, deadline.recurrence]),
    });
  }

  for (const milestone of listMilestones()) {
    entries.push({
      page: "milestones",
      id: `milestone-${milestone.id}`,
      title: milestone.title,
      detail: commandDetail([formatDate(milestone.targetDate)]),
      href: `/milestones?year=${milestone.targetDate.slice(0, 4)}#goals`,
      keywords: commandDetail([milestone.title, milestone.description, milestone.category, milestone.status]),
    });
  }

  for (const item of listCompliance()) {
    entries.push({
      page: "legal",
      id: `compliance-${item.id}`,
      title: item.title,
      detail: item.detail,
      href: `/legal#${item.area}`,
      keywords: commandDetail([item.title, item.detail, item.area, item.done ? "done" : "open"]),
    });
  }

  for (const resolution of listResolutions()) {
    entries.push({
      page: "legal",
      id: `resolution-${resolution.id}`,
      title: resolution.title,
      detail: commandDetail([formatDate(resolution.resolvedOn)]),
      href: `/legal#resolutions`,
      keywords: commandDetail([resolution.title, resolution.summary, resolution.body, resolution.kind]),
    });
  }

  for (const holder of loadShareholders()) {
    entries.push({
      page: "company",
      id: `shareholder-${holder.id}`,
      title: holder.name,
      detail: commandDetail([formatPercentBps(holder.shareBps), holder.city]),
      href: `/company#shareholders`,
      keywords: commandDetail([holder.name, holder.street, holder.postalCode, holder.city]),
    });
  }

  for (const policy of listPolicies()) {
    entries.push({
      page: "company",
      id: `policy-${policy.id}`,
      title: policy.label,
      detail: commandDetail([policy.provider, policy.policyNumber, policy.renewalDate ? formatDate(policy.renewalDate) : null]),
      href: `/company#cover`,
      keywords: commandDetail([policy.label, policy.kind, policy.provider, policy.policyNumber, policy.notes]),
    });
  }

  for (const loan of listShareholderLoans()) {
    entries.push({
      page: "company",
      id: `loan-${loan.id}`,
      title: loan.label,
      detail: commandDetail([loan.shareholderName, formatEuro(loan.outstandingCents)]),
      href: `/company#shareholders`,
      keywords: commandDetail([loan.label, loan.shareholderName, loan.notes, formatEuro(loan.principalCents)]),
    });
  }

  for (const account of CHART) {
    entries.push({
      page: "ledger",
      id: `account-${account.code}`,
      title: `${account.code} ${account.name}`,
      detail: "",
      href: `/ledger#accounts`,
      keywords: commandDetail([account.code, account.name, account.type]),
    });
  }

  return { entries };
}

export function loadView(name: ViewName, params: URLSearchParams) {
  const query = parseViewQuery(params, todayIso());
  if (!viewIsReady(name, query)) return null;
  switch (name) {
    case "shell":
      return shellView();
    case "desk":
      return deskView();
    case "command":
      return commandView();
    case "company":
      return companyView();
    case "invoices":
      return invoicesView();
    case "customers":
      return customersView();
    case "customer":
      return customerView(query.id!);
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
    case "cashflow":
      return cashflowView(query.year);
    case "bank":
      return bankView(query.year, query.all);
    case "people":
      return peoplePageView();
    case "person":
      return personView(query.id!);
    case "org":
      return orgView();
    case "time":
      return query.from && query.to ? timeRangeView(query.from, query.to) : timeView(query.week);
    case "time-days":
      return query.from && query.to ? timeDaysView(query.from, query.to) : null;
    case "obligations":
      return obligationsView(query.year);
    case "tax":
      return taxView(query.year);
    case "tax-filing":
      return taxFilingView(query.id!);
    case "documents":
      return documentsView();
    case "legal":
      return legalView();
    case "projects":
      return projectsView();
    case "analytics":
      return analyticsView(query.year, query.customer);
    case "milestones":
      return milestonesView(query.year);
    case "settings":
      return settingsView();
  }
}
