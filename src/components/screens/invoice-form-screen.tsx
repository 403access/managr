"use client";

import type { invoiceEditView, invoiceNewView } from "@/server/views";
import { queryKeys, viewPath } from "@/client/query-keys";
import { InvoiceForm } from "@/components/invoice-form";
import { useView, ViewGate } from "@/components/use-view";
import { PageHeader } from "@/components/ui";

type InvoiceFormView = ReturnType<typeof invoiceNewView>;
type DraftForm = Extract<ReturnType<typeof invoiceEditView>, { kind: "draft" }>;

export function InvoiceNewScreen() {
  const query = useView<InvoiceFormView>(queryKeys.invoiceNew, viewPath.invoiceNew);
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader title="New invoice" lede="Issue is blocked until the §14 UStG and §35a GmbHG particulars are complete." />
          <InvoiceForm seller={data.seller} customers={data.customers} today={data.today} termsDays={data.termsDays} defaultVatBps={data.defaultVatBps} />
        </>
      )}
    </ViewGate>
  );
}

export function InvoiceEditScreen({ id }: { id: number }) {
  const query = useView<DraftForm>(queryKeys.invoiceEdit(id), viewPath.invoiceEdit(id));
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader title="Edit draft" lede="Saving replaces the lines. Issuing assigns the next number." />
          <InvoiceForm seller={data.seller} customers={data.customers} today={data.today} termsDays={data.termsDays} defaultVatBps={data.defaultVatBps} draft={data.draft} />
        </>
      )}
    </ViewGate>
  );
}
