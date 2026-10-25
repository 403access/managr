import { queryKeys } from "@/client/query-keys";
import { DeskScreen } from "@/components/screens/desk-screen";
import { Hydrate } from "@/server/hydrate";
import { deskView } from "@/server/views";

export const metadata = { title: "Desk" };

export default function DeskPage() {
  return (
    <Hydrate queryKey={queryKeys.desk} data={deskView()}>
      <DeskScreen />
    </Hydrate>
  );
}
