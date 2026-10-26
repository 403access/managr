import { queryKeys } from "@/client/query-keys";
import { LegalScreen } from "@/components/screens/legal-screen";
import { Hydrate } from "@/server/hydrate";
import { legalView } from "@/server/views";

import { titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.legal");
}

export default function LegalPage() {
  return (
    <Hydrate queryKey={queryKeys.legal} data={legalView()}>
      <LegalScreen />
    </Hydrate>
  );
}
