import { queryKeys } from "@/client/query-keys";
import { ProjectsScreen } from "@/components/screens/projects-screen";
import { Hydrate } from "@/server/hydrate";
import { titled } from "@/server/locale";
import { projectsView } from "@/server/views";

export function generateMetadata() {
  return titled("meta.projects");
}

export default function ProjectsPage() {
  return (
    <Hydrate queryKey={queryKeys.projects} data={projectsView()}>
      <ProjectsScreen />
    </Hydrate>
  );
}