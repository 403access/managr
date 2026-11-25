import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { FacturX } from "factur-x-kit";
import { PDFPage } from "pdf-lib";
import { getDb } from "@/db/client";
import { companies, customers, invoiceLines, invoices } from "@/db/schema";
import { fillInvoiceLetter, type InvoiceLetter } from "@/domain/invoice-letter";
import { formatEuro } from "@/domain/money";
import { STANDARD_VAT_BPS } from "@/domain/rates-2026";
import { loadInvoice } from "@/server/queries";
import { zugferdFile } from "@/server/zugferd";

const repo = process.cwd();
let dir = "";

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-zugferd-letter-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("ZUGFeRD letter from the invoice row", () => {
  it("puts the stored Anschreiben into the PDF next to the CII XML", async () => {
    const db = getDb();
    const company = db.select().from(companies).where(eq(companies.isActive, true)).get();
    if (!company) throw new Error("No active company in the seed.");
    const customer = db.select().from(customers).where(eq(customers.companyId, company.id)).get();
    if (!customer) throw new Error("No customer in the seed.");

    const letter: InvoiceLetter = {
      subject: "Softwareentwicklung",
      salutation: "Sehr geehrte Damen und Herren,",
      intro: "für {betreff} berechne ich Ihnen {betrag} bis {faellig} ({frist} Tage).",
      payment: "Bitte überweisen Sie {betrag}.",
      closing: "Vielen Dank für Ihren Auftrag.",
      signature: "Mit freundlichen Grüßen",
    };
    const invoiceId = Number(
      db
        .insert(invoices)
        .values({
          companyId: company.id,
          customerId: customer.id,
          number: "RE-2026-9001",
          status: "issued",
          issueDate: "2026-11-02",
          serviceDate: "2026-11-02",
          dueDate: "2026-11-16",
          buyerReference: "LF-BER-2026",
          letterSubject: letter.subject,
          letterSalutation: letter.salutation,
          letterIntro: letter.intro,
          letterPayment: letter.payment,
          letterClosing: letter.closing,
          letterSignature: letter.signature,
        })
        .run().lastInsertRowid,
    );
    db.insert(invoiceLines)
      .values({
        invoiceId,
        position: 1,
        description: "Workshop",
        quantityMilli: 1000,
        unitNetCents: 10_000,
        vatBps: STANDARD_VAT_BPS,
      })
      .run();

    const loaded = loadInvoice(invoiceId);
    if (!loaded) throw new Error("The invoice could not be loaded.");

    const drawn: string[] = [];
    const prototype = PDFPage.prototype as unknown as {
      drawText: (this: PDFPage, text: string, options?: unknown) => PDFPage;
    };
    const original = prototype.drawText;
    prototype.drawText = function (text, options) {
      drawn.push(text);
      return original.call(this, text, options);
    };

    let pdf: Uint8Array;
    try {
      const result = await zugferdFile(loaded.company, loaded, "de-DE");
      if (!("pdf" in result)) throw new Error(result.blockers.join(" "));
      pdf = result.pdf;
    } finally {
      prototype.drawText = original;
    }

    const variables = {
      subject: letter.subject,
      amount: formatEuro(loaded.grossCents),
      days: 14,
      dueDate: "16.11.2026",
    };
    expect(drawn).toContain(`Betreff: ${letter.subject}`);
    expect(drawn).toContain(letter.salutation);
    expect(drawn).toContain(fillInvoiceLetter(letter.intro, variables));
    expect(drawn).toContain(fillInvoiceLetter(letter.payment, variables));
    expect(drawn).toContain(fillInvoiceLetter(letter.closing, variables));
    expect(drawn).toContain(fillInvoiceLetter(letter.signature, variables));
    expect(drawn).toContain(company.managingDirector);

    const xml = await (await FacturX.fromPDF(pdf)).getXML();
    expect(xml).toContain("<ram:ID>RE-2026-9001</ram:ID>");
  });
});
