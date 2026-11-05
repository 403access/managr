import { isCorporation, legalNameMatchesForm } from "./company";

/** Printed in German on a Kleinunternehmer invoice. §14c UStG taxes a shown VAT amount. */
export const KLEINUNTERNEHMER_NOTE = "Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.";

export function isKleinunternehmerNote(note: string): boolean {
  return /§\s*19/.test(note) && /keine Umsatzsteuer/.test(note);
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
