import { queryKeys } from "@/client/query-keys";
import { SettingsScreen } from "@/components/screens/settings-screen";
import { Hydrate } from "@/server/hydrate";
import { settingsView } from "@/server/views";
import { titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.settings");
}

export default function SettingsPage() {
  return (
    <Hydrate queryKey={queryKeys.settings} data={settingsView()}>
      <SettingsScreen />
    </Hydrate>
  );
}