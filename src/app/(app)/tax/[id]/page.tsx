import { notFound } from "next/navigation";
import { queryKeys } from "@/client/query-keys";
import { TaxFilingScreen } from "@/components/screens/tax-filing-screen";
import { Hydrate } from "@/server/hydrate";
import { taxFilingView } from "@/server/views";

import { titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.taxFiling");
}

export default async function TaxFilingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric < 1) notFound();
  const data = taxFilingView(numeric);
  if (!data) notFound();
  return (
    <Hydrate queryKey={queryKeys.taxFiling(numeric)} data={data}>
      <TaxFilingScreen id={numeric} />
    </Hydrate>
  );
}