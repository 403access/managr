import { todayIso } from "@/domain/calendar";
import { queryKeys } from "@/client/query-keys";
import { BankScreen } from "@/components/screens/bank-screen";
import { Hydrate } from "@/server/hydrate";
import { titled } from "@/server/locale";
import { parseViewQuery } from "@/server/view-request";
import { bankView } from "@/server/views";

export function generateMetadata() {
  return titled("meta.bank");
}

export default async function BankPage({ searchParams }: { searchParams: Promise<{ year?: string; all?: string }> }) {
  const params = await searchParams;
  const search = new URLSearchParams();
  if (params.year) search.set("year", params.year);
  if (params.all === "1") search.set("all", "1");
  const query = parseViewQuery(search, todayIso());
  return (
    <Hydrate queryKey={queryKeys.bank(query.year, query.all)} data={bankView(query.year, query.all)}>
      <BankScreen year={query.year} all={query.all} />
    </Hydrate>
  );
}