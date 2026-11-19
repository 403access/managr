import { isCorporation, legalNameMatchesForm } from "./company";
import type { InvoiceLineGrouping, InvoiceLineOrder } from "./settings";

/** Printed in German on a Kleinunternehmer invoice. §14c UStG taxes a shown VAT amount. */
export const KLEINUNTERNEHMER_NOTE = "Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.";

export function isKleinunternehmerNote(note: string): boolean {
  return /§\s*19/.test(note) && /keine Umsatzsteuer/.test(note);
}

/**
 * Net prices with the VAT added, or gross prices with the VAT included.
 * Both keep the net amount and the tax amount on the document (§14 Abs. 4 UStG).
 */
export const AMOUNT_DISPLAYS = ["net", "gross"] as const;

export type AmountDisplay = (typeof AMOUNT_DISPLAYS)[number];

export function isAmountDisplay(value: string): value is AmountDisplay {
  return (AMOUNT_DISPLAYS as readonly string[]).includes(value);
}

/** Compares two ISO days in the chosen invoice order. */
export function compareInvoiceDates(left: string, right: string, order: InvoiceLineOrder): number {
  const ascending = left.localeCompare(right);
  return order === "newestFirst" ? -ascending : ascending;
}

/**
 * Invoice positions sort by the day of the time they bill. Positions without a
 * day, such as a line typed by hand, keep their order and follow the dated ones.
 */
export function sortInvoicePositions<T extends { entryDate?: string | null }>(
  positions: readonly T[],
  order: InvoiceLineOrder,
): T[] {
  return [...positions].sort((left, right) => {
    if (!left.entryDate && !right.entryDate) return 0;
    if (!left.entryDate) return 1;
    if (!right.entryDate) return -1;
    return compareInvoiceDates(left.entryDate, right.entryDate, order);
  });
}

/** The invoice's own choice wins; an empty value follows the global setting. */
export function resolveInvoiceLineGrouping(
  invoiceValue: string | null | undefined,
  fallback: InvoiceLineGrouping,
): InvoiceLineGrouping {
  if (invoiceValue === "none" || invoiceValue === "date") return invoiceValue;
  return fallback;
}

export type InvoicePositionGroup<T> = {
  /** The ISO day, or "none" for positions typed by hand. */
  key: string;
  entryDate: string | null;
  positions: T[];
};

/**
 * Groups positions by the day they bill, keeping the order of the sorted input.
 * Same days merge even when hand-typed lines sit between them; positions without
 * a day form their own group with the key "none".
 */
export function groupInvoicePositions<T extends { entryDate?: string | null }>(
  positions: readonly T[],
  grouping: InvoiceLineGrouping,
): InvoicePositionGroup<T>[] {
  if (grouping === "none") {
    return positions.length === 0 ? [] : [{ key: "all", entryDate: null, positions: [...positions] }];
  }
  const groups = new Map<string, InvoicePositionGroup<T>>();
  for (const position of positions) {
    const key = position.entryDate ?? "none";
    const existing = groups.get(key);
    if (existing) {
      existing.positions.push(position);
    } else {
      groups.set(key, { key, entryDate: position.entryDate ?? null, positions: [position] });
    }
  }
  return [...groups.values()];
}

/**
 * The one hourly rate an invoice bills, or null when the positions mix rates or
 * are not all time-derived. A shared rate is printed once instead of on every
 * position.
 */
export function sharedHourlyRateCents(
  lines: readonly { unitNetCents: number; entryDate?: string | null }[],
): number | null {
  if (lines.length === 0) return null;
  if (lines.some((line) => !line.entryDate)) return null;
  const rate = lines[0].unitNetCents;
  if (rate <= 0) return null;
  return lines.every((line) => line.unitNetCents === rate) ? rate : null;
}

export type InvoiceReviewInput = {
  legalName: string;
  legalForm?: string;
  supplierStreet: string;
  supplierPostalCode: string;
  supplierCity: string;
  taxNumber: string;
  vatId: string;
  registerCourt: string;
  registerNumber: string;
  managingDirector: string;
  iban: string;
  customerName: string;
  customerStreet: string;
  customerPostalCode: string;
  customerCity: string;
  issueDate: string;
  serviceDate: string;
  lines: { description: string; quantityMilli: number; netCents: number }[];
  kleinunternehmer: boolean;
  exemptionNote: string;
  vatCents: number;
};

export function formatInvoiceNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}${year}-${String(sequence).padStart(4, "0")}`;
}

export function reviewInvoice(input: InvoiceReviewInput): { blockers: string[]; warnings: string[] } {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const name = input.legalName.trim();
  const form = input.legalForm ?? "ug";
  if (!legalNameMatchesForm(name, form)) {
    if (form === "ug") blockers.push("The legal name must contain Unternehmergesellschaft (haftungsbeschränkt) or UG (haftungsbeschränkt).");
    else if (form === "gmbh") blockers.push("The legal name must contain GmbH or Gesellschaft mit beschränkter Haftung.");
    else if (form === "ag") blockers.push("The legal name must contain AG or Aktiengesellschaft.");
    else blockers.push("The legal name is missing.");
  }
  if (!input.supplierStreet.trim() || !input.supplierPostalCode.trim() || !input.supplierCity.trim()) {
    blockers.push("The company address is incomplete.");
  }
  if (!input.taxNumber.trim() && !input.vatId.trim()) blockers.push("Add a tax number or a VAT id.");
  if (isCorporation(form)) {
    if (!input.registerCourt.trim() || !input.registerNumber.trim()) {
      blockers.push("Business letters need the register court and the HRB number (§35a GmbHG).");
    }
    if (!input.managingDirector.trim()) blockers.push("Name the managing director on the invoice (§35a GmbHG).");
  }
  if (!input.customerName.trim() || !input.customerStreet.trim() || !input.customerPostalCode.trim() || !input.customerCity.trim()) {
    blockers.push("The customer name and address are incomplete.");
  }
  if (!input.issueDate) blockers.push("The invoice needs an issue date.");
  if (!input.serviceDate) blockers.push("The invoice needs the date of supply.");
  if (input.lines.length === 0 || input.lines.some((line) => !line.description.trim() || line.quantityMilli <= 0)) {
    blockers.push("Each line needs a description and a quantity.");
  }
  if (input.kleinunternehmer) {
    if (input.vatCents !== 0) blockers.push("A Kleinunternehmer invoice must not show VAT.");
    if (!isKleinunternehmerNote(input.exemptionNote)) blockers.push("Add the § 19 UStG exemption sentence.");
  }
  if (!input.iban.trim()) warnings.push("No IBAN yet. The invoice can still be issued.");
  return { blockers, warnings };
}
