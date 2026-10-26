import { notFound } from "next/navigation";
import { queryKeys } from "@/client/query-keys";
import { InvoiceScreen } from "@/components/screens/invoice-screen";
import { t } from "@/i18n";
import { Hydrate } from "@/server/hydrate";
import { getLocale } from "@/server/locale";
import { invoiceView } from "@/server/views";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numeric = Number(id);
  const data = Number.isInteger(numeric) ? invoiceView(numeric) : null;
  const locale = await getLocale();
  return { title: data?.invoice.number ?? t(locale, "meta.invoice") };
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
