import { describe, expect, it } from "vitest";
import { ACCOUNTS, journalImbalance, type DraftLine } from "@/domain/accounts";
import { KLEINUNTERNEHMER_NOTE, reviewInvoice, type InvoiceReviewInput } from "@/domain/invoice";
import { buildCustomerPayment, buildSalesInvoice, reverseLines } from "@/domain/postings";
import { REDUCED_VAT_BPS, STANDARD_VAT_BPS } from "@/domain/rates-2026";
import { lineNetCents, summarizeVat } from "@/domain/vat";
import { displayStatus } from "@/server/queries";

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
  issueDate: "2026-11-02",
  serviceDate: "2026-11-02",
  lines: [{ description: "Workshop", quantityMilli: 1000, netCents: 10_000 }],
  kleinunternehmer: false,
  exemptionNote: "",
  vatCents: 1_900,
};

function side(lines: DraftLine[], code: string, which: "debitCents" | "creditCents"): number {
  return lines.filter((line) => line.accountCode === code).reduce((sum, line) => sum + line[which], 0);
}

describe("invoice review", () => {
  it("accepts a complete invoice at 19%", () => {
    expect(reviewInvoice(ready)).toEqual({ blockers: [], warnings: [] });
  });

  it("accepts the long legal name and either tax number or VAT id", () => {
    expect(reviewInvoice({ ...ready, legalName: "Atelier Nordlicht Unternehmergesellschaft (haftungsbeschränkt)" }).blockers).toEqual([]);
    expect(reviewInvoice({ ...ready, vatId: "" }).blockers).toEqual([]);
    expect(reviewInvoice({ ...ready, taxNumber: "" }).blockers).toEqual([]);
  });

  it.each([
    ["legal name", { legalName: "Nordlicht Studio" }, /UG/],
    ["supplier address", { supplierStreet: "" }, /address is incomplete/],
    ["tax particulars", { taxNumber: "", vatId: "" }, /tax number or a VAT id/],
    ["register court", { registerCourt: " " }, /register court/],
    ["HRB number", { registerNumber: "" }, /HRB/],
    ["managing director", { managingDirector: "" }, /managing director/],
    ["customer address", { customerPostalCode: "" }, /customer/],
    ["issue date", { issueDate: "" }, /issue date/],
    ["date of supply", { serviceDate: "" }, /date of supply/],
    ["empty lines", { lines: [] }, /description and a quantity/],
    ["blank description", { lines: [{ description: " ", quantityMilli: 1000, netCents: 10_000 }] }, /description and a quantity/],
    ["zero quantity", { lines: [{ description: "Workshop", quantityMilli: 0, netCents: 10_000 }] }, /description and a quantity/],
  ])("blocks a draft that is missing the %s", (_label, patch, pattern) => {
    expect(reviewInvoice({ ...ready, ...patch }).blockers.join(" ")).toMatch(pattern);
  });

  it("warns about a missing IBAN and still allows issue", () => {
    const result = reviewInvoice({ ...ready, iban: " " });
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual(["No IBAN yet. The invoice can still be issued."]);
  });

  it("accepts a Kleinunternehmer invoice with the §19 sentence and no VAT", () => {
    const result = reviewInvoice({ ...ready, kleinunternehmer: true, vatCents: 0, exemptionNote: KLEINUNTERNEHMER_NOTE });
    expect(result.blockers).toEqual([]);
  });

  it("blocks a Kleinunternehmer invoice that shows VAT or omits the sentence", () => {
    expect(reviewInvoice({ ...ready, kleinunternehmer: true, vatCents: 1_900, exemptionNote: KLEINUNTERNEHMER_NOTE }).blockers).toContain(
      "A Kleinunternehmer invoice must not show VAT.",
    );
    expect(reviewInvoice({ ...ready, kleinunternehmer: true, vatCents: 0, exemptionNote: "§ 19 UStG" }).blockers).toContain(
      "Add the § 19 UStG exemption sentence.",
    );
    expect(reviewInvoice({ ...ready, kleinunternehmer: true, vatCents: 0, exemptionNote: "" }).blockers).toContain(
      "Add the § 19 UStG exemption sentence.",
    );
  });

  it("does not require the §19 sentence on a regular or exempt invoice", () => {
    expect(reviewInvoice({ ...ready, vatCents: 0 }).blockers).toEqual([]);
    expect(reviewInvoice(ready).blockers).toEqual([]);
  });

  it("accepts an Einzelunternehmen without a register entry or managing director", () => {
    const result = reviewInvoice({
      ...ready,
      legalName: "Mara Elling",
      legalForm: "einzelunternehmen",
      registerCourt: "",
      registerNumber: "",
      managingDirector: "",
    });
    expect(result.blockers).toEqual([]);
  });
});

describe("invoice amounts", () => {
  it("prices a quantity and adds 19% once", () => {
    expect(lineNetCents(1500, 20_000)).toBe(30_000);
    const totals = summarizeVat([{ netCents: 30_000, vatBps: STANDARD_VAT_BPS }], false);
    expect(totals).toMatchObject({ netCents: 30_000, vatCents: 5_700, grossCents: 35_700 });
  });

  it("prices a reduced-rate invoice at 7%", () => {
    const totals = summarizeVat([{ netCents: 10_000, vatBps: REDUCED_VAT_BPS }], false);
    expect(totals).toMatchObject({ netCents: 10_000, vatCents: 700, grossCents: 10_700 });
  });

  it("keeps an exempt invoice equal to its net", () => {
    const totals = summarizeVat([{ netCents: 10_000, vatBps: 0 }], false);
    expect(totals).toMatchObject({ netCents: 10_000, vatCents: 0, grossCents: 10_000 });
  });

  it("keeps a Kleinunternehmer invoice equal to its net", () => {
    const totals = summarizeVat([{ netCents: 10_000, vatBps: 0 }], true);
    expect(totals).toMatchObject({ netCents: 10_000, vatCents: 0, grossCents: 10_000 });
  });

  it("rounds mixed rates once per rate", () => {
    const totals = summarizeVat(
      [
        { netCents: 10_000, vatBps: STANDARD_VAT_BPS },
        { netCents: 5_000, vatBps: REDUCED_VAT_BPS },
      ],
      false,
    );
    expect(totals.byRate).toEqual([
      { vatBps: REDUCED_VAT_BPS, netCents: 5_000, vatCents: 350 },
      { vatBps: STANDARD_VAT_BPS, netCents: 10_000, vatCents: 1_900 },
    ]);
    expect(totals.grossCents).toBe(17_250);
  });

  it("refuses a Kleinunternehmer line that carries a rate", () => {
    expect(() => summarizeVat([{ netCents: 10_000, vatBps: STANDARD_VAT_BPS }], true)).toThrow(/Kleinunternehmer/);
  });
});

describe("invoice postings", () => {
  it("posts a 19% invoice to receivables, revenue, and VAT", () => {
    const totals = summarizeVat([{ netCents: 10_000, vatBps: STANDARD_VAT_BPS }], false);
    const lines = buildSalesInvoice({ kleinunternehmer: false, byRate: totals.byRate });
    expect(journalImbalance(lines)).toBeNull();
    expect(side(lines, ACCOUNTS.receivables, "debitCents")).toBe(11_900);
    expect(side(lines, ACCOUNTS.revenue19, "creditCents")).toBe(10_000);
    expect(side(lines, ACCOUNTS.vat19, "creditCents")).toBe(1_900);
  });

  it("posts a 7% invoice to the reduced accounts", () => {
    const totals = summarizeVat([{ netCents: 10_000, vatBps: REDUCED_VAT_BPS }], false);
    const lines = buildSalesInvoice({ kleinunternehmer: false, byRate: totals.byRate });
    expect(side(lines, ACCOUNTS.receivables, "debitCents")).toBe(10_700);
    expect(side(lines, ACCOUNTS.revenue7, "creditCents")).toBe(10_000);
    expect(side(lines, ACCOUNTS.vat7, "creditCents")).toBe(700);
    expect(side(lines, ACCOUNTS.vat19, "creditCents")).toBe(0);
  });

  it("posts both rates of a mixed invoice against one receivable", () => {
    const totals = summarizeVat(
      [
        { netCents: 10_000, vatBps: STANDARD_VAT_BPS },
        { netCents: 5_000, vatBps: REDUCED_VAT_BPS },
      ],
      false,
    );
    const lines = buildSalesInvoice({ kleinunternehmer: false, byRate: totals.byRate });
    expect(journalImbalance(lines)).toBeNull();
    expect(side(lines, ACCOUNTS.receivables, "debitCents")).toBe(17_250);
    expect(side(lines, ACCOUNTS.revenue19, "creditCents")).toBe(10_000);
    expect(side(lines, ACCOUNTS.revenue7, "creditCents")).toBe(5_000);
    expect(side(lines, ACCOUNTS.vat19, "creditCents")).toBe(1_900);
    expect(side(lines, ACCOUNTS.vat7, "creditCents")).toBe(350);
  });

  it("posts an exempt invoice without a VAT account", () => {
    const totals = summarizeVat([{ netCents: 10_000, vatBps: 0 }], false);
    const lines = buildSalesInvoice({ kleinunternehmer: false, byRate: totals.byRate });
    expect(lines).toEqual([
      { accountCode: ACCOUNTS.receivables, debitCents: 10_000, creditCents: 0 },
      { accountCode: ACCOUNTS.revenueExempt, debitCents: 0, creditCents: 10_000 },
    ]);
  });

  it("posts a Kleinunternehmer invoice to the §19 revenue account and no VAT", () => {
    const totals = summarizeVat([{ netCents: 10_000, vatBps: 0 }], true);
    const lines = buildSalesInvoice({ kleinunternehmer: true, byRate: totals.byRate });
    expect(lines).toEqual([
      { accountCode: ACCOUNTS.receivables, debitCents: 10_000, creditCents: 0 },
      { accountCode: ACCOUNTS.revenueKlein, debitCents: 0, creditCents: 10_000 },
    ]);
  });

  it("refuses to post VAT on a Kleinunternehmer invoice", () => {
    expect(() =>
      buildSalesInvoice({
        kleinunternehmer: true,
        byRate: [{ vatBps: 0, netCents: 10_000, vatCents: 1_900 }],
      }),
    ).toThrow(/cannot post VAT/);
  });

  it("posts the single rounded VAT amount for several lines of one rate", () => {
    const totals = summarizeVat(
      [
        { netCents: 1, vatBps: STANDARD_VAT_BPS },
        { netCents: 1, vatBps: STANDARD_VAT_BPS },
        { netCents: 1, vatBps: STANDARD_VAT_BPS },
      ],
      false,
    );
    const lines = buildSalesInvoice({ kleinunternehmer: false, byRate: totals.byRate });
    expect(side(lines, ACCOUNTS.vat19, "creditCents")).toBe(1);
    expect(side(lines, ACCOUNTS.receivables, "debitCents")).toBe(4);
  });

  it("records a full payment and a partial payment against the receivable", () => {
    const full = buildCustomerPayment(11_900);
    expect(full).toEqual([
      { accountCode: ACCOUNTS.bank, debitCents: 11_900, creditCents: 0 },
      { accountCode: ACCOUNTS.receivables, debitCents: 0, creditCents: 11_900 },
    ]);
    const partial = buildCustomerPayment(5_000);
    expect(side(partial, ACCOUNTS.receivables, "creditCents")).toBe(5_000);
    expect(journalImbalance(partial)).toBeNull();
  });

  it("reverses a VAT invoice and a Kleinunternehmer invoice", () => {
    const vat = buildSalesInvoice({
      kleinunternehmer: false,
      byRate: summarizeVat([{ netCents: 10_000, vatBps: STANDARD_VAT_BPS }], false).byRate,
    });
    const klein = buildSalesInvoice({
      kleinunternehmer: true,
      byRate: summarizeVat([{ netCents: 10_000, vatBps: 0 }], true).byRate,
    });
    for (const invoice of [vat, klein]) {
      const reversal = reverseLines(invoice);
      expect(journalImbalance(reversal)).toBeNull();
      expect(side(reversal, ACCOUNTS.receivables, "creditCents")).toBe(side(invoice, ACCOUNTS.receivables, "debitCents"));
      expect(side(reversal, ACCOUNTS.vat19, "debitCents")).toBe(side(invoice, ACCOUNTS.vat19, "creditCents"));
    }
    expect(side(reverseLines(klein), ACCOUNTS.revenueKlein, "debitCents")).toBe(10_000);
    expect(side(reverseLines(klein), ACCOUNTS.vat19, "debitCents")).toBe(0);
  });

  it("refuses an empty invoice and a non-positive payment", () => {
    expect(() => buildSalesInvoice({ kleinunternehmer: false, byRate: [] })).toThrow(/positive/);
    expect(() => buildCustomerPayment(0)).toThrow(/positive/);
  });
});

describe("invoice status", () => {
  const today = "2026-11-02";

  it("leaves draft, paid, and void unchanged", () => {
    expect(displayStatus("draft", "2026-10-01", today)).toBe("draft");
    expect(displayStatus("paid", "2026-10-01", today)).toBe("paid");
    expect(displayStatus("void", "2026-10-01", today)).toBe("void");
  });

  it("shows an issued invoice as open on the due date and overdue the day after", () => {
    expect(displayStatus("issued", "2026-11-02", today)).toBe("open");
    expect(displayStatus("issued", "2026-11-03", today)).toBe("open");
    expect(displayStatus("issued", "2026-11-01", today)).toBe("overdue");
  });

  it("shows a partial invoice as overdue only after the due date", () => {
    expect(displayStatus("partial", today, today)).toBe("partial");
    expect(displayStatus("partial", "2026-10-31", today)).toBe("overdue");
  });
});
