import { queryKeys } from "@/client/query-keys";
import { InvoiceNewScreen } from "@/components/screens/invoice-form-screen";
import { Hydrate } from "@/server/hydrate";
import { invoiceNewView } from "@/server/views";

import { titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.invoiceNew");
}

export default function NewInvoicePage() {
  return (
    <Hydrate queryKey={queryKeys.invoiceNew} data={invoiceNewView()}>
      <InvoiceNewScreen />
    </Hydrate>
  );
}
