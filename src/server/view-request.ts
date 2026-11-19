export const VIEW_NAMES = [
  "shell",
  "desk",
  "command",
  "company",
  "invoices",
  "customers",
  "customer",
  "invoice",
  "invoice-new",
  "invoice-edit",
  "ledger",
  "cashflow",
  "bank",
  "people",
  "person",
  "org",
  "time",
  "time-days",
  "obligations",
  "documents",
  "legal",
  "projects",
  "analytics",
  "milestones",
  "settings",
] as const;

export type ViewName = (typeof VIEW_NAMES)[number];

export type ViewQuery = {
  id: number | null;
  year: number;
  week: string;
  /** First day of an explicit time range, or `null`. */
  from: string | null;
  /** Last day of an explicit time range, or `null`. */
  to: string | null;
  all: boolean;
  customer: number | null;
};

function isoDate(value: string | null): string | null {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const probe = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(probe.getTime()) || probe.toISOString().slice(0, 10) !== value) return null;
  return value;
}

export function parseViewName(name: string): ViewName | null {
  return VIEW_NAMES.find((item) => item === name) ?? null;
}

export function parseViewQuery(params: URLSearchParams, today: string): ViewQuery {
  const idValue = Number(params.get("id"));
  const id = Number.isInteger(idValue) && idValue >= 1 ? idValue : null;
  const current = Number(today.slice(0, 4));
  const requested = Number(params.get("year"));
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : current;
  const weekValue = params.get("week");
  const week = weekValue && /^\d{4}-\d{2}-\d{2}$/.test(weekValue) ? weekValue : today;
  const customerValue = Number(params.get("customer"));
  const customer = Number.isInteger(customerValue) && customerValue >= 1 ? customerValue : null;
  return {
    id,
    year,
    week,
    from: isoDate(params.get("from")),
    to: isoDate(params.get("to")),
    all: params.get("all") === "1",
    customer,
  };
}

export function viewIsReady(name: ViewName, query: Pick<ViewQuery, "id">): boolean {
  if (name === "invoice" || name === "invoice-edit" || name === "person" || name === "customer") return query.id !== null;
  return true;
}
