import { todayIso } from "@/domain/calendar";
import { resolveTimeRange } from "@/domain/time";
import { queryKeys } from "@/client/query-keys";
import { TimeScreen } from "@/components/screens/time-screen";
import { Hydrate } from "@/server/hydrate";
import { parseViewQuery } from "@/server/view-request";
import { timeRangeView } from "@/server/views";

import { titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.time");
}

export default async function TimePage({ searchParams }: { searchParams: Promise<{ week?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const search = new URLSearchParams();
  if (params.week) search.set("week", params.week);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  const query = parseViewQuery(search, todayIso());
  const range = resolveTimeRange(query.from, query.to, query.week);
  return (
    <Hydrate queryKey={queryKeys.time(range.from, range.to)} data={timeRangeView(range.from, range.to)}>
      <TimeScreen from={range.from} to={range.to} />
    </Hydrate>
  );
}