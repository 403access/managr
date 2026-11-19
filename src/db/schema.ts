import { index, integer, primaryKey, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  legalName: text("legal_name").notNull(),
  legalForm: text("legal_form").notNull().default("ug"),
  street: text("street").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  city: text("city").notNull().default(""),
  country: text("country").notNull().default("Deutschland"),
  stateCode: text("state_code").notNull().default("BE"),
  registerCourt: text("register_court").notNull().default(""),
  registerNumber: text("register_number").notNull().default(""),
  taxNumber: text("tax_number").notNull().default(""),
  vatId: text("vat_id").notNull().default(""),
  economicId: text("economic_id").notNull().default(""),
  shareCapitalCents: integer("share_capital_cents").notNull(),
  lossCarryforwardCents: integer("loss_carryforward_cents").notNull().default(0),
  priorYearRevenueCents: integer("prior_year_revenue_cents").notNull().default(0),
  fiscalYearStartMonth: integer("fiscal_year_start_month").notNull().default(1),
  foundingDate: text("founding_date").notNull(),
  kleinunternehmer: integer("kleinunternehmer", { mode: "boolean" }).notNull().default(false),
  vatPermanentExtension: integer("vat_permanent_extension", { mode: "boolean" }).notNull().default(false),
  usesTaxAdvisor: integer("uses_tax_advisor", { mode: "boolean" }).notNull().default(false),
  defaultVatBps: integer("default_vat_bps").notNull().default(1900),
  iban: text("iban").notNull().default(""),
  bic: text("bic").notNull().default(""),
  bankName: text("bank_name").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  website: text("website").notNull().default(""),
  ihk: text("ihk").notNull().default(""),
  berufsgenossenschaft: text("berufsgenossenschaft").notNull().default(""),
  hebesatzPercent: integer("hebesatz_percent").notNull().default(410),
  additionalKvBps: integer("additional_kv_bps").notNull().default(290),
  hourlyRateCents: integer("hourly_rate_cents"),
  invoicePrefix: text("invoice_prefix").notNull().default("RE-"),
  nextInvoiceSeq: integer("next_invoice_seq").notNull().default(1),
  paymentTermsDays: integer("payment_terms_days").notNull().default(14),
  managingDirector: text("managing_director").notNull().default(""),
  isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
});

export const shareholders = sqliteTable("shareholders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  street: text("street").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  city: text("city").notNull().default(""),
  shareBps: integer("share_bps").notNull(),
  nominalCents: integer("nominal_cents").notNull(),
  deletedAt: text("deleted_at"),
});

export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  street: text("street").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  city: text("city").notNull().default(""),
  country: text("country").notNull().default("Deutschland"),
  email: text("email").notNull().default(""),
  website: text("website").notNull().default(""),
  vatId: text("vat_id").notNull().default(""),
  buyerReference: text("buyer_reference").notNull().default(""),
  hourlyRateCents: integer("hourly_rate_cents"),
});

export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  pnl: text("pnl").notNull(),
  system: integer("system", { mode: "boolean" }).notNull().default(true),
});

export const journalEntries = sqliteTable(
  "journal_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    entryDate: text("entry_date").notNull(),
    memo: text("memo").notNull(),
    source: text("source").notNull(),
    sourceId: text("source_id"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("journal_source_unique").on(table.companyId, table.source, table.sourceId)],
);

export const journalLines = sqliteTable("journal_lines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entryId: integer("entry_id").notNull().references(() => journalEntries.id),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  debitCents: integer("debit_cents").notNull(),
  creditCents: integer("credit_cents").notNull(),
});

export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  number: text("number"),
  status: text("status").notNull(),
  issueDate: text("issue_date").notNull(),
  serviceDate: text("service_date").notNull(),
  dueDate: text("due_date").notNull(),
  notes: text("notes").notNull().default(""),
  exemptionNote: text("exemption_note").notNull().default(""),
  buyerReference: text("buyer_reference").notNull().default(""),
  amountDisplay: text("amount_display").notNull().default("net"),
  journalEntryId: integer("journal_entry_id").references(() => journalEntries.id),
  deletedAt: text("deleted_at"),
}, (table) => [uniqueIndex("invoices_company_number_unique").on(table.companyId, table.number)]);

export const invoiceLines = sqliteTable("invoice_lines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  description: text("description").notNull(),
  quantityMilli: integer("quantity_milli").notNull(),
  unitNetCents: integer("unit_net_cents").notNull(),
  vatBps: integer("vat_bps").notNull(),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  paidOn: text("paid_on").notNull(),
  amountCents: integer("amount_cents").notNull(),
  journalEntryId: integer("journal_entry_id").references(() => journalEntries.id),
});

export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  shareholderId: integer("shareholder_id").references(() => shareholders.id),
  managerId: integer("manager_id").references((): AnySQLiteColumn => employees.id, { onDelete: "set null" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull().default(""),
  kind: text("kind").notNull(),
  svStatus: text("sv_status").notNull(),
  ownershipBps: integer("ownership_bps").notNull().default(0),
  street: text("street").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  city: text("city").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  weeklyMinutes: integer("weekly_minutes").notNull(),
  workdaysPerWeek: integer("workdays_per_week").notNull(),
  vacationDays: integer("vacation_days").notNull(),
  grossMonthlyCents: integer("gross_monthly_cents").notNull(),
  taxClass: text("tax_class").notNull().default(""),
  taxId: text("tax_id").notNull().default(""),
  svNumber: text("sv_number").notNull().default(""),
  churchTax: integer("church_tax", { mode: "boolean" }).notNull().default(false),
  healthInsuranceName: text("health_insurance_name").notNull().default(""),
  additionalKvBps: integer("additional_kv_bps"),
  childlessSurcharge: integer("childless_surcharge", { mode: "boolean" }).notNull().default(false),
  careDiscountSteps: integer("care_discount_steps").notNull().default(0),
  minijobPublicHealth: integer("minijob_public_health", { mode: "boolean" }).notNull().default(true),
  pensionOptOut: integer("pension_opt_out", { mode: "boolean" }).notNull().default(false),
  flatTax: integer("flat_tax", { mode: "boolean" }).notNull().default(true),
  notes: text("notes").notNull().default(""),
});

export const salaryPeriods = sqliteTable(
  "salary_periods",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
    validFrom: text("valid_from").notNull(),
    grossMonthlyCents: integer("gross_monthly_cents").notNull(),
    note: text("note").notNull().default(""),
    deletedAt: text("deleted_at"),
  },
  (table) => [uniqueIndex("salary_periods_employee_from_unique").on(table.employeeId, table.validFrom)],
);

export const directorContracts = sqliteTable("director_contracts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  signedOn: text("signed_on").notNull(),
  validFrom: text("valid_from").notNull(),
  endedOn: text("ended_on"),
  grossMonthlyCents: integer("gross_monthly_cents").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const founderHealth = sqliteTable(
  "founder_health",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    provider: text("provider").notNull().default(""),
    monthlyPremiumCents: integer("monthly_premium_cents").notNull().default(0),
    startsOn: text("starts_on").notNull(),
    statusProcedure: text("status_procedure").notNull().default("not_required"),
    statusOn: text("status_on"),
    statusOutcome: text("status_outcome").notNull().default("open"),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [uniqueIndex("founder_health_employee_unique").on(table.companyId, table.employeeId)],
);

export const shareholderLoans = sqliteTable("shareholder_loans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  shareholderId: integer("shareholder_id").notNull().references(() => shareholders.id),
  label: text("label").notNull(),
  openedOn: text("opened_on").notNull(),
  principalCents: integer("principal_cents").notNull(),
  interestBps: integer("interest_bps").notNull().default(0),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const shareholderLoanMovements = sqliteTable("shareholder_loan_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  loanId: integer("loan_id").notNull().references(() => shareholderLoans.id, { onDelete: "cascade" }),
  movedOn: text("moved_on").notNull(),
  kind: text("kind").notNull(),
  amountCents: integer("amount_cents").notNull(),
  note: text("note").notNull().default(""),
  journalEntryId: integer("journal_entry_id").references(() => journalEntries.id),
});

export const absences = sqliteTable("absences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  notes: text("notes").notNull().default(""),
  deletedAt: text("deleted_at"),
});

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  startedOn: text("started_on").notNull(),
  endedOn: text("ended_on"),
  notes: text("notes").notNull().default(""),
  hourlyRateCents: integer("hourly_rate_cents"),
  deletedAt: text("deleted_at"),
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  notes: text("notes").notNull().default(""),
  dueDate: text("due_date"),
  status: text("status").notNull(),
  area: text("area").notNull().default("general"),
  taskType: text("task_type").notNull().default("other"),
  deliverable: integer("deliverable", { mode: "boolean" }).notNull().default(false),
  completedAt: text("completed_at"),
  deletedAt: text("deleted_at"),
});

export const timeEntries = sqliteTable("time_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  entryDate: text("entry_date").notNull(),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at").notNull(),
  breakMinutes: integer("break_minutes").notNull().default(0),
  memo: text("memo").notNull().default(""),
  taskId: integer("task_id").references(() => tasks.id),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  employeeId: integer("employee_id").references(() => employees.id),
  billable: integer("billable", { mode: "boolean" }).notNull().default(false),
  taskType: text("task_type").notNull().default("other"),
  hourlyRateCents: integer("hourly_rate_cents"),
  deletedAt: text("deleted_at"),
});

/** The lines of work on a time entry. The entry's memo stays an internal note. */
export const timeEntryActivities = sqliteTable(
  "time_entry_activities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    timeEntryId: integer("time_entry_id").notNull().references(() => timeEntries.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
  },
  (table) => [index("time_entry_activities_entry_idx").on(table.timeEntryId)],
);

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull(),
  fileName: text("file_name").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  notes: text("notes").notNull().default(""),
  uploadedAt: text("uploaded_at").notNull(),
  deletedAt: text("deleted_at"),
});

export const obligationStates = sqliteTable(
  "obligation_states",
  {
    companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    status: text("status").notNull(),
    note: text("note").notNull().default(""),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.companyId, table.key] })],
);

export const customDeadlines = sqliteTable("custom_deadlines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull(),
  dueDate: text("due_date").notNull(),
  recurrence: text("recurrence").notNull(),
  status: text("status").notNull(),
  notes: text("notes").notNull().default(""),
  deletedAt: text("deleted_at"),
});

export const resolutions = sqliteTable("resolutions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").references(() => employees.id),
  resolvedOn: text("resolved_on").notNull(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  body: text("body").notNull(),
  summary: text("summary").notNull().default(""),
});

export const complianceItems = sqliteTable("compliance_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  area: text("area").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull(),
});

export const policies = sqliteTable("policies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  kind: text("kind").notNull(),
  provider: text("provider").notNull().default(""),
  policyNumber: text("policy_number").notNull().default(""),
  monthlyPremiumCents: integer("monthly_premium_cents").notNull().default(0),
  renewalDate: text("renewal_date"),
  notes: text("notes").notNull().default(""),
  deletedAt: text("deleted_at"),
});

export const milestones = sqliteTable("milestones", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull().default("other"),
  status: text("status").notNull().default("planned"),
  targetDate: text("target_date").notNull(),
  progress: integer("progress").notNull().default(0),
  createdAt: text("created_at").notNull(),
  deletedAt: text("deleted_at"),
});

/** A goal can span companies. No row means it applies to the group as a whole. */
export const milestoneCompanies = sqliteTable(
  "milestone_companies",
  {
    milestoneId: integer("milestone_id").notNull().references(() => milestones.id, { onDelete: "cascade" }),
    companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.milestoneId, table.companyId] })],
);

export const bankConnections = sqliteTable(
  "bank_connections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("qonto"),
    label: text("label").notNull().default("Qonto"),
    login: text("login").notNull(),
    secretKey: text("secret_key").notNull(),
    environment: text("environment").notNull().default("production"),
    stagingToken: text("staging_token").notNull().default(""),
    orgId: text("org_id").notNull().default(""),
    orgName: text("org_name").notNull().default(""),
    orgSlug: text("org_slug").notNull().default(""),
    status: text("status").notNull().default("new"),
    lastError: text("last_error").notNull().default(""),
    lastSyncedAt: text("last_synced_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("bank_connections_company_provider_unique").on(table.companyId, table.provider)],
);

export const bankAccounts = sqliteTable(
  "bank_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    connectionId: integer("connection_id").notNull().references(() => bankConnections.id, { onDelete: "cascade" }),
    companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull().default(""),
    iban: text("iban").notNull().default(""),
    bic: text("bic").notNull().default(""),
    currency: text("currency").notNull().default("EUR"),
    balanceCents: integer("balance_cents").notNull().default(0),
    authorizedBalanceCents: integer("authorized_balance_cents").notNull().default(0),
    status: text("status").notNull().default("active"),
    main: integer("is_main", { mode: "boolean" }).notNull().default(false),
    external: integer("is_external", { mode: "boolean" }).notNull().default(false),
    updatedAt: text("updated_at").notNull().default(""),
    syncedAt: text("synced_at").notNull(),
  },
  (table) => [
    uniqueIndex("bank_accounts_connection_external_unique").on(table.connectionId, table.externalId),
    index("bank_accounts_company_idx").on(table.companyId),
  ],
);

export const bankTransactions = sqliteTable(
  "bank_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id").notNull().references(() => bankAccounts.id, { onDelete: "cascade" }),
    companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    externalRef: text("external_ref").notNull().default(""),
    status: text("status").notNull(),
    side: text("side").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("EUR"),
    bookedOn: text("booked_on").notNull(),
    emittedAt: text("emitted_at").notNull().default(""),
    settledAt: text("settled_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(""),
    label: text("label").notNull().default(""),
    counterpartyName: text("counterparty_name").notNull().default(""),
    reference: text("reference").notNull().default(""),
    note: text("note").notNull().default(""),
    operationType: text("operation_type").notNull().default(""),
    subjectType: text("subject_type").notNull().default(""),
    category: text("category").notNull().default(""),
    cashflowCategory: text("cashflow_category").notNull().default(""),
    cashflowSubcategory: text("cashflow_subcategory").notNull().default(""),
    vatAmountCents: integer("vat_amount_cents"),
    vatRateBps: integer("vat_rate_bps"),
    cardLastDigits: text("card_last_digits").notNull().default(""),
    counterpartyIban: text("counterparty_iban").notNull().default(""),
    counterpartyBic: text("counterparty_bic").notNull().default(""),
    attachmentCount: integer("attachment_count").notNull().default(0),
    syncedAt: text("synced_at").notNull(),
  },
  (table) => [
    uniqueIndex("bank_transactions_account_external_unique").on(table.accountId, table.externalId),
    index("bank_transactions_company_date_idx").on(table.companyId, table.bookedOn),
    index("bank_transactions_account_date_idx").on(table.accountId, table.bookedOn),
  ],
);

export const reserveMovements = sqliteTable("reserve_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  companyId: integer("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  movedOn: text("moved_on").notNull(),
  kind: text("kind").notNull(),
  amountCents: integer("amount_cents").notNull(),
  note: text("note").notNull().default(""),
  journalEntryId: integer("journal_entry_id").references(() => journalEntries.id),
});

/** A single, desk-wide row for display preferences. */
export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey(),
  detailSidebarMode: text("detail_sidebar_mode").notNull().default("inline"),
  detailSidebarOverrides: text("detail_sidebar_overrides").notNull().default("{}"),
});
