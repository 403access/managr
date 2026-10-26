import { todayIso } from "@/domain/calendar";
import { queryKeys } from "@/client/query-keys";
import { ObligationsScreen } from "@/components/screens/obligations-screen";
import { Hydrate } from "@/server/hydrate";
import { parseViewQuery } from "@/server/view-request";
import { obligationsView } from "@/server/views";

import { titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.dates");
}

export default async function ObligationsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const params = await searchParams;
  const query = parseViewQuery(new URLSearchParams(params.year ? { year: params.year } : {}), todayIso());
  return (
    <Hydrate queryKey={queryKeys.obligations(query.year)} data={obligationsView(query.year)}>
      <ObligationsScreen year={query.year} />
    </Hydrate>
  );
}
