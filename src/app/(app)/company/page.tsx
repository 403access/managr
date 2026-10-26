import { queryKeys } from "@/client/query-keys";
import { CompanyScreen } from "@/components/screens/company-screen";
import { Hydrate } from "@/server/hydrate";
import { companyView } from "@/server/views";

import { titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.company");
}

export default function CompanyPage() {
  return (
    <Hydrate queryKey={queryKeys.company} data={companyView()}>
      <CompanyScreen />
    </Hydrate>
  );
}
