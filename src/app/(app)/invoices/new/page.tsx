import { listCustomers, loadCompany } from "@/server/queries";
import { todayIso } from "@/domain/calendar";
import { InvoiceForm } from "@/components/invoice-form";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "New invoice" };

export default function NewInvoicePage() {
  const company = loadCompany();
  return (
    <>
      <PageHeader title="New invoice" lede="Issue is blocked until the §14 UStG and §35a GmbHG particulars are complete." />
      <InvoiceForm
        seller={company}
        customers={listCustomers()}
        today={todayIso()}
        termsDays={company.paymentTermsDays}
        defaultVatBps={company.defaultVatBps}
      />
    </>
  );
}
