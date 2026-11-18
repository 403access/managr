import { todayIso } from "@/domain/calendar";
import { queryKeys } from "@/client/query-keys";
import { MilestonesScreen } from "@/components/screens/milestones-screen";
import { Hydrate } from "@/server/hydrate";
import { titled } from "@/server/locale";
import { parseViewQuery } from "@/server/view-request";
import { milestonesView } from "@/server/views";

export function generateMetadata() {
  return titled("meta.milestones");
}

export default async function MilestonesPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const params = await searchParams;
  const query = parseViewQuery(new URLSearchParams(params.year ? { year: params.year } : {}), todayIso());
  return (
    <Hydrate queryKey={queryKeys.milestones(query.year)} data={milestonesView(query.year)}>
      <MilestonesScreen year={query.year} />
    </Hydrate>
  );
}