import { todayIso } from "@/domain/calendar";
import { queryKeys } from "@/client/query-keys";
import { TaxScreen } from "@/components/screens/tax-screen";
import { Hydrate } from "@/server/hydrate";
import { parseViewQuery } from "@/server/view-request";
import { taxView } from "@/server/views";

import { titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.tax");
}

export default async function TaxPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const params = await searchParams;
  const query = parseViewQuery(new URLSearchParams(params.year ? { year: params.year } : {}), todayIso());
  return (
    <Hydrate queryKey={queryKeys.tax(query.year)} data={taxView(query.year)}>
      <TaxScreen year={query.year} />
    </Hydrate>
  );
}