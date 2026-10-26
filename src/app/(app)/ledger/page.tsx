import { todayIso } from "@/domain/calendar";
import { queryKeys } from "@/client/query-keys";
import { LedgerScreen } from "@/components/screens/ledger-screen";
import { Hydrate } from "@/server/hydrate";
import { parseViewQuery } from "@/server/view-request";
import { ledgerView } from "@/server/views";

import { titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.ledger");
}

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const params = await searchParams;
  const query = parseViewQuery(new URLSearchParams(params.all === "1" ? { all: "1" } : {}), todayIso());
  return (
    <Hydrate queryKey={queryKeys.ledger(query.all)} data={ledgerView(query.all)}>
      <LedgerScreen all={query.all} />
    </Hydrate>
  );
}
