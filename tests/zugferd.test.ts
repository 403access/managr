import { describe, expect, it } from "vitest";
import { FacturX } from "factur-x-kit";
import { PDFDocument } from "pdf-lib";
import { KLEINUNTERNEHMER_NOTE } from "@/domain/invoice";
import { REDUCED_VAT_BPS, STANDARD_VAT_BPS } from "@/domain/rates-2026";
import { summarizeVat } from "@/domain/vat";
import { BUYER_REFERENCE_FALLBACK, type XRechnungInput } from "@/domain/xrechnung";
import { toZugferdInput, zugferdFilename, zugferdPdf } from "@/server/zugferd";

const seller = {
  name: "Atelier Nordlicht UG (haftungsbeschränkt)",
  street: "Sonnenallee 12",
  postalCode: "12045",
  city: "Berlin",
  country: "Deutschland",
  email: "hallo@atelier-nordlicht.example",
  vatId: "DE999999999",
  phone: "+49 30 12045670",
  taxNumber: "30/123/45678",
  registerCourt: "Amtsgericht Berlin-Charlottenburg",
  registerNumber: "HRB 123456 B",
  managingDirector: "Mara Elling",
  iban: "DE89 3704 0044 0532 0130 00",
  bic: "COBADEFFXXX",
};

const buyer = {
  name: "Havel & Sohn AG",
  street: "Havelchaussee 2",
  postalCode: "14193",
  city: "Berlin",
  country: "Deutschland",
  email: "ap@havel.example",
  vatId: "DE222222222",
};

function ready(patch: Partial<XRechnungInput> = {}): XRechnungInput {
  const lines = patch.lines ?? [
    { description: "Workshop", quantityMilli: 1000, unitNetCents: 10_000, netCents: 10_000, vatBps: STANDARD_VAT_BPS },
  ];
  const summary = summarizeVat(lines.map((line) => ({ netCents: line.netCents, vatBps: line.vatBps })), false);
  return {
    number: "RE-2026-0001",
    issueDate: "2026-11-02",
    dueDate: "2026-11-16",
    serviceDate: "2026-11-02",
    customerKind: "business",
    buyerReference: "LF-BER-2026",
    notes: "",
    exemptionNote: "",
    lines,
    byRate: summary.byRate,
    netCents: summary.netCents,
    vatCents: summary.vatCents,
    grossCents: summary.grossCents,
    prepaidCents: 0,
    ...patch,
    seller: { ...seller, ...patch.seller },
    buyer: { ...buyer, ...patch.buyer },
  };
}

describe("ZUGFeRD input", () => {
  it("maps the invoice onto the EN 16931 CII profile", () => {
    const input = toZugferdInput(ready());
    expect(input.document).toMatchObject({
      id: "RE-2026-0001",
      type: "380",
      dateOfIssue: { year: 2026, month: 11, day: 2 },
      currency: "EUR",
    });
    expect(input.seller.name).toBe("Atelier Nordlicht UG (haftungsbeschränkt)");
    expect(input.seller.taxIdentification).toEqual({ vatId: "DE999999999", localTaxId: "30/123/45678" });
    expect(input.buyer.reference).toBe("LF-BER-2026");
    expect(input.buyer.taxIdentification).toEqual({ vatId: "DE222222222" });
    expect(input.invoiceLines).toHaveLength(1);
    expect(input.invoiceLines[0]).toMatchObject({
      generalLineData: { lineId: "1" },
      productDescription: { name: "Workshop" },
      delivery: { itemQuantity: { quantity: 1, unit: "C62" } },
      productPriceAgreement: { productPricing: { basisPricePerItem: 100 } },
      settlement: { tax: { categoryCode: "S", rateApplicablePercent: 19 } },
    });
    expect(input.paymentInformation.paymentMeans?.[0]).toMatchObject({
      paymentType: "58",
      payeeBankAccount: { iban: "DE89370400440532013000", bic: "COBADEFFXXX" },
    });
    expect(input.paymentInformation.paymentTerms?.dueDate).toEqual({ year: 2026, month: 11, day: 16 });
  });

  it("carries prepaid amounts, the 7% rate, and the exemption reason", () => {
    const lines = [
      { description: "Druck", quantityMilli: 3000, unitNetCents: 3_333, netCents: 9_999, vatBps: REDUCED_VAT_BPS },
      { description: "Beratung", quantityMilli: 1500, unitNetCents: 10_000, netCents: 15_000, vatBps: STANDARD_VAT_BPS },
    ];
    const input = toZugferdInput(ready({ lines, prepaidCents: 5_000 }));
    expect(input.invoiceLines.map((line) => line.settlement.tax)).toEqual([
      { categoryCode: "S", rateApplicablePercent: 7 },
      { categoryCode: "S", rateApplicablePercent: 19 },
    ]);
    expect(input.totals?.prepaidAmount).toBe(50);

    const exempt = toZugferdInput(
      ready({
        lines: [{ description: "Workshop", quantityMilli: 1000, unitNetCents: 10_000, netCents: 10_000, vatBps: 0 }],
        exemptionNote: KLEINUNTERNEHMER_NOTE,
      }),
    );
    expect(exempt.invoiceLines[0]?.settlement.tax).toEqual({ categoryCode: "E" });
    expect(exempt.totals?.taxExemptionReason).toEqual([
      { reason: KLEINUNTERNEHMER_NOTE, categoryCode: "E" },
    ]);
  });

  it("writes the fallback for a business invoice without a reference", () => {
    expect(toZugferdInput(ready({ buyerReference: "" })).buyer.reference).toBe(BUYER_REFERENCE_FALLBACK);
  });

  it("identifies a seller without a VAT id", () => {
    const corporation = toZugferdInput(ready({ seller: { ...seller, vatId: "", registerNumber: "HRB 123456 B" } }));
    expect(corporation.seller.specifiedLegalOrganization).toEqual({ id: { id: "HRB 123456 B" } });
    expect(corporation.seller.id).toBeUndefined();

    const small = toZugferdInput(ready({ seller: { ...seller, vatId: "", registerNumber: "" } }));
    expect(small.seller.id).toEqual(["30/123/45678"]);
    expect(small.seller.specifiedLegalOrganization).toBeUndefined();
  });
});

describe("ZUGFeRD PDF", () => {
  it("renders a PDF/A-3 file with the CII XML attached", async () => {
    const result = await zugferdPdf(ready(), "de-DE");
    expect("pdf" in result).toBe(true);
    if (!("pdf" in result)) return;
    expect(result.filename).toBe("RE-2026-0001-zugferd.pdf");
    expect(Buffer.from(result.pdf.slice(0, 5)).toString()).toBe("%PDF-");
    const parsed = await FacturX.fromPDF(result.pdf);
    const xml = await parsed.getXML();
    expect(xml).toContain("<rsm:CrossIndustryInvoice");
    expect(xml).toContain("<ram:BuyerReference>LF-BER-2026</ram:BuyerReference>");
    expect(xml).toContain("<ram:ID>RE-2026-0001</ram:ID>");
    expect(xml).toContain("<ram:GrandTotalAmount>119.00</ram:GrandTotalAmount>");
  });

  it("uses the fallback and keeps the placeholder out of the stored input", async () => {
    const result = await zugferdPdf(ready({ buyerReference: "" }), "de-DE");
    if (!("pdf" in result)) throw new Error(result.blockers.join(" "));
    const xml = await (await FacturX.fromPDF(result.pdf)).getXML();
    expect(xml).toContain(`<ram:BuyerReference>${BUYER_REFERENCE_FALLBACK}</ram:BuyerReference>`);
  });

  it("blocks a public customer without a Leitweg-ID and a private customer", async () => {
    const publicResult = await zugferdPdf(ready({ customerKind: "public", buyerReference: "" }), "de-DE");
    expect(publicResult).toEqual({ blockers: ["The e-invoice needs the Leitweg-ID as buyer reference (BT-10) for a public-sector customer."] });
    const privateResult = await zugferdPdf(ready({ customerKind: "private", buyerReference: "" }), "de-DE");
    expect("blockers" in privateResult).toBe(true);
  });

  it("names the file after the invoice number", () => {
    expect(zugferdFilename("RE/2026 0001")).toBe("RE_2026_0001-zugferd.pdf");
    expect(zugferdFilename("")).toBe("rechnung-zugferd.pdf");
  });

  it("paginates a long invoice without losing lines", async () => {
    const lines = Array.from({ length: 60 }, (_, index) => ({
      description: `Position ${index + 1}`,
      quantityMilli: 1000,
      unitNetCents: 1_000,
      netCents: 1_000,
      vatBps: STANDARD_VAT_BPS,
    }));
    const result = await zugferdPdf(ready({ lines }), "de-DE");
    if (!("pdf" in result)) throw new Error(result.blockers.join(" "));
    const document = await PDFDocument.load(result.pdf);
    expect(document.getPageCount()).toBeGreaterThan(1);
    const xml = await (await FacturX.fromPDF(result.pdf)).getXML();
    expect(xml.match(/<ram:LineID>/g)).toHaveLength(60);
  });
});
