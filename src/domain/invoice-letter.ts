/**
 * The letter around an invoice. The positions and totals stay structured; these
 * fields carry the human sentences, and a template only pre-fills them. An
 * invoice keeps its own copy, so editing a template never rewrites an invoice.
 */
export type InvoiceLetter = {
  subject: string;
  salutation: string;
  intro: string;
  payment: string;
  closing: string;
  signature: string;
};

export type InvoiceTemplate = InvoiceLetter & {
  name: string;
};

export const EMPTY_INVOICE_LETTER: InvoiceLetter = {
  subject: "",
  salutation: "",
  intro: "",
  payment: "",
  closing: "",
  signature: "",
};

/** Loaded on a new invoice and available as a starting point for own templates. */
export const DEFAULT_INVOICE_TEMPLATE: InvoiceTemplate = {
  name: "Standardbrief",
  subject: "Softwareentwicklung",
  salutation: "Sehr geehrte Damen und Herren,",
  intro: "für die erbrachte Dienstleistung im Bereich {betreff} berechne ich Ihnen vereinbarungsgemäß:",
  payment: "Bitte überweisen Sie den Gesamtbetrag von {betrag} innerhalb von {frist} Tagen, spätestens bis zum {faellig}, auf das folgende Konto:",
  closing: "Vielen Dank für Ihren Auftrag.",
  signature: "Mit freundlichen Grüßen",
};

export const INVOICE_LETTER_PLACEHOLDERS = ["{betreff}", "{betrag}", "{frist}", "{faellig}"] as const;

export function hasInvoiceLetter(letter: InvoiceLetter | null | undefined): boolean {
  if (!letter) return false;
  return Object.values(letter).some((value) => value.trim().length > 0);
}

export function invoiceLetterFromTemplate(template: InvoiceLetter): InvoiceLetter {
  return {
    subject: template.subject,
    salutation: template.salutation,
    intro: template.intro,
    payment: template.payment,
    closing: template.closing,
    signature: template.signature,
  };
}

export function invoiceLetterFromInvoice(row: {
  letterSubject: string;
  letterSalutation: string;
  letterIntro: string;
  letterPayment: string;
  letterClosing: string;
  letterSignature: string;
}): InvoiceLetter {
  return {
    subject: row.letterSubject,
    salutation: row.letterSalutation,
    intro: row.letterIntro,
    payment: row.letterPayment,
    closing: row.letterClosing,
    signature: row.letterSignature,
  };
}

/** Whole days between issue and due date; at least zero. */
export function invoicePaymentDays(issueDate: string, dueDate: string): number {
  const start = Date.parse(`${issueDate}T00:00:00Z`);
  const end = Date.parse(`${dueDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export type InvoiceLetterVariables = {
  subject: string;
  amount: string;
  days: number;
  dueDate: string;
};

/** Fills the documented placeholders; unknown braces stay as written. */
export function fillInvoiceLetter(text: string, variables: InvoiceLetterVariables): string {
  return text
    .replaceAll("{betreff}", variables.subject)
    .replaceAll("{betrag}", variables.amount)
    .replaceAll("{frist}", String(variables.days))
    .replaceAll("{faellig}", variables.dueDate);
}