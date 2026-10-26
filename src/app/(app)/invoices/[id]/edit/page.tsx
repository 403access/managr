import { notFound, redirect } from "next/navigation";
import { queryKeys } from "@/client/query-keys";
import { InvoiceEditScreen } from "@/components/screens/invoice-form-screen";
import { Hydrate } from "@/server/hydrate";
import { invoiceEditView } from "@/server/views";

import { titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.invoiceEdit");
}

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric < 1) notFound();
  const data = invoiceEditView(numeric);
  if (data.kind === "missing") notFound();
  if (data.kind === "issued") redirect(`/invoices/${numeric}`);
  return (
    <Hydrate queryKey={queryKeys.invoiceEdit(numeric)} data={data}>
      <InvoiceEditScreen id={numeric} />
    </Hydrate>
  );
}
