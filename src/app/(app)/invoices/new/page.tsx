import { queryKeys } from "@/client/query-keys";
import { InvoiceNewScreen } from "@/components/screens/invoice-form-screen";
import { Hydrate } from "@/server/hydrate";
import { invoiceNewView } from "@/server/views";

export const metadata = { title: "New invoice" };

export default function NewInvoicePage() {
  return (
    <Hydrate queryKey={queryKeys.invoiceNew} data={invoiceNewView()}>
      <InvoiceNewScreen />
    </Hydrate>
  );
}
