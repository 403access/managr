import { todayIso } from "@/domain/calendar";
import { queryKeys } from "@/client/query-keys";
import { AnalyticsScreen } from "@/components/screens/analytics-screen";
import { Hydrate } from "@/server/hydrate";
import { titled } from "@/server/locale";
import { parseViewQuery } from "@/server/view-request";
import { analyticsView } from "@/server/views";

export function generateMetadata() {
  return titled("meta.analytics");
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const params = await searchParams;
  const query = parseViewQuery(new URLSearchParams(params.year ? { year: params.year } : {}), todayIso());
  return (
    <Hydrate queryKey={queryKeys.analytics(query.year)} data={analyticsView(query.year)}>
      <AnalyticsScreen year={query.year} />
    </Hydrate>
  );
}