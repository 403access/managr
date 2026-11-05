import type { ReactNode } from "react";
import { queryKeys } from "@/client/query-keys";
import { InvoicesScreen } from "@/components/screens/invoices-screen";
import { Hydrate } from "@/server/hydrate";
import { invoicesView } from "@/server/views";

export default function InvoicesLayout({ children }: { children: ReactNode }) {
  return (
    <Hydrate queryKey={queryKeys.invoices} data={invoicesView()}>
      <InvoicesScreen>{children}</InvoicesScreen>
    </Hydrate>
  );
}
