import { queryKeys } from "@/client/query-keys";
import { DocumentsScreen } from "@/components/screens/documents-screen";
import { Hydrate } from "@/server/hydrate";
import { documentsView } from "@/server/views";

import { titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.documents");
}

export default function DocumentsPage() {
  return (
    <Hydrate queryKey={queryKeys.documents} data={documentsView()}>
      <DocumentsScreen />
    </Hydrate>
  );
}
