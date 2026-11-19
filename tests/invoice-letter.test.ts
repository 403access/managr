import { describe, expect, it } from "vitest";
import {
  DEFAULT_INVOICE_TEMPLATE,
  EMPTY_INVOICE_LETTER,
  fillInvoiceLetter,
  hasInvoiceLetter,
  invoiceLetterFromTemplate,
  invoicePaymentDays,
} from "@/domain/invoice-letter";

describe("invoice letter", () => {
  it("counts the payment days between issue and due date", () => {
    expect(invoicePaymentDays("2026-11-01", "2026-11-15")).toBe(14);
    expect(invoicePaymentDays("2026-11-01", "2026-11-08")).toBe(7);
    expect(invoicePaymentDays("2026-11-15", "2026-11-01")).toBe(0);
    expect(invoicePaymentDays("kaputt", "2026-11-01")).toBe(0);
  });

  it("fills the documented placeholders and leaves unknown braces alone", () => {
    const text = "Betreff {betreff}: {betrag} in {frist} Tagen bis {faellig}. {unbekannt}";
    expect(fillInvoiceLetter(text, { subject: "Software", amount: "550,00 €", days: 14, dueDate: "15.11.2026" }))
      .toBe("Betreff Software: 550,00 € in 14 Tagen bis 15.11.2026. {unbekannt}");
  });

  it("treats a blank letter as no letter", () => {
    expect(hasInvoiceLetter(EMPTY_INVOICE_LETTER)).toBe(false);
    expect(hasInvoiceLetter({ ...EMPTY_INVOICE_LETTER, subject: "Software" })).toBe(true);
    expect(hasInvoiceLetter(DEFAULT_INVOICE_TEMPLATE)).toBe(true);
  });

  it("drops the template name when the letter is loaded", () => {
    const letter = invoiceLetterFromTemplate(DEFAULT_INVOICE_TEMPLATE);
    expect(letter.subject).toBe("Softwareentwicklung");
    expect("name" in letter).toBe(false);
  });
});