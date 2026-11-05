export const VIEW_NAMES = [
  "shell",
  "desk",
  "company",
  "invoices",
  "customers",
  "invoice",
  "invoice-new",
  "invoice-edit",
  "ledger",
  "people",
  "person",
  "time",
  "obligations",
  "documents",
  "legal",
] as const;

export type ViewName = (typeof VIEW_NAMES)[number];

export type ViewQuery = {
  id: number | null;
  year: number;
  week: string;
  all: boolean;
};

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
  return { id, year, week, all: params.get("all") === "1" };
}

export function viewIsReady(name: ViewName, query: Pick<ViewQuery, "id">): boolean {
  if (name === "invoice" || name === "invoice-edit" || name === "person") return query.id !== null;
  return true;
}
