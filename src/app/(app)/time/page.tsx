import { todayIso } from "@/domain/calendar";
import { queryKeys } from "@/client/query-keys";
import { TimeScreen } from "@/components/screens/time-screen";
import { Hydrate } from "@/server/hydrate";
import { parseViewQuery } from "@/server/view-request";
import { timeView } from "@/server/views";

import { titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.time");
}

export default async function TimePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const params = await searchParams;
  const query = parseViewQuery(new URLSearchParams(params.week ? { week: params.week } : {}), todayIso());
  return (
    <Hydrate queryKey={queryKeys.time(query.week)} data={timeView(query.week)}>
      <TimeScreen week={query.week} />
    </Hydrate>
  );
}
