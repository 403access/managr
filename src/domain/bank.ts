export type QontoEnvironment = "production" | "sandbox";

export function qontoBaseUrl(environment: QontoEnvironment): string {
  return environment === "sandbox" ? "https://thirdparty-sandbox.staging.qonto.co/v2" : "https://thirdparty.qonto.com/v2";
}

/** The Qonto API key is `sign-in:secret-key`, concatenated without base64. */
export function qontoAuthorization(login: string, secretKey: string): string {
  return `${login}:${secretKey}`;
}

export type QontoCounterparty = {
  counterparty_account_number?: string | null;
  counterparty_bank_identifier?: string | null;
};

export type QontoBankAccount = {
  id?: string | null;
  slug?: string | null;
  iban?: string | null;
  bic?: string | null;
  currency?: string | null;
  balance?: number | null;
  balance_cents?: number | null;
  authorized_balance?: number | null;
  authorized_balance_cents?: number | null;
  name?: string | null;
  updated_at?: string | null;
  status?: string | null;
  main?: boolean | null;
  is_external_account?: boolean | null;
};

export type QontoTransaction = {
  id?: string | null;
  transaction_id?: string | null;
  bank_account_id?: string | null;
  amount?: number | null;
  amount_cents?: number | null;
  local_amount_cents?: number | null;
  side?: string | null;
  operation_type?: string | null;
  currency?: string | null;
  local_currency?: string | null;
  label?: string | null;
  clean_counterparty_name?: string | null;
  settled_at?: string | null;
  emitted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
  note?: string | null;
  reference?: string | null;
  vat_amount?: number | null;
  vat_amount_cents?: number | null;
  vat_rate?: number | null;
  attachment_ids?: (string | null)[] | null;
  attachments?: unknown[] | null;
  card_last_digits?: string | null;
  category?: string | null;
  cashflow_category?: { name?: string | null } | null;
  cashflow_subcategory?: { name?: string | null } | null;
  subject_type?: string | null;
  transfer?: QontoCounterparty | null;
  income?: QontoCounterparty | null;
  swift_income?: QontoCounterparty | null;
  direct_debit?: QontoCounterparty | null;
  direct_debit_collection?: QontoCounterparty | null;
};

export type QontoOrganization = {
  id: string;
  name: string;
  slug: string;
  legalName: string;
  bankAccounts: QontoBankAccount[];
};

export type BankAccountRecord = {
  externalId: string;
  name: string;
  slug: string;
  iban: string;
  bic: string;
  currency: string;
  balanceCents: number;
  authorizedBalanceCents: number;
  status: string;
  main: boolean;
  external: boolean;
  updatedAt: string;
};

export type BankTransactionRecord = {
  externalId: string;
  externalRef: string;
  status: string;
  side: "credit" | "debit";
  amountCents: number;
  currency: string;
  bookedOn: string;
  emittedAt: string;
  settledAt: string;
  createdAt: string;
  updatedAt: string;
  label: string;
  counterpartyName: string;
  reference: string;
  note: string;
  operationType: string;
  subjectType: string;
  category: string;
  cashflowCategory: string;
  cashflowSubcategory: string;
  vatAmountCents: number | null;
  vatRateBps: number | null;
  cardLastDigits: string;
  counterpartyIban: string;
  counterpartyBic: string;
  attachmentCount: number;
};

function integerCents(primary: number | null | undefined, fallbackEuro: number | null | undefined): number {
  if (typeof primary === "number" && Number.isFinite(primary) && Number.isInteger(primary)) return primary;
  if (typeof fallbackEuro === "number" && Number.isFinite(fallbackEuro)) return Math.round(fallbackEuro * 100);
  return 0;
}

export function mapQontoAccount(raw: QontoBankAccount): BankAccountRecord | null {
  if (!raw.id) return null;
  return {
    externalId: raw.id,
    name: (raw.name ?? "").trim() || (raw.slug ?? "").trim() || raw.iban || "Qonto",
    slug: raw.slug ?? "",
    iban: raw.iban ?? "",
    bic: raw.bic ?? "",
    currency: raw.currency ?? "EUR",
    balanceCents: integerCents(raw.balance_cents, raw.balance),
    authorizedBalanceCents: integerCents(raw.authorized_balance_cents, raw.authorized_balance),
    status: raw.status ?? "active",
    main: raw.main === true,
    external: raw.is_external_account === true,
    updatedAt: raw.updated_at ?? "",
  };
}

function berlinDate(timestamp: string | null | undefined): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function qontoVatRateBps(rate: number | null | undefined): number | null {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return null;
  return Math.round(rate * 100);
}

function counterpartyOf(raw: QontoTransaction): QontoCounterparty | null {
  return raw.transfer ?? raw.income ?? raw.swift_income ?? raw.direct_debit ?? raw.direct_debit_collection ?? null;
}

export function mapQontoTransaction(raw: QontoTransaction): BankTransactionRecord | null {
  if (!raw.id) return null;
  const side = raw.side === "debit" ? "debit" : "credit";
  const cents = integerCents(raw.amount_cents, raw.amount);
  const amountCents = side === "debit" ? -Math.abs(cents) : Math.abs(cents);
  const bookedOn = berlinDate(raw.settled_at ?? raw.emitted_at ?? raw.created_at ?? raw.updated_at);
  if (!bookedOn) return null;
  const counterparty = counterpartyOf(raw);
  const attachments = Array.isArray(raw.attachment_ids)
    ? raw.attachment_ids.filter(Boolean).length
    : Array.isArray(raw.attachments)
      ? raw.attachments.length
      : 0;
  return {
    externalId: raw.id,
    externalRef: raw.transaction_id ?? "",
    status: raw.status ?? "completed",
    side,
    amountCents,
    currency: raw.currency ?? "EUR",
    bookedOn,
    emittedAt: raw.emitted_at ?? "",
    settledAt: raw.settled_at ?? "",
    createdAt: raw.created_at ?? "",
    updatedAt: raw.updated_at ?? "",
    label: raw.label ?? "",
    counterpartyName: (raw.clean_counterparty_name ?? raw.label ?? "").trim(),
    reference: raw.reference ?? "",
    note: raw.note ?? "",
    operationType: raw.operation_type ?? "",
    subjectType: raw.subject_type ?? "",
    category: raw.category ?? "",
    cashflowCategory: raw.cashflow_category?.name ?? "",
    cashflowSubcategory: raw.cashflow_subcategory?.name ?? "",
    vatAmountCents:
      typeof raw.vat_amount_cents === "number"
        ? raw.vat_amount_cents
        : typeof raw.vat_amount === "number"
          ? Math.round(raw.vat_amount * 100)
          : null,
    vatRateBps: qontoVatRateBps(raw.vat_rate),
    cardLastDigits: raw.card_last_digits ?? "",
    counterpartyIban: counterparty?.counterparty_account_number ?? "",
    counterpartyBic: counterparty?.counterparty_bank_identifier ?? "",
    attachmentCount: attachments,
  };
}

export function bankTotals(accounts: { balanceCents: number; authorizedBalanceCents: number; status: string; main: boolean }[]) {
  const active = accounts.filter((account) => account.status !== "closed");
  return {
    balanceCents: active.reduce((sum, account) => sum + account.balanceCents, 0),
    authorizedBalanceCents: active.reduce((sum, account) => sum + account.authorizedBalanceCents, 0),
    accountCount: accounts.length,
    activeCount: active.length,
    mainBalanceCents: active.filter((account) => account.main).reduce((sum, account) => sum + account.balanceCents, 0),
  };
}

export function bankPeriodSummary(rows: { amountCents: number; status: string }[]) {
  const completed = rows.filter((row) => row.status === "completed");
  const inflowCents = completed.filter((row) => row.amountCents > 0).reduce((sum, row) => sum + row.amountCents, 0);
  const outflowCents = completed.filter((row) => row.amountCents < 0).reduce((sum, row) => sum - row.amountCents, 0);
  return {
    count: rows.length,
    completedCount: completed.length,
    pendingCount: rows.filter((row) => row.status === "pending").length,
    inflowCents,
    outflowCents,
    netCents: inflowCents - outflowCents,
  };
}

/** The transactions are pulled again with one day of overlap, so late updates are not missed. */
export function qontoSyncWindow(lastSyncedAt: string | null, now = new Date()): { from: string; to: string } {
  const to = now.toISOString();
  const initial = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
  if (!lastSyncedAt) return { from: initial, to };
  const watermark = Date.parse(lastSyncedAt);
  if (Number.isNaN(watermark)) return { from: initial, to };
  return { from: new Date(watermark - 24 * 60 * 60 * 1000).toISOString(), to };
}

export function qontoErrorMessage(status: number, detail = ""): string {
  if (status === 401) return "Qonto rejected the sign-in or secret key.";
  if (status === 403) return "Qonto refused the request. The API key needs the organization.read permission.";
  if (status === 429) return "Qonto is limiting requests. Try again in a minute.";
  const suffix = detail.trim() ? ` ${detail.trim()}` : "";
  return `Qonto returned HTTP ${status}.${suffix}`;
}

export function maskSecret(secret: string): string {
  return secret.length <= 4 ? "••••" : `••••${secret.slice(-4)}`;
}