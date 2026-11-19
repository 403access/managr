import { addDays, iso, parseIso } from "./calendar";
import { statutoryObligations, type ObligationSettings } from "./obligations";

export const TAX_FILING_KINDS = ["ustva", "ust-annual", "kst", "gewst"] as const;
export type TaxFilingKind = (typeof TAX_FILING_KINDS)[number];

export const TAX_FILING_STATUSES = [
  "draft",
  "calculated",
  "checked",
  "ready",
  "submitted_manually",
  "accepted",
  "rejected",
  "failed",
  "corrected",
  "archived",
] as const;
export type TaxFilingStatus = (typeof TAX_FILING_STATUSES)[number];

export const FILING_SEVERITIES = ["block", "warn", "info"] as const;
export type FilingSeverity = (typeof FILING_SEVERITIES)[number];

export type FilingCheck = {
  code: string;
  severity: FilingSeverity;
  message: string;
};

export type FilingPeriod = {
  key: string;
  from: string;
  to: string;
  month: number | null;
  quarter: number | null;
};

export type VatRhythm = "monthly" | "quarterly";

export const VAT_RHYTHMS: VatRhythm[] = ["monthly", "quarterly"];

export function isTaxFilingKind(value: string): value is TaxFilingKind {
  return (TAX_FILING_KINDS as readonly string[]).includes(value);
}

export function isTaxFilingStatus(value: string): value is TaxFilingStatus {
  return (TAX_FILING_STATUSES as readonly string[]).includes(value);
}

export function isAnnualKind(kind: TaxFilingKind): boolean {
  return kind !== "ustva";
}

/** The fiscal year labelled `year` ends in `year`. A July start belongs to the previous calendar year. */
export function fiscalYearRange(year: number, startMonth: number): { from: string; to: string } {
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) throw new Error("The financial-year start month is invalid.");
  if (startMonth === 1) return { from: `${year}-01-01`, to: `${year}-12-31` };
  const startYear = year - 1;
  const endMonth = startMonth - 1;
  const endDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  return { from: iso(startYear, startMonth, 1), to: iso(year, endMonth, endDay) };
}

function monthPeriod(year: number, month: number): FilingPeriod {
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    key: `${year}-${String(month).padStart(2, "0")}`,
    from: iso(year, month, 1),
    to: iso(year, month, endDay),
    month,
    quarter: null,
  };
}

function quarterPeriod(year: number, quarter: number): FilingPeriod {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = quarter * 3;
  return {
    key: `${year}-Q${quarter}`,
    from: iso(year, startMonth, 1),
    to: iso(year, endMonth, new Date(Date.UTC(year, endMonth, 0)).getUTCDate()),
    month: null,
    quarter,
  };
}

/** All selectable periods of one year. Annual returns use the fiscal year stored on the company. */
export function filingPeriods(kind: TaxFilingKind, year: number, startMonth = 1, rhythm: VatRhythm = "monthly"): FilingPeriod[] {
  if (!isTaxFilingKind(kind)) throw new Error("Unknown tax-return kind.");
  if (kind !== "ustva") {
    const range = fiscalYearRange(year, startMonth);
    return [{ key: String(year), from: range.from, to: range.to, month: null, quarter: null }];
  }
  if (rhythm === "quarterly") return [1, 2, 3, 4].map((quarter) => quarterPeriod(year, quarter));
  return Array.from({ length: 12 }, (_, index) => monthPeriod(year, index + 1));
}

export function filingPeriod(kind: TaxFilingKind, year: number, periodKey: string, startMonth = 1): FilingPeriod {
  if (isAnnualKind(kind)) {
    if (periodKey !== String(year)) throw new Error("An annual return uses the year as its period.");
    return filingPeriods(kind, year, startMonth)[0];
  }
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (monthMatch && Number(monthMatch[1]) === year) {
    const month = Number(monthMatch[2]);
    if (month >= 1 && month <= 12) return monthPeriod(year, month);
  }
  const quarterMatch = /^(\d{4})-Q([1-4])$/.exec(periodKey);
  if (quarterMatch && Number(quarterMatch[1]) === year) return quarterPeriod(year, Number(quarterMatch[2]));
  throw new Error("The period does not belong to this return.");
}

/** The key in `statutoryObligations`; a quarter shares the last month's VAT date. */
export function obligationKeyFor(kind: TaxFilingKind, year: number, periodKey: string): string {
  if (kind === "ustva") {
    const period = filingPeriod(kind, year, periodKey);
    const month = period.month ?? (period.quarter ?? 1) * 3;
    return `ustva-${year}-${String(month).padStart(2, "0")}`;
  }
  if (kind === "ust-annual") return `ust-return-${year}`;
  if (kind === "kst") return `kst-return-${year}`;
  return `gewst-return-${year}`;
}

/**
 * Look the date up in the statutory calendar instead of repeating the month arithmetic.
 * A return for year Y is due in Y+1 or Y+2, so those calendars are searched too.
 */
export function filingDueDate(
  kind: TaxFilingKind,
  year: number,
  periodKey: string,
  settings: ObligationSettings,
): string | null {
  const key = obligationKeyFor(kind, year, periodKey);
  for (const dueYear of [year, year + 1, year + 2]) {
    const found = statutoryObligations(dueYear, settings).find((item) => item.key === key);
    if (found) return found.dueDate;
  }
  return null;
}

export function filingKindsFor(company: { kleinunternehmer: boolean }): TaxFilingKind[] {
  const kinds: TaxFilingKind[] = [];
  if (!company.kleinunternehmer) kinds.push("ustva", "ust-annual");
  kinds.push("kst", "gewst");
  return kinds;
}

const TRANSITIONS: Record<TaxFilingStatus, TaxFilingStatus[]> = {
  draft: ["calculated"],
  calculated: ["checked", "draft"],
  checked: ["ready", "calculated"],
  ready: ["submitted_manually", "calculated"],
  submitted_manually: ["corrected"],
  accepted: ["corrected"],
  rejected: ["calculated", "corrected"],
  failed: ["calculated"],
  corrected: [],
  archived: [],
};

export function canTransition(from: TaxFilingStatus, to: TaxFilingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(status: TaxFilingStatus): TaxFilingStatus[] {
  return [...TRANSITIONS[status]];
}

export function assertTransition(from: TaxFilingStatus, to: TaxFilingStatus): void {
  if (!canTransition(from, to)) throw new Error(`A return cannot move from ${from} to ${to}.`);
}

export function isSubmitted(status: TaxFilingStatus): boolean {
  return status === "submitted_manually" || status === "accepted";
}

export function isEditable(status: TaxFilingStatus): boolean {
  return status === "draft" || status === "calculated" || status === "checked" || status === "ready";
}

export type FilingCheckInput = {
  kind: TaxFilingKind;
  year: number;
  periodKey: string;
  status: TaxFilingStatus;
  dueDate: string | null;
  today: string;
  stale: boolean;
  company: {
    legalName: string;
    street: string;
    postalCode: string;
    city: string;
    taxNumber: string;
    vatId: string;
    kleinunternehmer: boolean;
  };
  figuresEmpty: boolean;
  stats: {
    journalEntries: number;
    openInvoices: number;
    invoiceVatCents: number | null;
    journalVatCents: number | null;
  };
  duplicate: boolean;
};

/** Pure checklist. A block stops the release; a warning needs a deliberate confirmation. */
export function runFilingChecks(input: FilingCheckInput): FilingCheck[] {
  const checks: FilingCheck[] = [];
  const add = (code: string, severity: FilingSeverity, message: string) => checks.push({ code, severity, message });

  if (!input.company.legalName || !input.company.street || !input.company.postalCode || !input.company.city) {
    add("master-data", "block", "The company address and legal name are incomplete.");
  }
  if (!input.company.taxNumber && !input.company.vatId) {
    add("master-data", "block", "A tax number or VAT id is needed on the return.");
  }
  if (input.kind === "ustva" && input.company.kleinunternehmer) {
    add("kleinunternehmer", "block", "VAT advance returns are hidden while the §19 exemption is active.");
  }
  if (input.duplicate) {
    add("duplicate", "block", "An active return already exists for this period.");
  }
  if (input.stale) {
    add("stale", "block", "The books changed after the last calculation. Calculate the return again.");
  }
  if (input.figuresEmpty) {
    add("no-figures", "block", "The return has no calculated figures yet.");
  }
  if (input.status === "draft") {
    add("not-calculated", "info", "Calculate the figures before checking the return.");
  }

  if (input.dueDate === null) {
    add("deadline", "warn", "No statutory date was found for this period. Confirm it with the tax office.");
  } else if (input.dueDate < input.today) {
    add("deadline", "warn", `The statutory date was ${input.dueDate} and has passed.`);
  } else if (input.dueDate <= addDays(input.today, 7)) {
    add("deadline", "warn", `The statutory date is ${input.dueDate}.`);
  }

  if (input.stats.journalEntries === 0) {
    add("period-empty", "warn", "No journal entry lies in this period. An empty return can still be correct.");
  }
  if (input.stats.openInvoices > 0) {
    add("open-invoices", "info", `${input.stats.openInvoices} draft invoice(s) lie in this period and are not in the books yet.`);
  }
  if (
    input.stats.invoiceVatCents !== null &&
    input.stats.journalVatCents !== null &&
    Math.abs(input.stats.invoiceVatCents - input.stats.journalVatCents) > 1
  ) {
    add(
      "vat-invoices",
      "warn",
      "VAT on issued invoices differs from the VAT accounts. Check the posting of an invoice or a credit.",
    );
  }
  if (input.kind === "kst" || input.kind === "gewst") {
    add("annual-accounts", "info", "Keep the annual accounts and the E-Bilanz in view; they are separate from this classification.");
    if (input.company.kleinunternehmer) {
      add("annual-ust", "info", "The company uses the §19 exemption. VAT returns stay out; the profit still belongs in this return.");
    }
  }
  add("manual-path", "info", "This desk prepares and checks. It does not transmit by itself in this version; record the submission afterwards.");
  return checks;
}

export function blockingChecks(checks: FilingCheck[]): FilingCheck[] {
  return checks.filter((check) => check.severity === "block");
}

export function warningChecks(checks: FilingCheck[]): FilingCheck[] {
  return checks.filter((check) => check.severity === "warn");
}

export function checkSummary(checks: FilingCheck[]): { block: number; warn: number; info: number; ok: boolean } {
  const block = checks.filter((check) => check.severity === "block").length;
  const warn = checks.filter((check) => check.severity === "warn").length;
  const info = checks.filter((check) => check.severity === "info").length;
  return { block, warn, info, ok: block === 0 && warn === 0 };
}

export function canRelease(checks: FilingCheck[], warningsConfirmed: boolean): string | null {
  const blocks = blockingChecks(checks);
  if (blocks.length > 0) return blocks[0].message;
  if (warningChecks(checks).length > 0 && !warningsConfirmed) {
    return "Confirm the warnings before releasing the return.";
  }
  return null;
}

/** Stable JSON for hashing and export. Object key order never changes the hash. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function formatPeriod(kind: TaxFilingKind, year: number, periodKey: string): string {
  if (isAnnualKind(kind)) return String(year);
  const period = filingPeriod(kind, year, periodKey);
  if (period.quarter) return `Q${period.quarter} ${year}`;
  const parsed = parseIso(period.from);
  return `${String(parsed.m).padStart(2, "0")}/${year}`;
}