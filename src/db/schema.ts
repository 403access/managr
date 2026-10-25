import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  legalName: text("legal_name").notNull(),
  legalForm: text("legal_form").notNull().default("UG (haftungsbeschränkt)"),
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
  invoicePrefix: text("invoice_prefix").notNull().default("RE-"),
  nextInvoiceSeq: integer("next_invoice_seq").notNull().default(1),
  paymentTermsDays: integer("payment_terms_days").notNull().default(14),
  managingDirector: text("managing_director").notNull().default(""),
  isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
});

export const shareholders = sqliteTable("shareholders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  street: text("street").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  city: text("city").notNull().default(""),
  shareBps: integer("share_bps").notNull(),
  nominalCents: integer("nominal_cents").notNull(),
});

export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  street: text("street").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  city: text("city").notNull().default(""),
  country: text("country").notNull().default("Deutschland"),
  email: text("email").notNull().default(""),
  vatId: text("vat_id").notNull().default(""),
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
    entryDate: text("entry_date").notNull(),
    memo: text("memo").notNull(),
    source: text("source").notNull(),
    sourceId: text("source_id"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("journal_source_unique").on(table.source, table.sourceId)],
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
  customerId: integer("customer_id").notNull().references(() => customers.id),
  number: text("number").unique(),
  status: text("status").notNull(),
  issueDate: text("issue_date").notNull(),
  serviceDate: text("service_date").notNull(),
  dueDate: text("due_date").notNull(),
  notes: text("notes").notNull().default(""),
  exemptionNote: text("exemption_note").notNull().default(""),
  journalEntryId: integer("journal_entry_id").references(() => journalEntries.id),
});

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

export const absences = sqliteTable("absences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  notes: text("notes").notNull().default(""),
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  notes: text("notes").notNull().default(""),
  dueDate: text("due_date"),
  status: text("status").notNull(),
  area: text("area").notNull().default("general"),
});

export const timeEntries = sqliteTable("time_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entryDate: text("entry_date").notNull(),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at").notNull(),
  breakMinutes: integer("break_minutes").notNull().default(0),
  memo: text("memo").notNull().default(""),
  taskId: integer("task_id").references(() => tasks.id),
  employeeId: integer("employee_id").references(() => employees.id),
  billable: integer("billable", { mode: "boolean" }).notNull().default(false),
});

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  category: text("category").notNull(),
  fileName: text("file_name").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  notes: text("notes").notNull().default(""),
  uploadedAt: text("uploaded_at").notNull(),
});

export const obligationStates = sqliteTable("obligation_states", {
  key: text("key").primaryKey(),
  status: text("status").notNull(),
  note: text("note").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});

export const customDeadlines = sqliteTable("custom_deadlines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  category: text("category").notNull(),
  dueDate: text("due_date").notNull(),
  recurrence: text("recurrence").notNull(),
  status: text("status").notNull(),
  notes: text("notes").notNull().default(""),
});

export const resolutions = sqliteTable("resolutions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  resolvedOn: text("resolved_on").notNull(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  body: text("body").notNull(),
  summary: text("summary").notNull().default(""),
});

export const complianceItems = sqliteTable("compliance_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  area: text("area").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull(),
});

export const policies = sqliteTable("policies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull(),
  kind: text("kind").notNull(),
  provider: text("provider").notNull().default(""),
  policyNumber: text("policy_number").notNull().default(""),
  monthlyPremiumCents: integer("monthly_premium_cents").notNull().default(0),
  renewalDate: text("renewal_date"),
  notes: text("notes").notNull().default(""),
});

export const reserveMovements = sqliteTable("reserve_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  year: integer("year").notNull(),
  movedOn: text("moved_on").notNull(),
  kind: text("kind").notNull(),
  amountCents: integer("amount_cents").notNull(),
  note: text("note").notNull().default(""),
  journalEntryId: integer("journal_entry_id").references(() => journalEntries.id),
});
