import { notFound, redirect } from "next/navigation";
import { listCustomers, loadCompany, loadInvoice } from "@/server/queries";
import { todayIso } from "@/domain/calendar";
import { quantityInput, euroInput } from "@/components/amounts";
import { InvoiceForm } from "@/components/invoice-form";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Edit draft" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric < 1) notFound();
  const loaded = loadInvoice(numeric);
  if (!loaded) notFound();
  if (loaded.invoice.status !== "draft") redirect(`/invoices/${numeric}`);
  const company = loadCompany();
  return (
    <>
      <PageHeader title="Edit draft" lede="Saving replaces the lines. Issuing assigns the next number." />
      <InvoiceForm
        seller={company}
        customers={listCustomers()}
        today={todayIso()}
        termsDays={company.paymentTermsDays}
        defaultVatBps={company.defaultVatBps}
        draft={{
          id: loaded.invoice.id,
          customerId: loaded.invoice.customerId,
          issueDate: loaded.invoice.issueDate,
          serviceDate: loaded.invoice.serviceDate,
          dueDate: loaded.invoice.dueDate,
          notes: loaded.invoice.notes,
          lines: loaded.lines.map((line) => ({
            description: line.description,
            quantity: quantityInput(line.quantityMilli),
            unitNet: euroInput(line.unitNetCents),
            vatBps: line.vatBps,
          })),
        }}
      />
    </>
  );
}
