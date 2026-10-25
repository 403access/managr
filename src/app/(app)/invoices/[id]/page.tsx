import { notFound } from "next/navigation";
import { queryKeys } from "@/client/query-keys";
import { InvoiceScreen } from "@/components/screens/invoice-screen";
import { Hydrate } from "@/server/hydrate";
import { invoiceView } from "@/server/views";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Invoice ${id}` };
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric < 1) notFound();
  const data = invoiceView(numeric);
  if (!data) notFound();
  return (
    <Hydrate queryKey={queryKeys.invoice(numeric)} data={data}>
      <InvoiceScreen id={numeric} />
    </Hydrate>
  );
}
