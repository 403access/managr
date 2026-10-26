import { queryKeys } from "@/client/query-keys";
import { InvoicesScreen } from "@/components/screens/invoices-screen";
import { Hydrate } from "@/server/hydrate";
import { invoicesView } from "@/server/views";

import { titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.invoices");
}

export default function InvoicesPage() {
  return (
    <Hydrate queryKey={queryKeys.invoices} data={invoicesView()}>
      <InvoicesScreen />
    </Hydrate>
  );
}
