import { queryKeys } from "@/client/query-keys";
import { CompanyScreen } from "@/components/screens/company-screen";
import { Hydrate } from "@/server/hydrate";
import { companyView } from "@/server/views";

export const metadata = { title: "Company" };

export default function CompanyPage() {
  return (
    <Hydrate queryKey={queryKeys.company} data={companyView()}>
      <CompanyScreen />
    </Hydrate>
  );
}
