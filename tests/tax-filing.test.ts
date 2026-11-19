import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  checkSummary,
  filingDueDate,
  filingKindsFor,
  filingPeriod,
  filingPeriods,
  formatPeriod,
  isEditable,
  nextStatuses,
  obligationKeyFor,
  runFilingChecks,
  type FilingCheckInput,
} from "@/domain/tax-filing";

const settings = { fiscalYearStartMonth: 1, vatPermanentExtension: false, usesTaxAdvisor: false };

describe("tax filing periods", () => {
  it("builds monthly and quarterly VAT periods", () => {
    const monthly = filingPeriods("ustva", 2026, 1, "monthly");
    const quarterly = filingPeriods("ustva", 2026, 1, "quarterly");
    expect(monthly).toHaveLength(12);
    expect(monthly[1]).toMatchObject({ key: "2026-02", from: "2026-02-01", to: "2026-02-28", month: 2, quarter: null });
    expect(quarterly).toHaveLength(4);
    expect(quarterly[0]).toMatchObject({ key: "2026-Q1", from: "2026-01-01", to: "2026-03-31", quarter: 1 });
    expect(filingPeriod("ustva", 2026, "2026-Q4", 1)).toMatchObject({ from: "2026-10-01", to: "2026-12-31" });
  });

  it("uses the fiscal year for annual returns", () => {
    const july = filingPeriods("kst", 2026, 7, "monthly")[0];
    expect(july).toMatchObject({ key: "2026", from: "2025-07-01", to: "2026-06-30" });
    expect(filingPeriod("kst", 2026, "2026", 7).key).toBe("2026");
    expect(formatPeriod("kst", 2026, "2026")).toBe("2026");
    expect(formatPeriod("ustva", 2026, "2026-Q2")).toBe("Q2 2026");
    expect(formatPeriod("ustva", 2026, "2026-03")).toBe("03/2026");
  });

  it("rejects a period from another year or kind", () => {
    expect(() => filingPeriod("ustva", 2026, "2025-03")).toThrow();
    expect(() => filingPeriod("ustva", 2026, "2026-Q5")).toThrow();
    expect(() => filingPeriod("kst", 2026, "2026-03")).toThrow();
  });
});

describe("tax filing dates", () => {
  it("looks the VAT date up in the statutory calendar", () => {
    expect(filingDueDate("ustva", 2026, "2026-09", settings)).toBe("2026-10-12");
    expect(filingDueDate("ustva", 2026, "2026-Q3", settings)).toBe("2026-10-12");
    expect(filingDueDate("ustva", 2026, "2026-08", { ...settings, vatPermanentExtension: true })).toBe("2026-10-12");
  });

  it("finds the annual return in the following year", () => {
    expect(filingDueDate("kst", 2025, "2025", settings)).toBe("2026-07-31");
    expect(filingDueDate("gewst", 2025, "2025", settings)).toBe("2026-07-31");
    expect(filingDueDate("ust-annual", 2025, "2025", settings)).toBe("2026-07-31");
    expect(filingDueDate("kst", 2025, "2025", { ...settings, usesTaxAdvisor: true })).toBe("2027-03-01");
  });

  it("maps a filing to the obligation key", () => {
    expect(obligationKeyFor("ustva", 2026, "2026-03")).toBe("ustva-2026-03");
    expect(obligationKeyFor("ustva", 2026, "2026-Q4")).toBe("ustva-2026-12");
    expect(obligationKeyFor("kst", 2025, "2025")).toBe("kst-return-2025");
  });
});

describe("tax filing state machine", () => {
  it("allows the review path and forbids skipping it", () => {
    expect(nextStatuses("draft")).toEqual(["calculated"]);
    expect(nextStatuses("calculated")).toContain("checked");
    expect(nextStatuses("checked")).toContain("ready");
    expect(nextStatuses("ready")).toContain("submitted_manually");
    expect(isEditable("ready")).toBe(true);
    expect(isEditable("submitted_manually")).toBe(false);
  });
});

describe("tax filing checks", () => {
  const base: FilingCheckInput = {
    kind: "ustva",
    year: 2026,
    periodKey: "2026-03",
    status: "calculated",
    dueDate: "2026-04-13",
    today: "2026-04-01",
    stale: false,
    company: {
      legalName: "Atelier Nordlicht UG",
      street: "Hafenweg 8",
      postalCode: "24103",
      city: "Kiel",
      taxNumber: "30/123/45678",
      vatId: "DE123456789",
      kleinunternehmer: false,
    },
    figuresEmpty: false,
    stats: { journalEntries: 4, openInvoices: 0, invoiceVatCents: 1900, journalVatCents: 1900 },
    duplicate: false,
  };

  it("passes a complete return and keeps the manual path as information", () => {
    const checks = runFilingChecks(base);
    expect(checks.filter((check) => check.severity === "block")).toHaveLength(0);
    expect(checks.some((check) => check.code === "manual-path")).toBe(true);
    expect(checkSummary(checks)).toMatchObject({ block: 0, warn: 0 });
  });

  it("blocks missing master data, duplicates, stale figures, and a Kleinunternehmer VAT return", () => {
    const checks = runFilingChecks({
      ...base,
      stale: true,
      duplicate: true,
      figuresEmpty: true,
      company: { ...base.company, street: "", taxNumber: "", kleinunternehmer: true },
    });
    const codes = checks.filter((check) => check.severity === "block").map((check) => check.code);
    expect(codes).toEqual(expect.arrayContaining(["master-data", "kleinunternehmer", "duplicate", "stale", "no-figures"]));
  });

  it("warns when the deadline is close and when invoice VAT differs", () => {
    const checks = runFilingChecks({
      ...base,
      today: "2026-04-08",
      stats: { ...base.stats, invoiceVatCents: 2500 },
    });
    expect(checks.some((check) => check.code === "deadline" && check.severity === "warn")).toBe(true);
    expect(checks.some((check) => check.code === "vat-invoices" && check.severity === "warn")).toBe(true);
  });
});

describe("tax filing helpers", () => {
  it("offers VAT kinds only outside the Kleinunternehmer rule", () => {
    expect(filingKindsFor({ kleinunternehmer: false })).toEqual(["ustva", "ust-annual", "kst", "gewst"]);
    expect(filingKindsFor({ kleinunternehmer: true })).toEqual(["kst", "gewst"]);
  });

  it("hashes canonical JSON independently of key order", () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
    expect(canonicalJson({ items: [{ y: 1, x: 2 }] })).toBe('{"items":[{"x":2,"y":1}]}');
  });
});