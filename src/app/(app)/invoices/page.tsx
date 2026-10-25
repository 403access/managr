import { queryKeys } from "@/client/query-keys";
import { InvoicesScreen } from "@/components/screens/invoices-screen";
import { Hydrate } from "@/server/hydrate";
import { invoicesView } from "@/server/views";

export const metadata = { title: "Invoices" };

export default function InvoicesPage() {
  return (
    <Hydrate queryKey={queryKeys.invoices} data={invoicesView()}>
      <InvoicesScreen />
    </Hydrate>
  );
}
