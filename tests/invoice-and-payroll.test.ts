import { describe, expect, it } from "vitest";
import { journalImbalance } from "@/domain/accounts";
import { KLEINUNTERNEHMER_NOTE, formatInvoiceNumber, isKleinunternehmerNote, reviewInvoice, type InvoiceReviewInput } from "@/domain/invoice";
import { estimateContributions, payrollAmounts, type SocialInput } from "@/domain/social";
import { buildExpense, buildPayroll, buildReserveAllocation, buildSalesInvoice, reverseLines } from "@/domain/postings";
import { summarizeVat } from "@/domain/vat";
import { countWorkdays, durationMinutes, minimumVacationDays, timeWarnings, weekStart } from "@/domain/time";

const ready: InvoiceReviewInput = {
  legalName: "Atelier Nordlicht UG (haftungsbeschränkt)",
  supplierStreet: "Sonnenallee 12",
  supplierPostalCode: "12045",
  supplierCity: "Berlin",
  taxNumber: "30/123/45678",
  vatId: "DE999999999",
  registerCourt: "Amtsgericht Berlin-Charlottenburg",
  registerNumber: "HRB 123456 B",
  managingDirector: "Mara Elling",
  iban: "DE89370400440532013000",
  customerName: "Lichtfeld GmbH",
  customerStreet: "Torstraße 1",
  customerPostalCode: "10119",
  customerCity: "Berlin",
  issueDate: "2026-10-12",
  serviceDate: "2026-10-12",
  lines: [{ description: "Workshop", quantityMilli: 1000, netCents: 320_000 }],
  kleinunternehmer: false,
  exemptionNote: "",
  vatCents: 60_800,
};

describe("invoices", () => {
  it("numbers without reusing a voided sequence", () => {
    expect(formatInvoiceNumber("RE-", 2026, 12)).toBe("RE-2026-0012");
  });

  it("blocks a draft that is missing the UG particulars", () => {
    expect(reviewInvoice(ready).blockers).toEqual([]);
    const broken = reviewInvoice({ ...ready, legalName: "Nordlicht Studio", registerNumber: "", kleinunternehmer: true, vatCents: 100, exemptionNote: "" });
    expect(broken.blockers.join(" ")).toMatch(/UG/);
    expect(broken.blockers.join(" ")).toMatch(/HRB/);
    expect(broken.blockers.join(" ")).toMatch(/must not show VAT/);
    expect(reviewInvoice({ ...ready, kleinunternehmer: true, vatCents: 0, exemptionNote: "§ 19 UStG" }).blockers.join(" ")).toMatch(/exemption sentence/);
    const clean = reviewInvoice({ ...ready, kleinunternehmer: true, vatCents: 0, exemptionNote: KLEINUNTERNEHMER_NOTE });
    expect(clean.blockers).toEqual([]);
    expect(isKleinunternehmerNote(KLEINUNTERNEHMER_NOTE)).toBe(true);
    expect(KLEINUNTERNEHMER_NOTE).toBe("Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.");
  });

  it("posts a sales invoice, a payment-sized expense, and a reversal that still balances", () => {
    const totals = summarizeVat([{ netCents: 320_000, vatBps: 1900 }], false);
    const invoice = buildSalesInvoice({ kleinunternehmer: false, byRate: totals.byRate });
    expect(journalImbalance(invoice)).toBeNull();
    expect(invoice[0]).toMatchObject({ debitCents: totals.grossCents });
    const expense = buildExpense({ expenseAccount: "4210", netCents: 85_000, vatBps: 1900, paidNow: true });
    expect(journalImbalance(expense)).toBeNull();
    expect(journalImbalance(reverseLines(invoice))).toBeNull();
    expect(journalImbalance(buildReserveAllocation(160_000))).toBeNull();
  });
});

describe("payroll posting and working time", () => {
  it("balances a salary posting and a minijob posting", () => {
    const salary = buildPayroll({
      minijob: false,
      grossCents: 160_000,
      withheldCents: 30_000,
      wageTaxCents: 8_000,
      employerSocialCents: 34_000,
      flatTaxCents: 0,
      payNow: true,
    });
    expect(journalImbalance(salary)).toBeNull();
    const minijob = buildPayroll({
      minijob: true,
      grossCents: 45_000,
      withheldCents: 1_620,
      wageTaxCents: 0,
      employerSocialCents: 12_600,
      flatTaxCents: 900,
      payNow: true,
    });
    expect(journalImbalance(minijob)).toBeNull();
    expect(minijob.some((line) => line.accountCode === "4195")).toBe(true);
  });

  it("keeps minijob flat tax out of employer social and still withholds wage tax from an exempt director", () => {
    const person: SocialInput = {
      grossMonthlyCents: 45_000,
      kind: "minijob",
      ownershipBps: 0,
      svStatus: "subject",
      stateCode: "BE",
      additionalKvBps: 290,
      childlessSurcharge: false,
      careDiscountSteps: 0,
      minijobPublicHealth: true,
      pensionOptOut: false,
      flatTax: true,
    };
    const mini = payrollAmounts(estimateContributions(person), 9_999);
    expect(mini).toMatchObject({ withheldCents: 1_620, wageTaxCents: 0, employerSocialCents: 12_600, flatTaxCents: 900, minijob: true });
    expect(journalImbalance(buildPayroll({ ...mini, grossCents: 45_000, payNow: true }))).toBeNull();

    const director = payrollAmounts(
      estimateContributions({ ...person, kind: "managing_director", ownershipBps: 10_000, svStatus: "automatic", grossMonthlyCents: 320_000 }),
      50_000,
    );
    expect(director).toMatchObject({ withheldCents: 0, wageTaxCents: 50_000, employerSocialCents: 0, flatTaxCents: 0, minijob: false });
    expect(journalImbalance(buildPayroll({ ...director, grossCents: 320_000, payNow: true }))).toBeNull();
  });

  it("warns on breaks and the 10-hour cap, and counts a Monday-Friday week", () => {
    expect(durationMinutes("09:00", "17:30", 30)).toBe(480);
    expect(timeWarnings(420, 0).map((warning) => warning.message).join(" ")).toMatch(/30-minute/);
    expect(timeWarnings(601, 60).some((warning) => warning.level === "stop")).toBe(true);
    expect(minimumVacationDays(5)).toBe(20);
    expect(countWorkdays("2026-10-05", "2026-10-11", 5)).toBe(5);
    expect(weekStart("2026-10-25")).toBe("2026-10-19");
  });
});
