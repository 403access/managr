import { describe, expect, it } from "vitest";
import {
  buildFilingCsv,
  buildFilingExport,
  buildUstvaImportXml,
  buildUstvaKennzahlenCsv,
  figureLines,
  formatVersionFor,
  xmlEscape,
  type VatFigures,
} from "@/domain/elster-format";

const figures: VatFigures = {
  kind: "ustva",
  from: "2026-03-01",
  to: "2026-03-31",
  taxable19Cents: 1_800_000,
  taxable7Cents: 100_000,
  exemptCents: 0,
  outputVat19Cents: 342_000,
  outputVat7Cents: 7_000,
  inputVat19Cents: 39_900,
  inputVat7Cents: 1_000,
  prepaymentsCents: 0,
  payableCents: 308_100,
};

describe("ELSTER VAT advance upload", () => {
  it("writes the data part with quarters, whole-euro bases, and cent amounts", () => {
    const xml = buildUstvaImportXml({
      figures,
      year: 2026,
      periodKey: "2026-Q1",
      taxNumber: "30/123/45678",
      vatId: "DE123456789",
      herstellerId: "12345",
      corrected: true,
      createdAt: "2026-04-01",
    });
    expect(xml).toContain('xmlns="http://finkonsens.de/elster/elsteranmeldung/ustva/v2026"');
    expect(xml).toContain("<Zeitraum>41</Zeitraum>");
    expect(xml).toContain("<Steuernummer>30/123/45678</Steuernummer>");
    expect(xml).toContain("<Kz09>12345</Kz09>");
    expect(xml).toContain("<Kz10>1</Kz10>");
    expect(xml).toContain("<Kz81>18000</Kz81>");
    expect(xml).toContain("<Kz86>1000</Kz86>");
    expect(xml).toContain("<Kz66>409.00</Kz66>");
    expect(xml).toContain("<Kz83>3081.00</Kz83>");
    expect(xml).toContain("<Erstellungsdatum>20260401</Erstellungsdatum>");
    expect(xml.indexOf("<Kz66>")).toBeLessThan(xml.indexOf("<Kz81>"));
    expect(xml.indexOf("<Kz81>")).toBeLessThan(xml.indexOf("<Kz83>"));
    expect(xml.indexOf("<Kz83>")).toBeLessThan(xml.indexOf("<Kz86>"));
  });

  it("uses a month number and falls back to the VAT id", () => {
    const xml = buildUstvaImportXml({
      figures,
      year: 2026,
      periodKey: "2026-03",
      taxNumber: "",
      vatId: "DE123456789",
      herstellerId: "",
      corrected: false,
      createdAt: "2026-04-01",
    });
    expect(xml).toContain("<Zeitraum>3</Zeitraum>");
    expect(xml).toContain("<WIdNr>DE123456789</WIdNr>");
    expect(xml).not.toContain("<Kz09>");
    expect(xml).not.toContain("<Kz10>");
  });

  it("refuses a return without any tax identifier", () => {
    expect(() =>
      buildUstvaImportXml({
        figures,
        year: 2026,
        periodKey: "2026-03",
        taxNumber: "",
        vatId: "",
        herstellerId: "",
        corrected: false,
        createdAt: "2026-04-01",
      }),
    ).toThrow();
  });
});

describe("tax export", () => {
  it("adds the UStVA Kennzahlen to a semicolon CSV", () => {
    const csv = buildUstvaKennzahlenCsv(figures);
    expect(csv.split("\r\n")[0]).toBe('"Kennzahl";"Bezeichnung";"Betrag"');
    expect(csv).toContain('"81";"Umsätze 19 %, netto (ganze Euro)";"18000"');
    expect(csv).toContain('"66";"Abziehbare Vorsteuer aus Rechnungen";"409.00"');
    expect(csv).toContain('"83";"Zahllast oder Überschuss";"3081.00"');
  });

  it("renders every figure in cents and euro", () => {
    const lines = figureLines(figures);
    expect(lines).toHaveLength(9);
    expect(lines[0]).toEqual({ key: "taxable19", cents: 1_800_000, wholeEuros: true });
    const csv = buildFilingCsv(figures);
    expect(csv).toContain('"taxable19";"1800000";"18000.00"');
  });

  it("wraps the snapshot with a disclaimer and the company", () => {
    const data = buildFilingExport({
      filing: {
        id: 1,
        kind: "ustva",
        year: 2026,
        periodKey: "2026-Q1",
        status: "checked",
        dueDate: "2026-04-13",
        figuresHash: "abc",
        submittedAt: null,
        notes: "",
        replacesId: null,
      },
      company: {
        legalName: "Atelier Nordlicht UG",
        street: "Hafenweg 8",
        postalCode: "24103",
        city: "Kiel",
        taxNumber: "30/123/45678",
        vatId: "DE123456789",
      },
      figures,
      checks: [],
      generatedAt: "2026-04-01T10:00:00.000Z",
    });
    expect(data.schema).toBe("managr.tax-filing/1");
    expect(data.disclaimer).toContain("not an ELSTER submission");
    expect(data.filing.periodKey).toBe("2026-Q1");
  });

  it("names the format per year and escapes XML", () => {
    expect(formatVersionFor("ustva", 2026)).toBe("UStVA-2026");
    expect(formatVersionFor("kst", 2026)).toBe("KSt1-2026");
    expect(xmlEscape("A & B < C")).toBe("A &amp; B &lt; C");
  });
});