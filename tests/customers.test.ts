import { describe, expect, it } from "vitest";
import {
  DEFAULT_CUSTOMER_SORT,
  defaultCustomerDirection,
  filterCustomers,
  sortCustomers,
  type FilterableCustomer,
} from "@/domain/customers";

type Sample = FilterableCustomer & { id: number; minutes: number; revenueCents: number; openCents: number };

const customers: Sample[] = [
  {
    id: 1,
    name: "Lichtfeld GmbH",
    city: "Berlin",
    country: "Deutschland",
    email: "finance@lichtfeld.example",
    website: "https://lichtfeld.example",
    vatId: "DE111111111",
    buyerReference: "LF-BER-2026",
    projectCount: 2,
    invoiceCount: 3,
    minutes: 640,
    revenueCents: 480_000,
    openCents: 120_000,
  },
  {
    id: 2,
    name: "Kiezküche e.K.",
    city: "Potsdam",
    country: "Deutschland",
    email: "hello@kiezkueche.example",
    website: "",
    vatId: "",
    buyerReference: "",
    projectCount: 0,
    invoiceCount: 0,
    minutes: 0,
    revenueCents: 0,
    openCents: 0,
  },
  {
    id: 3,
    name: "Havel & Sohn AG",
    city: "Berlin",
    country: "Österreich",
    email: "ap@havel.example",
    website: "",
    vatId: "ATU12345678",
    buyerReference: "HAVEL-PITCH",
    projectCount: 1,
    invoiceCount: 1,
    minutes: 420,
    revenueCents: 900_000,
    openCents: 0,
  },
];

function ids(list: Sample[]): number[] {
  return list.map((customer) => customer.id);
}

describe("customer filters", () => {
  it("returns every customer when no filter is set", () => {
    expect(ids(filterCustomers(customers, { query: "", country: "", relationship: "all" }))).toEqual([1, 2, 3]);
  });

  it("filters by free text, ignoring case, umlauts, and punctuation in the query", () => {
    expect(ids(filterCustomers(customers, { query: "kiezkueche", country: "", relationship: "all" }))).toEqual([2]);
    expect(ids(filterCustomers(customers, { query: "HAVEL", country: "", relationship: "all" }))).toEqual([3]);
    expect(ids(filterCustomers(customers, { query: "lf-ber", country: "", relationship: "all" }))).toEqual([1]);
    expect(ids(filterCustomers(customers, { query: "niemand", country: "", relationship: "all" }))).toEqual([]);
  });

  it("filters by country", () => {
    expect(ids(filterCustomers(customers, { query: "", country: "Deutschland", relationship: "all" }))).toEqual([1, 2]);
    expect(ids(filterCustomers(customers, { query: "", country: "Österreich", relationship: "all" }))).toEqual([3]);
  });

  it("filters by projects and invoices", () => {
    expect(ids(filterCustomers(customers, { query: "", country: "", relationship: "withProjects" }))).toEqual([1, 3]);
    expect(ids(filterCustomers(customers, { query: "", country: "", relationship: "withoutProjects" }))).toEqual([2]);
    expect(ids(filterCustomers(customers, { query: "", country: "", relationship: "withInvoices" }))).toEqual([1, 3]);
    expect(ids(filterCustomers(customers, { query: "", country: "", relationship: "withoutInvoices" }))).toEqual([2]);
  });

  it("combines filters", () => {
    expect(ids(filterCustomers(customers, { query: "havel", country: "Deutschland", relationship: "all" }))).toEqual([]);
    expect(ids(filterCustomers(customers, { query: "havel", country: "Österreich", relationship: "withProjects" }))).toEqual([3]);
  });
});

describe("customer sorting", () => {
  it("sorts by name by default", () => {
    expect(DEFAULT_CUSTOMER_SORT).toBe("name");
    expect(ids(sortCustomers(customers, DEFAULT_CUSTOMER_SORT))).toEqual([3, 2, 1]);
  });

  it("sorts by city and falls back to the name", () => {
    expect(ids(sortCustomers(customers, "city", "asc"))).toEqual([3, 1, 2]);
    expect(ids(sortCustomers(customers, "city", "desc"))).toEqual([2, 3, 1]);
  });

  it("sorts figures largest first by default", () => {
    expect(defaultCustomerDirection("projectCount")).toBe("desc");
    expect(defaultCustomerDirection("name")).toBe("asc");
    expect(ids(sortCustomers(customers, "projectCount"))).toEqual([1, 3, 2]);
    expect(ids(sortCustomers(customers, "minutes"))).toEqual([1, 3, 2]);
    expect(ids(sortCustomers(customers, "revenueCents"))).toEqual([3, 1, 2]);
    expect(ids(sortCustomers(customers, "openCents"))).toEqual([1, 3, 2]);
  });

  it("can reverse a figure sort", () => {
    expect(ids(sortCustomers(customers, "minutes", "asc"))).toEqual([2, 3, 1]);
  });

  it("keeps the input order for equal values", () => {
    const sorted = sortCustomers(customers, "projectCount", "desc");
    expect(sorted.filter((customer) => customer.projectCount === 0).map((customer) => customer.id)).toEqual([2]);
  });
});