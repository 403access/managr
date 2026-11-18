import "server-only";
import {
  qontoAuthorization,
  qontoBaseUrl,
  qontoErrorMessage,
  type QontoBankAccount,
  type QontoEnvironment,
  type QontoOrganization,
  type QontoTransaction,
} from "@/domain/bank";

export type QontoCredentials = {
  login: string;
  secretKey: string;
  environment: QontoEnvironment;
  stagingToken: string;
};

type OrganizationResponse = {
  organization?: {
    id?: string;
    name?: string;
    slug?: string;
    legal_name?: string | null;
    bank_accounts?: QontoBankAccount[] | null;
  } | null;
};

type TransactionsResponse = {
  transactions?: QontoTransaction[] | null;
  meta?: { next_page?: number | null } | null;
};

async function qontoRequest<T>(credentials: QontoCredentials, path: string, params?: URLSearchParams): Promise<T> {
  if (!credentials.login) throw new Error("The Qonto sign-in is missing.");
  if (!credentials.secretKey) throw new Error("The Qonto secret key is missing.");
  if (credentials.environment === "sandbox" && !credentials.stagingToken) {
    throw new Error("A sandbox token is required for the Qonto sandbox.");
  }
  const url = new URL(`${qontoBaseUrl(credentials.environment)}${path}`);
  if (params) url.search = params.toString();
  const headers: Record<string, string> = {
    Authorization: qontoAuthorization(credentials.login, credentials.secretKey),
    Accept: "application/json",
  };
  if (credentials.environment === "sandbox") headers["X-Qonto-Staging-Token"] = credentials.stagingToken;

  let response: Response;
  try {
    response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new Error("Qonto did not answer in time.");
    throw new Error("Qonto could not be reached.");
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { errors?: { detail?: string }[] };
      detail = body.errors?.[0]?.detail ?? "";
    } catch {
      // An error without a JSON body still carries the status code.
    }
    throw new Error(qontoErrorMessage(response.status, detail));
  }

  return (await response.json()) as T;
}

export async function fetchQontoOrganization(credentials: QontoCredentials): Promise<QontoOrganization> {
  const body = await qontoRequest<OrganizationResponse>(credentials, "/organization");
  const organization = body.organization;
  if (!organization?.id) throw new Error("Qonto did not return an organization.");
  return {
    id: organization.id,
    name: (organization.name ?? "").trim() || (organization.legal_name ?? "").trim() || organization.slug || "Qonto",
    slug: organization.slug ?? "",
    legalName: (organization.legal_name ?? "").trim(),
    bankAccounts: Array.isArray(organization.bank_accounts) ? organization.bank_accounts : [],
  };
}

export async function fetchQontoTransactions(
  credentials: QontoCredentials,
  bankAccountId: string,
  from: string,
  to: string,
): Promise<QontoTransaction[]> {
  const rows: QontoTransaction[] = [];
  let page = 1;
  while (page <= 100) {
    const params = new URLSearchParams({
      bank_account_id: bankAccountId,
      updated_at_from: from,
      updated_at_to: to,
      per_page: "100",
      page: String(page),
    });
    for (const status of ["completed", "pending", "declined", "reversed"]) params.append("status[]", status);
    const body = await qontoRequest<TransactionsResponse>(credentials, "/transactions", params);
    rows.push(...(Array.isArray(body.transactions) ? body.transactions : []));
    const next = body.meta?.next_page;
    if (!next) return rows;
    page = next;
  }
  throw new Error("Qonto returned more transactions than one sync can load. Narrow the period.");
}