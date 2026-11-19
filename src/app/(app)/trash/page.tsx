import { TrashScreen } from "@/components/screens/trash-screen";
import { trashView } from "@/server/trash";

export const dynamic = "force-dynamic";

export default function TrashPage() {
  return <TrashScreen entries={trashView()} />;
}