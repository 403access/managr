import { todayIso } from "@/domain/calendar";
import { queryKeys } from "@/client/query-keys";
import { CashflowScreen } from "@/components/screens/cashflow-screen";
import { Hydrate } from "@/server/hydrate";
import { titled } from "@/server/locale";
import { parseViewQuery } from "@/server/view-request";
import { cashflowView } from "@/server/views";

export function generateMetadata() {
  return titled("meta.cashflow");
}

export default async function CashflowPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const params = await searchParams;
  const query = parseViewQuery(new URLSearchParams(params.year ? { year: params.year } : {}), todayIso());
  return (
    <Hydrate queryKey={queryKeys.cashflow(query.year)} data={cashflowView(query.year)}>
      <CashflowScreen year={query.year} />
    </Hydrate>
  );
}