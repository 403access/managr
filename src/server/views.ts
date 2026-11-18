import "server-only";
import { CHART, ACCOUNTS, signedBalance } from "@/domain/accounts";
import { addDays, fiscalYearContaining, todayIso } from "@/domain/calendar";
import { currentDirectorContract, reviewDirectorContract } from "@/domain/director-contract";
import { reviewDirectorSalary } from "@/domain/director-salary";
import { reviewFounderHealth } from "@/domain/founder-health";
import { reviewInvoice } from "@/domain/invoice";
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
import { durationMinutes, minimumVacationDays, timeWarnings, vacationShortfall } from "@/domain/time";
import { euroInput, quantityInput } from "@/components/amounts";
import {
  accountBalances,
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
  listTimeInRange,
  listCompanies,
  loadBankConnection,
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
  return {
    legalName: company.legalName,
    legalForm: company.legalForm,
    isSample: company.isSample,
    activeCompanyId: company.id,
    companies: listCompanies().map((item) => ({ id: item.id, legalName: item.legalName, legalForm: item.legalForm })),
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

export function customersView() {
  return { customers: listCustomers() };
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
    amountDisplay: "net" as const,
    draft: null,
  };
}

export function invoiceEditView(id: number) {
  const loaded = loadInvoice(id);
  if (!loaded) return { kind: "missing" as const };
  if (loaded.invoice.status !== "draft") return { kind: "issued" as const };
  const company = loaded.company;
  return {
    kind: "draft" as const,
    seller: sellerFrom(company),
    customers: customerOptions(company.id),
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
      amountDisplay: loaded.invoice.amountDisplay,
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

export function orgView() {
  const today = todayIso();
  return { today, ...buildOrgChart(listOrgMembers(), today) };
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
  const tasks = listTasks();
  const entries = listTimeInRange("0001-01-01", "9999-12-31");
  const totalsByProject = new Map<number, WorkTotals>();
  for (const entry of entries) {
    if (entry.projectId === null) continue;
    const totals = totalsByProject.get(entry.projectId) ?? emptyWorkTotals();
    const minutes = timeEntryMinutes(entry);
    if (minutes > 0) addWork(totals, minutes, entry.taskType, entry.billable);
    totalsByProject.set(entry.projectId, totals);
  }
  return {
    today: todayIso(),
    projects: projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id);
      return {
        ...project,
        minutes: totalsByProject.get(project.id)?.minutes ?? 0,
        taskCount: projectTasks.length,
        openTasks: projectTasks.filter((task) => task.status !== "done").length,
        deliverables: projectTasks.filter((task) => task.deliverable && task.status === "done").length,
        openDeliverables: projectTasks.filter((task) => task.deliverable && task.status !== "done").length,
      };
    }),
    customers: listCustomers(company.id).map((customer) => ({ id: customer.id, name: customer.name })),
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
  const projectById = new Map(allProjects.map((project) => [project.id, project]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const employeeById = new Map(people.map(({ employee }) => [employee.id, employee]));
  const customer = customerId === null ? null : allCustomers.find((item) => item.id === customerId) ?? null;
  const projects = customerId === null ? allProjects : allProjects.filter((project) => project.customerId === customerId);
  const projectIdsInScope = new Set(projects.map((project) => project.id));
  const invoices = listInvoices().filter((invoice) => invoice.issueDate.startsWith(`${year}-`) && invoice.status !== "void" && invoice.status !== "draft");

  const work: { month: string; minutes: number; taskType: string; billable: boolean; projectId: number | null; employeeId: number | null }[] = [];
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
    });
  }

  const projectWork = new Map<string, WorkTotals & { projectId: number | null; minutes: number }>();
  const personWork = new Map<string, WorkTotals & { employeeId: number | null; projectIds: Set<number> }>();
  const customerWork = new Map<number, WorkTotals>();
  for (const row of work) {
    const project = row.projectId === null ? null : projectById.get(row.projectId) ?? null;
    const projectKey = String(row.projectId ?? "none");
    const projectTotals = projectWork.get(projectKey) ?? { ...emptyWorkTotals(), projectId: row.projectId, minutes: 0 };
    addWork(projectTotals, row.minutes, row.taskType, row.billable);
    projectWork.set(projectKey, projectTotals);

    const personKey = String(row.employeeId ?? "none");
    const personTotals = personWork.get(personKey) ?? { ...emptyWorkTotals(), employeeId: row.employeeId, projectIds: new Set<number>() };
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
      return {
        employeeId: totals.employeeId,
        firstName: employee?.firstName ?? "",
        lastName: employee?.lastName ?? "",
        role: employee?.role ?? "",
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
      taskId: entry.taskId,
      projectId: entry.projectId,
      taskType: entry.taskType,
      firstName: person?.employee.firstName ?? "",
      minutes,
      warnings,
      error,
    };
  });
  const projects = listProjects();
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
    projects: projects.map((project) => ({ id: project.id, name: project.name, customerName: project.customerName })),
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
    case "customers":
      return customersView();
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
      return peopleView();
    case "person":
      return personView(query.id!);
    case "org":
      return orgView();
    case "time":
      return timeView(query.week);
    case "obligations":
      return obligationsView(query.year);
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
  }
}
