import { notFound } from "next/navigation";
import { readUiSettings, loadInvoice } from "@/server/queries";
import { resolveInvoiceLineGrouping } from "@/domain/invoice";
import { invoiceLetterFromInvoice } from "@/domain/invoice-letter";
import { InvoiceDocument } from "@/components/invoice-document";
import { PrintButton } from "@/components/print-button";

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric < 1) notFound();
  const loaded = loadInvoice(numeric);
  if (!loaded) notFound();
  const { company, invoice, customer, lines } = loaded;
  const grouping = resolveInvoiceLineGrouping(invoice.lineGrouping, readUiSettings().invoiceLineGrouping);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="no-print mb-6 flex gap-2">
        <PrintButton invoiceId={invoice.id} />
      </div>
      <InvoiceDocument
        data={{
          number: invoice.number,
          status: invoice.status,
          seller: {
            legalName: company.legalName,
            legalForm: company.legalForm,
            street: company.street,
            postalCode: company.postalCode,
            city: company.city,
            email: company.email,
            taxNumber: company.taxNumber,
            vatId: company.vatId,
            registerCourt: company.registerCourt,
            registerNumber: company.registerNumber,
            managingDirector: company.managingDirector,
            iban: company.iban,
            bic: company.bic,
            bankName: company.bankName,
          },
          buyer: {
            name: customer.name,
            street: customer.street,
            postalCode: customer.postalCode,
            city: customer.city,
            vatId: customer.vatId,
          },
          issueDate: invoice.issueDate,
          serviceDate: invoice.serviceDate,
          dueDate: invoice.dueDate,
          notes: invoice.notes,
          exemptionNote: invoice.exemptionNote,
          buyerReference: invoice.buyerReference,
          amountDisplay: invoice.amountDisplay,
          letter: invoiceLetterFromInvoice(invoice),
          grouping,
          lines,
          netCents: loaded.netCents,
          vatCents: loaded.vatCents,
          grossCents: loaded.grossCents,
          byRate: loaded.byRate,
        }}
      />
    </main>
  );
}
