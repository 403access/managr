import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: vi.fn() }));

import { getDb } from "@/db/client";
import { companies, customers, invoices } from "@/db/schema";
import {
  deleteInvoiceTemplate,
  saveInvoice,
  saveInvoiceTemplate,
} from "@/server/actions";
import { initialState } from "@/server/form";
import { listInvoiceTemplates } from "@/server/queries";
import { invoiceEditView } from "@/server/views";

const repo = process.cwd();
let dir = "";

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-templates-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

function templateForm(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

describe("invoice templates", () => {
  it("creates, updates, and deletes a company template", async () => {
    expect(await saveInvoiceTemplate(initialState, templateForm({
      name: "Software",
      subject: "Softwareentwicklung",
      salutation: "Sehr geehrte Damen und Herren,",
      intro: "für {betreff} berechne ich:",
      payment: "Bitte zahlen Sie {betrag} in {frist} Tagen.",
      closing: "Danke.",
      signature: "Mit freundlichen Grüßen",
    }))).toEqual({ error: "", message: "Template created." });

    const created = listInvoiceTemplates()[0];
    expect(created.name).toBe("Software");
    expect(created.payment).toContain("{betrag}");

    expect(await saveInvoiceTemplate(initialState, templateForm({
      id: String(created.id),
      name: "Software 2",
      subject: "Weiterentwicklung",
      salutation: "Hallo,",
      intro: "Text",
      payment: "Zahlung",
      closing: "Danke",
      signature: "Grüße",
    }))).toEqual({ error: "", message: "Template updated." });
    expect(listInvoiceTemplates()[0].name).toBe("Software 2");

    expect(await deleteInvoiceTemplate(initialState, templateForm({ id: String(created.id) }))).toEqual({
      error: "",
      message: "Template removed.",
    });
    expect(listInvoiceTemplates()).toHaveLength(0);
  });

  it("keeps the letter on the invoice when its template is deleted", async () => {
    const db = getDb();
    const company = db.select().from(companies).all().find((row) => row.isActive)!;
    const customerId = Number(db.insert(customers).values({ companyId: company.id, name: "Briefkunde" }).run().lastInsertRowid);

    await saveInvoiceTemplate(initialState, templateForm({
      name: "Software",
      subject: "Softwareentwicklung",
      salutation: "Sehr geehrte Damen und Herren,",
      intro: "für {betreff} berechne ich Ihnen:",
      payment: "Bitte überweisen Sie {betrag} innerhalb von {frist} Tagen.",
      closing: "Vielen Dank.",
      signature: "Mit freundlichen Grüßen",
    }));
    const template = listInvoiceTemplates()[0];

    const invoiceForm = new FormData();
    invoiceForm.set("intent", "draft");
    invoiceForm.set("payload", JSON.stringify({
      invoiceId: null,
      customerMode: "existing",
      customerId,
      newCustomer: { name: "", street: "", postalCode: "", city: "", country: "Deutschland", email: "", vatId: "" },
      issueDate: "2026-11-01",
      serviceDate: "2026-11-01",
      dueDate: "2026-11-15",
      notes: "",
      buyerReference: "",
      amountDisplay: "net",
      lineGrouping: "date",
      letter: {
        subject: template.subject,
        salutation: template.salutation,
        intro: template.intro,
        payment: template.payment,
        closing: template.closing,
        signature: template.signature,
      },
      lines: [{ description: "Leistung", quantity: "1", unitNet: "550,00", vatBps: 1900 }],
    }));
    await saveInvoice(initialState, invoiceForm);

    const stored = db.select().from(invoices).where(eq(invoices.customerId, customerId)).get();
    expect(stored?.letterSubject).toBe("Softwareentwicklung");
    expect(stored?.letterPayment).toContain("{betrag}");
    expect(stored?.lineGrouping).toBe("date");
    const edit = stored ? invoiceEditView(stored.id) : null;
    expect(edit?.kind).toBe("draft");
    if (edit?.kind === "draft") {
      expect(edit.draft.lineGrouping).toBe("date");
      expect(edit.defaultLineGrouping).toBe("none");
    }

    await deleteInvoiceTemplate(initialState, templateForm({ id: String(template.id) }));
    expect(db.select().from(invoices).where(eq(invoices.customerId, customerId)).get()?.letterSubject).toBe("Softwareentwicklung");
  });
});