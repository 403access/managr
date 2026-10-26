import { queryKeys } from "@/client/query-keys";
import { DeskScreen } from "@/components/screens/desk-screen";
import { Hydrate } from "@/server/hydrate";
import { titled } from "@/server/locale";
import { deskView } from "@/server/views";

export function generateMetadata() {
  return titled("meta.desk");
}

export default function DeskPage() {
  return (
    <Hydrate queryKey={queryKeys.desk} data={deskView()}>
      <DeskScreen />
    </Hydrate>
  );
}
