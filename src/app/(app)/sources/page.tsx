import { SourcesScreen } from "@/components/screens/sources-screen";
import { titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.sources");
}

export default function SourcesPage() {
  return <SourcesScreen />;
}
