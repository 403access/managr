import { queryKeys } from "@/client/query-keys";
import { CustomersScreen } from "@/components/screens/customers-screen";
import { Hydrate } from "@/server/hydrate";
import { customersView } from "@/server/views";
import { titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.customers");
}

export default function CustomersPage() {
  return (
    <Hydrate queryKey={queryKeys.customers} data={customersView()}>
      <CustomersScreen />
    </Hydrate>
  );
}
