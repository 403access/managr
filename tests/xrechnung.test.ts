import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { formatDate } from "@/domain/calendar";
import { KLEINUNTERNEHMER_NOTE } from "@/domain/invoice";
import { REDUCED_VAT_BPS, STANDARD_VAT_BPS } from "@/domain/rates-2026";
import { lineNetCents, summarizeVat } from "@/domain/vat";
import {
  XRECHNUNG_CUSTOMIZATION_ID,
  XRECHNUNG_NUMBER_BLOCKER,
  XRECHNUNG_PROFILE_ID,
  buildXRechnung,
  buyerReferenceProblem,
  countryCode,
  isValidBic,
  isValidIban,
  reviewXRechnung,
  xrechnungFilename,
  xrechnungStatusBlocker,
  type XRechnungInput,
} from "@/domain/xrechnung";
import { openDatabase } from "@/db/client";
import { tx } from "@/i18n";
import { localizeSample, seedIfEmpty } from "@/db/seed";
import { companies, customers, invoiceLines, invoices, payments } from "@/db/schema";

const files: string[] = [];

afterEach(() => {
  for (const file of files.splice(0)) fs.rmSync(file, { force: true });
});

const seller = {
  name: "Atelier Nordlicht UG (haftungsbeschränkt)",
  street: "Sonnenallee 12",
  postalCode: "12045",
  city: "Berlin",
  country: "Deutschland",
  email: "hallo@atelier-nordlicht.example",
  vatId: "de999999999",
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

function wellFormed(xml: string) {
  expect(xml.startsWith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")).toBe(true);
  const body = xml.replace(/<\?[^?]+\?>/, "");
  const tags = body.match(/<\/?[^>]+>/g) ?? [];
  const stack: string[] = [];
  for (const tag of tags) {
    const closing = tag.startsWith("</");
    const name = tag.replace(/^<\/?/, "").replace(/[\s>].*$/, "").replace(/>$/, "");
    if (closing) expect(stack.pop()).toBe(name);
    else if (!tag.endsWith("/>")) stack.push(name);
  }
  expect(stack).toEqual([]);
}

describe("XRechnung identifiers", () => {
  it("names the XRechnung 3.0.2 UBL specification", () => {
    expect(XRECHNUNG_CUSTOMIZATION_ID).toBe("urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0");
    expect(XRECHNUNG_PROFILE_ID).toBe("urn:fdc:peppol.eu:2017:poacc:billing:01:1.0");
  });

  it("accepts a checksum-valid IBAN and a BIC, and maps country names", () => {
    expect(isValidIban("DE89370400440532013000")).toBe(true);
    expect(isValidIban("de89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("DE89370400440532013001")).toBe(false);
    expect(isValidIban("")).toBe(false);
    expect(isValidBic("COBADEFFXXX")).toBe(true);
    expect(isValidBic("coba de ff xxx")).toBe(true);
    expect(isValidBic("NOPE")).toBe(false);
    expect(countryCode("Deutschland")).toBe("DE");
    expect(countryCode("österreich")).toBe("AT");
    expect(countryCode("FR")).toBe("FR");
    expect(countryCode("Narnia")).toBeNull();
    expect(countryCode("DX")).toBeNull();
  });

  it("blocks a draft, a void invoice, and an unknown status", () => {
    expect(xrechnungStatusBlocker("draft")).toMatch(/Issue the invoice/);
    expect(xrechnungStatusBlocker("void")).toMatch(/credit note/);
    expect(xrechnungStatusBlocker("issued")).toBeNull();
    expect(xrechnungStatusBlocker("paid")).toBeNull();
    expect(xrechnungStatusBlocker("partial")).toBeNull();
    expect(xrechnungStatusBlocker("open")).toMatch(/cannot be written/);
  });
});

describe("XRechnung review", () => {
  it("accepts a complete standard-rated invoice", () => {
    expect(reviewXRechnung(ready()).blockers).toEqual([]);
  });

  it("requires the buyer reference, electronic addresses, phone, IBAN, and a German VAT id", () => {
    expect(reviewXRechnung(ready({ buyerReference: " " })).blockers).toContain(
      "The e-invoice needs a buyer reference (BT-10). For a public-sector customer this is the Leitweg-ID.",
    );
    expect(reviewXRechnung(ready({ seller: { ...ready().seller, email: "hallo@" } })).blockers).toContain(
      "The seller e-mail address is missing or not usable as an electronic address (BT-34).",
    );
    expect(reviewXRechnung(ready({ buyer: { ...ready().buyer, email: "" } })).blockers).toContain(
      "The buyer e-mail address is missing or not usable as an electronic address (BT-49).",
    );
    expect(reviewXRechnung(ready({ seller: { ...ready().seller, phone: "123" } })).blockers).toContain(
      "The seller contact needs a phone number (BT-42).",
    );
    expect(reviewXRechnung(ready({ seller: { ...ready().seller, iban: "" } })).blockers).toContain(
      "The e-invoice needs a valid IBAN for the SEPA credit transfer (BT-84).",
    );
    expect(reviewXRechnung(ready({ seller: { ...ready().seller, bic: "NOPE" } })).blockers).toContain(
      "The BIC is not usable (BT-86).",
    );
    expect(reviewXRechnung(ready({ seller: { ...ready().seller, vatId: "" } })).blockers).toContain(
      "A standard-rated e-invoice needs the seller VAT id (USt-IdNr., BT-31).",
    );
    expect(reviewXRechnung(ready({ seller: { ...ready().seller, vatId: "DE123" } })).blockers).toContain(
      "The seller VAT id must be a German USt-IdNr. (DE and nine digits).",
    );
    expect(reviewXRechnung(ready({ buyer: { ...ready().buyer, vatId: "not-a-vat" } })).blockers).toContain(
      "The buyer VAT id must look like a VAT identifier.",
    );
    expect(reviewXRechnung(ready({ seller: { ...ready().seller, country: "Narnia" } })).blockers).toContain(
      "The seller country cannot be written as an ISO code.",
    );
    expect(buyerReferenceProblem("x".repeat(101))).toMatch(/too long/);
    expect(reviewXRechnung(ready({ number: "" })).blockers).toContain(XRECHNUNG_NUMBER_BLOCKER);
    expect(tx("de", "The e-invoice needs a buyer reference (BT-10). For a public-sector customer this is the Leitweg-ID.")).toContain("Leitweg-ID");
    expect(tx("de", "A void invoice is a ledger reversal. The desk does not write a credit note.")).toContain("Gutschrift");
  });

  it("lets a 0% line through only with an exemption sentence", () => {
    const lines = [{ description: "Workshop", quantityMilli: 1000, unitNetCents: 10_000, netCents: 10_000, vatBps: 0 }];
    const missing = ready({ lines, exemptionNote: "" });
    expect(reviewXRechnung(missing).blockers).toContain("A 0% line needs an exemption sentence on the e-invoice (BT-120).");
    const exempt = ready({ lines, exemptionNote: "Steuerfrei nach § 4 Nr. 1 UStG." });
    expect(reviewXRechnung(exempt).blockers).toEqual([]);
  });

  it("keeps the §14 blockers from reviewInvoice", () => {
    const input = ready({ seller: { ...ready().seller, name: "Nordlicht Studio" } });
    expect(reviewXRechnung(input).blockers.join(" ")).toMatch(/UG/);
  });
});

describe("XRechnung XML", () => {
  it("writes a standard invoice with SEPA payment, both tax schemes, and the §35a particulars", () => {
    const xml = buildXRechnung(ready({ notes: "Bitte die Referenz angeben." }));
    wellFormed(xml);
    expect(xml.indexOf("<cbc:CustomizationID>")).toBeLessThan(xml.indexOf("<cbc:ProfileID>"));
    expect(xml.indexOf("<cbc:ProfileID>")).toBeLessThan(xml.indexOf("<cbc:BuyerReference>"));
    expect(xml.indexOf("</cac:AccountingCustomerParty>")).toBeLessThan(xml.indexOf("<cac:Delivery>"));
    expect(xml.indexOf("</cac:Delivery>")).toBeLessThan(xml.indexOf("<cac:PaymentMeans>"));
    expect(xml.indexOf("</cac:TaxTotal>")).toBeLessThan(xml.indexOf("<cac:LegalMonetaryTotal>"));
    expect(xml.indexOf("</cac:LegalMonetaryTotal>")).toBeLessThan(xml.indexOf("<cac:InvoiceLine>"));
    expect(xml).toContain(`<cbc:CustomizationID>${XRECHNUNG_CUSTOMIZATION_ID}</cbc:CustomizationID>`);
    expect(xml).toContain("<cbc:ID>RE-2026-0001</cbc:ID>");
    expect(xml).toContain("<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>");
    expect(xml).toContain("<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>");
    expect(xml).toContain("<cbc:BuyerReference>LF-BER-2026</cbc:BuyerReference>");
    expect(xml).toContain("<cbc:Note>Bitte die Referenz angeben.</cbc:Note>");
    expect(xml).toContain('<cbc:EndpointID schemeID="EM">hallo@atelier-nordlicht.example</cbc:EndpointID>');
    expect(xml).toContain('<cbc:EndpointID schemeID="EM">ap@havel.example</cbc:EndpointID>');
    expect(xml).toContain("Havel &amp; Sohn AG");
    expect(xml).not.toContain("Havel & Sohn");
    expect(xml).toContain("<cbc:IdentificationCode>DE</cbc:IdentificationCode>");
    expect(xml).toContain("<cbc:CompanyID>DE999999999</cbc:CompanyID>");
    expect(xml).toContain("<cbc:CompanyID>30/123/45678</cbc:CompanyID>");
    expect(xml).toContain("<cbc:ID>VAT</cbc:ID>");
    expect(xml).toContain("<cbc:ID>FC</cbc:ID>");
    expect(xml).toContain("<cbc:CompanyID>HRB 123456 B</cbc:CompanyID>");
    expect(xml).toContain("Geschäftsführer: Mara Elling");
    expect(xml).toContain("<cbc:ActualDeliveryDate>2026-11-02</cbc:ActualDeliveryDate>");
    expect(xml).toContain("<cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>");
    expect(xml).toContain("<cbc:ID>DE89370400440532013000</cbc:ID>");
    expect(xml).toContain("<cbc:ID>COBADEFFXXX</cbc:ID>");
    expect(xml).toContain(`Zahlbar bis ${formatDate("2026-11-16")} ohne Abzug.`);
    expect(xml).toContain('<cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>');
    expect(xml).toContain("<cbc:Percent>19</cbc:Percent>");
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>');
    expect(xml).toContain('<cbc:TaxInclusiveAmount currencyID="EUR">119.00</cbc:TaxInclusiveAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">119.00</cbc:PayableAmount>');
    expect(xml).not.toContain("PrepaidAmount");
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>');
    expect(xml).toContain('<cbc:PriceAmount currencyID="EUR">100.00</cbc:PriceAmount>');
    expect(xrechnungFilename("RE-2026-0001")).toBe("RE-2026-0001-xrechnung.xml");
    expect(xrechnungFilename("RE/2026 0001")).toBe("RE_2026_0001-xrechnung.xml");
  });

  it("splits 7% and 19%, rounds the line, and reduces the payable amount by what was prepaid", () => {
    const lines = [
      { description: "Druck", quantityMilli: 3000, unitNetCents: 3_333, netCents: lineNetCents(3000, 3_333), vatBps: REDUCED_VAT_BPS },
      { description: "Beratung", quantityMilli: 1500, unitNetCents: 10_000, netCents: lineNetCents(1500, 10_000), vatBps: STANDARD_VAT_BPS },
    ];
    const xml = buildXRechnung(ready({ lines, prepaidCents: 5_000 }));
    wellFormed(xml);
    const reduced = xml.indexOf("<cbc:Percent>7</cbc:Percent>");
    const standard = xml.indexOf("<cbc:Percent>19</cbc:Percent>");
    expect(reduced).toBeGreaterThan(0);
    expect(reduced).toBeLessThan(standard);
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="C62">3</cbc:InvoicedQuantity>');
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="C62">1.5</cbc:InvoicedQuantity>');
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="EUR">99.99</cbc:LineExtensionAmount>');
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="EUR">150.00</cbc:LineExtensionAmount>');
    expect(xml).toContain('<cbc:PrepaidAmount currencyID="EUR">50.00</cbc:PrepaidAmount>');
    const summary = summarizeVat(lines.map((line) => ({ netCents: line.netCents, vatBps: line.vatBps })), false);
    const payable = ((summary.grossCents - 5_000) / 100).toFixed(2);
    expect(xml).toContain(`<cbc:PayableAmount currencyID="EUR">${payable}</cbc:PayableAmount>`);
  });

  it("writes a Kleinunternehmer invoice as category E with the §19 sentence and no VAT identifier", () => {
    const lines = [{ description: "Workshop", quantityMilli: 1000, unitNetCents: 10_000, netCents: 10_000, vatBps: 0 }];
    const input = ready({
      lines,
      exemptionNote: KLEINUNTERNEHMER_NOTE,
      seller: { ...ready().seller, vatId: "" },
    });
    expect(reviewXRechnung(input).blockers).toEqual([]);
    const xml = buildXRechnung(input);
    wellFormed(xml);
    expect(xml).toContain("<cbc:ID>E</cbc:ID>");
    expect(xml).toContain("<cbc:Percent>0</cbc:Percent>");
    expect(xml).toContain(`<cbc:TaxExemptionReason>${KLEINUNTERNEHMER_NOTE}</cbc:TaxExemptionReason>`);
    expect(xml).toContain("<cbc:ID>FC</cbc:ID>");
    expect(xml).not.toContain("<cbc:ID>VAT</cbc:ID>\n        <cac:TaxScheme>\n          <cbc:ID>VAT</cbc:ID>");
    expect(xml).not.toContain("DE999999999");
    expect(xml).toContain('<cbc:TaxAmount currencyID="EUR">0.00</cbc:TaxAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">100.00</cbc:PayableAmount>');
    expect(xml.match(/<cbc:TaxExemptionReason>/g)).toHaveLength(1);
  });

  it("escapes a description and refuses to build a blocked invoice", () => {
    const lines = [{ description: "Beratung & Konzept <Workshop>", quantityMilli: 1000, unitNetCents: 10_000, netCents: 10_000, vatBps: STANDARD_VAT_BPS }];
    const xml = buildXRechnung(ready({ lines }));
    expect(xml).toContain("Beratung &amp; Konzept &lt;Workshop&gt;");
    expect(() => buildXRechnung(ready({ buyerReference: "" }))).toThrow(/BT-10/);
  });
});

describe("sample buyer references", () => {
  it("stores a reference on every sample invoice and restores a cleared one only while it is the sample", () => {
    const file = path.join(os.tmpdir(), `managr-xr-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    files.push(file);
    const db = openDatabase(file);
    seedIfEmpty(db);
    const issued = db.select().from(invoices).all().filter((row) => row.status !== "draft");
    expect(issued.length).toBeGreaterThan(0);
    expect(issued.every((row) => row.buyerReference.length > 0)).toBe(true);
    const lichtfeld = db.select().from(customers).all().find((row) => row.name === "Lichtfeld GmbH");
    expect(lichtfeld?.buyerReference).toBe("LF-BER-2026");
    const target = issued[0]!;
    db.update(invoices).set({ buyerReference: "" }).where(eq(invoices.id, target.id)).run();
    localizeSample(db);
    expect(db.select().from(invoices).where(eq(invoices.id, target.id)).get()?.buyerReference).not.toBe("");
    db.update(companies).set({ isSample: false }).where(eq(companies.id, 1)).run();
    db.update(invoices).set({ buyerReference: "" }).where(eq(invoices.id, target.id)).run();
    localizeSample(db);
    expect(db.select().from(invoices).where(eq(invoices.id, target.id)).get()?.buyerReference).toBe("");
  });

  it("writes an XRechnung for a seeded sample invoice", () => {
    const file = path.join(os.tmpdir(), `managr-xr-file-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
    files.push(file);
    const db = openDatabase(file);
    seedIfEmpty(db);
    const company = db.select().from(companies).get();
    const invoice = db.select().from(invoices).all().find((row) => row.status === "paid");
    expect(company).toBeTruthy();
    expect(invoice?.number).toBeTruthy();
    if (!company || !invoice?.number) return;
    const customer = db.select().from(customers).where(eq(customers.id, invoice.customerId)).get();
    const lines = db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoice.id)).all();
    const paid = db.select().from(payments).where(eq(payments.invoiceId, invoice.id)).all();
    expect(customer).toBeTruthy();
    if (!customer) return;
    const priced = lines.map((line) => ({
      description: line.description,
      quantityMilli: line.quantityMilli,
      unitNetCents: line.unitNetCents,
      netCents: lineNetCents(line.quantityMilli, line.unitNetCents),
      vatBps: line.vatBps,
    }));
    const summary = summarizeVat(priced.map((line) => ({ netCents: line.netCents, vatBps: line.vatBps })), false);
    const prepaidCents = paid.reduce((sum, payment) => sum + payment.amountCents, 0);
    const xml = buildXRechnung({
      number: invoice.number,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      serviceDate: invoice.serviceDate,
      buyerReference: invoice.buyerReference,
      notes: invoice.notes,
      exemptionNote: invoice.exemptionNote,
      seller: {
        name: company.legalName,
        street: company.street,
        postalCode: company.postalCode,
        city: company.city,
        country: company.country,
        email: company.email,
        vatId: company.vatId,
        phone: company.phone,
        taxNumber: company.taxNumber,
        registerCourt: company.registerCourt,
        registerNumber: company.registerNumber,
        managingDirector: company.managingDirector,
        iban: company.iban,
        bic: company.bic,
      },
      buyer: {
        name: customer.name,
        street: customer.street,
        postalCode: customer.postalCode,
        city: customer.city,
        country: customer.country,
        email: customer.email,
        vatId: customer.vatId,
      },
      lines: priced,
      byRate: summary.byRate,
      netCents: summary.netCents,
      vatCents: summary.vatCents,
      grossCents: summary.grossCents,
      prepaidCents,
    });
    wellFormed(xml);
    expect(xml).toContain(`<cbc:ID>${invoice.number}</cbc:ID>`);
    expect(xml).toContain(`<cbc:BuyerReference>${invoice.buyerReference}</cbc:BuyerReference>`);
    expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">0.00</cbc:PayableAmount>');
  });
});
