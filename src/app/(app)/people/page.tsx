import { queryKeys } from "@/client/query-keys";
import { PeopleScreen } from "@/components/screens/people-screen";
import { Hydrate } from "@/server/hydrate";
import { peopleView } from "@/server/views";

import { titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.people");
}

export default function PeoplePage() {
  return (
    <Hydrate queryKey={queryKeys.people} data={peopleView()}>
      <PeopleScreen />
    </Hydrate>
  );
}
