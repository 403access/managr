import type { FilingCheck, TaxFilingKind, TaxFilingStatus } from "./tax-filing";

export type VatFigures = {
  kind: "ustva" | "ust-annual";
  from: string;
  to: string;
  taxable19Cents: number;
  taxable7Cents: number;
  exemptCents: number;
  outputVat19Cents: number;
  outputVat7Cents: number;
  inputVat19Cents: number;
  inputVat7Cents: number;
  prepaymentsCents: number;
  payableCents: number;
};

export type ProfitFigures = {
  kind: "kst" | "gewst";
  from: string;
  to: string;
  revenueCents: number;
  expenseCents: number;
  profitBeforeTaxCents: number;
  lossCarryforwardCents: number;
  taxableCents: number;
  corporateCents: number;
  soliCents: number;
  tradeCents: number;
  totalCents: number;
  hebesatzPercent: number;
};

export type FilingFigures = VatFigures | ProfitFigures;

export type ExportInput = {
  filing: {
    id: number;
    kind: TaxFilingKind;
    year: number;
    periodKey: string;
    status: TaxFilingStatus;
    dueDate: string | null;
    figuresHash: string;
    submittedAt: string | null;
    notes: string;
    replacesId: number | null;
  };
  company: {
    legalName: string;
    street: string;
    postalCode: string;
    city: string;
    taxNumber: string;
    vatId: string;
  };
  figures: FilingFigures;
  checks: FilingCheck[];
  generatedAt: string;
};

export function formatVersionFor(kind: TaxFilingKind, year: number): string {
  if (kind === "ustva") return `UStVA-${year}`;
  if (kind === "ust-annual") return `USt-${year}`;
  if (kind === "kst") return `KSt1-${year}`;
  return `GewSt1-${year}`;
}

export function figureLines(figures: FilingFigures): { key: string; cents: number; wholeEuros: boolean }[] {
  if (figures.kind === "ustva" || figures.kind === "ust-annual") {
    return [
      { key: "taxable19", cents: figures.taxable19Cents, wholeEuros: true },
      { key: "taxable7", cents: figures.taxable7Cents, wholeEuros: true },
      { key: "exempt", cents: figures.exemptCents, wholeEuros: true },
      { key: "outputVat19", cents: figures.outputVat19Cents, wholeEuros: false },
      { key: "outputVat7", cents: figures.outputVat7Cents, wholeEuros: false },
      { key: "inputVat19", cents: figures.inputVat19Cents, wholeEuros: false },
      { key: "inputVat7", cents: figures.inputVat7Cents, wholeEuros: false },
      { key: "vatPrepayments", cents: figures.prepaymentsCents, wholeEuros: false },
      { key: "vatPayable", cents: figures.payableCents, wholeEuros: false },
    ];
  }
  const profit = figures as ProfitFigures;
  const base = [
    { key: "revenue", cents: profit.revenueCents, wholeEuros: false },
    { key: "expenses", cents: profit.expenseCents, wholeEuros: false },
    { key: "profitBeforeTax", cents: profit.profitBeforeTaxCents, wholeEuros: false },
    { key: "lossCarryforward", cents: profit.lossCarryforwardCents, wholeEuros: false },
    { key: "taxableBase", cents: profit.taxableCents, wholeEuros: false },
  ];
  if (figures.kind === "gewst") return [...base, { key: "tradeTax", cents: profit.tradeCents, wholeEuros: false }];
  return [
    ...base,
    { key: "corporateTax", cents: profit.corporateCents, wholeEuros: false },
    { key: "solidarity", cents: profit.soliCents, wholeEuros: false },
    { key: "taxTotal", cents: profit.totalCents, wholeEuros: false },
  ];
}

function decimal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

function wholeEuros(cents: number): string {
  return String(Math.round(cents / 100));
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * The upload format of Mein ELSTER for a VAT advance return. It carries only the
 * data part the portal accepts; the ERiC envelope belongs to the sidecar phase.
 * Amounts that the form shows in whole euros are written in whole euros.
 */
export function buildUstvaImportXml(input: {
  figures: VatFigures;
  year: number;
  periodKey: string;
  taxNumber: string;
  vatId: string;
  herstellerId: string;
  corrected: boolean;
  createdAt: string;
}): string {
  const period = /^\d{4}-Q([1-4])$/.exec(input.periodKey);
  const month = /^\d{4}-(\d{2})$/.exec(input.periodKey);
  if (!period && !month) throw new Error("A VAT advance return needs a month or a quarter.");
  const zeitraum = period ? String(40 + Number(period[1])) : String(Number(month![1]));
  if (!input.taxNumber && !input.vatId) throw new Error("A tax number or VAT id is needed for the upload.");
  const entries: string[] = [
    `<Jahr>${input.year}</Jahr>`,
    `<Zeitraum>${zeitraum}</Zeitraum>`,
    input.taxNumber ? `<Steuernummer>${xmlEscape(input.taxNumber)}</Steuernummer>` : "",
    !input.taxNumber && input.vatId ? `<WIdNr>${xmlEscape(input.vatId)}</WIdNr>` : "",
    input.herstellerId ? `<Kz09>${xmlEscape(input.herstellerId)}</Kz09>` : "",
    input.corrected ? "<Kz10>1</Kz10>" : "",
    `<Kz66>${decimal(input.figures.inputVat19Cents + input.figures.inputVat7Cents)}</Kz66>`,
    `<Kz81>${wholeEuros(input.figures.taxable19Cents)}</Kz81>`,
    `<Kz83>${decimal(input.figures.payableCents)}</Kz83>`,
    `<Kz86>${wholeEuros(input.figures.taxable7Cents)}</Kz86>`,
  ].filter(Boolean);
  const created = input.createdAt.replace(/-/g, "").slice(0, 8);
  return [
    '<?xml version="1.0" encoding="ISO-8859-15" standalone="no"?>',
    `<Anmeldungssteuern xmlns="http://finkonsens.de/elster/elsteranmeldung/ustva/v${input.year}" version="${input.year}">`,
    `<Erstellungsdatum>${created}</Erstellungsdatum>`,
    "<Steuerfall>",
    "<Umsatzsteuervoranmeldung>",
    ...entries,
    "</Umsatzsteuervoranmeldung>",
    "</Steuerfall>",
    "</Anmeldungssteuern>",
  ].join("");
}

export function buildUstvaKennzahlenCsv(figures: VatFigures): string {
  const rows = [
    ["Kennzahl", "Bezeichnung", "Betrag"],
    ["81", "Umsätze 19 %, netto (ganze Euro)", wholeEuros(figures.taxable19Cents)],
    ["86", "Umsätze 7 %, netto (ganze Euro)", wholeEuros(figures.taxable7Cents)],
    ["66", "Abziehbare Vorsteuer aus Rechnungen", decimal(figures.inputVat19Cents + figures.inputVat7Cents)],
    ["83", "Zahllast oder Überschuss", decimal(figures.payableCents)],
  ];
  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";")).join("\r\n");
}

export function buildFilingCsv(figures: FilingFigures): string {
  const rows = [
    ["Feld", "Betrag in Cent", "Betrag in Euro"],
    ...figureLines(figures).map((line) => [line.key, String(line.cents), decimal(line.cents)]),
  ];
  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";")).join("\r\n");
}

export function buildFilingExport(input: ExportInput) {
  return {
    schema: "managr.tax-filing/1",
    generatedAt: input.generatedAt,
    disclaimer:
      "Prepared by managr from the local books. This is not a tax assessment and not an ELSTER submission. The responsible person or adviser confirms the figures.",
    company: input.company,
    filing: input.filing,
    figures: input.figures,
    checks: input.checks,
  };
}

export function exportFilename(kind: TaxFilingKind, year: number, periodKey: string, extension: string): string {
  const safePeriod = periodKey.replace(/[^0-9Q-]/g, "");
  return `managr-${kind}-${year}-${safePeriod}.${extension}`;
}