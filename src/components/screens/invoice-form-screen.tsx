"use client";

import type { invoiceEditView, invoiceNewView } from "@/server/views";
import { queryKeys, viewPath } from "@/client/query-keys";
import { InvoiceForm } from "@/components/invoice-form";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { PageHeader } from "@/components/ui";

type InvoiceFormView = ReturnType<typeof invoiceNewView>;
type DraftForm = Extract<ReturnType<typeof invoiceEditView>, { kind: "draft" }>;

export function InvoiceNewScreen() {
  const query = useView<InvoiceFormView>(queryKeys.invoiceNew, viewPath.invoiceNew);
  const { t } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader title={t("invoices.newTitle")} lede={t("invoices.newLede")} />
          <InvoiceForm seller={data.seller} customers={data.customers} today={data.today} termsDays={data.termsDays} defaultVatBps={data.defaultVatBps} />
        </>
      )}
    </ViewGate>
  );
}

export function InvoiceEditScreen({ id }: { id: number }) {
  const query = useView<DraftForm>(queryKeys.invoiceEdit(id), viewPath.invoiceEdit(id));
  const { t } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader title={t("invoices.editTitle")} lede={t("invoices.editLede")} />
          <InvoiceForm seller={data.seller} customers={data.customers} today={data.today} termsDays={data.termsDays} defaultVatBps={data.defaultVatBps} draft={data.draft} />
        </>
      )}
    </ViewGate>
  );
}
