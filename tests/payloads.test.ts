import { describe, expect, it } from "vitest";
import { invoicePayloadSchema, journalPayloadSchema } from "@/server/payloads";

const invoice = {
  invoiceId: null,
  customerMode: "new" as const,
  customerId: null,
  newCustomer: { name: "Lichtfeld GmbH", street: "Torstraße 1", postalCode: "10119", city: "Berlin", country: "Deutschland", email: "", vatId: "" },
  issueDate: "2026-10-25",
  serviceDate: "2026-10-25",
  dueDate: "2026-11-08",
  notes: "",
  lines: [{ description: "Workshop", quantity: "1", unitNet: "2400,00", vatBps: 1900 }],
};

describe("action payloads", () => {
  it("accepts an invoice and rejects an unknown customer mode", () => {
    expect(invoicePayloadSchema.safeParse(invoice).success).toBe(true);
    expect(invoicePayloadSchema.safeParse({ ...invoice, customerMode: "later" }).success).toBe(false);
  });

  it("accepts a two-line journal and trims the memo", () => {
    const parsed = journalPayloadSchema.safeParse({
      date: "2026-10-25",
      memo: "  Opening  ",
      lines: [
        { accountCode: "1200", debit: "100,00", credit: "" },
        { accountCode: "0800", debit: "", credit: "100,00" },
      ],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.memo).toBe("Opening");
  });
});
