import { queryKeys } from "@/client/query-keys";
import { OrgScreen } from "@/components/screens/org-screen";
import { titled } from "@/server/locale";
import { Hydrate } from "@/server/hydrate";
import { orgView } from "@/server/views";

export function generateMetadata() {
  return titled("meta.org");
}

export default function OrgPage() {
  return (
    <Hydrate queryKey={queryKeys.org} data={orgView()}>
      <OrgScreen />
    </Hydrate>
  );
}