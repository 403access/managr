/** The recipient's role decides whether an XRechnung applies and what BT-10 carries. */
export const CUSTOMER_KINDS = ["business", "public", "private"] as const;

export type CustomerKind = (typeof CUSTOMER_KINDS)[number];

export const DEFAULT_CUSTOMER_KIND: CustomerKind = "business";

export function isCustomerKind(value: unknown): value is CustomerKind {
  return typeof value === "string" && (CUSTOMER_KINDS as readonly string[]).includes(value);
}

/** A stored value from before the customer type existed, or an unknown one, is a business. */
export function normalizeCustomerKind(value: string): CustomerKind {
  return isCustomerKind(value) ? value : DEFAULT_CUSTOMER_KIND;
}

export const CUSTOMER_RELATIONSHIPS = ["all", "withProjects", "withoutProjects", "withInvoices", "withoutInvoices"] as const;

export type CustomerRelationship = (typeof CUSTOMER_RELATIONSHIPS)[number];

export type CustomerFilter = {
  query: string;
  /** A country name, or `""` for every country. */
  country: string;
  relationship: CustomerRelationship;
};

export type FilterableCustomer = {
  name: string;
  city: string;
  country: string;
  email: string;
  website: string;
  vatId: string;
  buyerReference: string;
  projectCount: number;
  invoiceCount: number;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function searchText(customer: FilterableCustomer): string {
  return normalize(
    [
      customer.name,
      customer.city,
      customer.country,
      customer.email,
      customer.website,
      customer.vatId,
      customer.buyerReference,
    ].join(" "),
  );
}

/** Customers narrowed by a free-text query, country, and whether they carry projects or invoices. */
export function filterCustomers<T extends FilterableCustomer>(customers: readonly T[], filter: CustomerFilter): T[] {
  const needle = normalize(filter.query.trim());
  const country = normalize(filter.country.trim());
  return customers.filter((customer) => {
    if (country && normalize(customer.country) !== country) return false;
    if (filter.relationship === "withProjects" && customer.projectCount === 0) return false;
    if (filter.relationship === "withoutProjects" && customer.projectCount > 0) return false;
    if (filter.relationship === "withInvoices" && customer.invoiceCount === 0) return false;
    if (filter.relationship === "withoutInvoices" && customer.invoiceCount > 0) return false;
    return !needle || searchText(customer).includes(needle);
  });
}

export const CUSTOMER_SORT_KEYS = ["name", "city", "projectCount", "minutes", "invoiceCount", "revenueCents", "openCents"] as const;

export type CustomerSortKey = (typeof CUSTOMER_SORT_KEYS)[number];

export type SortDirection = "asc" | "desc";

export const DEFAULT_CUSTOMER_SORT: CustomerSortKey = "name";

/** Text columns start at A–Z, figures with the largest first. */
export function defaultCustomerDirection(key: CustomerSortKey): SortDirection {
  return key === "name" || key === "city" ? "asc" : "desc";
}

export type SortableCustomer = FilterableCustomer & {
  minutes: number;
  revenueCents: number;
  openCents: number;
};

function compareByKey(left: SortableCustomer, right: SortableCustomer, key: CustomerSortKey): number {
  switch (key) {
    case "city":
      return left.city.localeCompare(right.city);
    case "projectCount":
      return left.projectCount - right.projectCount;
    case "minutes":
      return left.minutes - right.minutes;
    case "invoiceCount":
      return left.invoiceCount - right.invoiceCount;
    case "revenueCents":
      return left.revenueCents - right.revenueCents;
    case "openCents":
      return left.openCents - right.openCents;
    default:
      return left.name.localeCompare(right.name);
  }
}

/** Customers in the chosen order. Ties always fall back to the name, even in descending order. */
export function sortCustomers<T extends SortableCustomer>(
  customers: readonly T[],
  key: CustomerSortKey = DEFAULT_CUSTOMER_SORT,
  direction: SortDirection = defaultCustomerDirection(key),
): T[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...customers].sort((left, right) => compareByKey(left, right, key) * factor || left.name.localeCompare(right.name));
}