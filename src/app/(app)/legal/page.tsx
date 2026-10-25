import { queryKeys } from "@/client/query-keys";
import { LegalScreen } from "@/components/screens/legal-screen";
import { Hydrate } from "@/server/hydrate";
import { legalView } from "@/server/views";

export const metadata = { title: "Legal" };

export default function LegalPage() {
  return (
    <Hydrate queryKey={queryKeys.legal} data={legalView()}>
      <LegalScreen />
    </Hydrate>
  );
}
