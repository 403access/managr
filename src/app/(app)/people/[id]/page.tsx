import { notFound } from "next/navigation";
import { queryKeys } from "@/client/query-keys";
import { PersonScreen } from "@/components/screens/person-screen";
import { Hydrate } from "@/server/hydrate";
import { personView } from "@/server/views";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Person ${id}` };
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric < 1) notFound();
  const data = personView(numeric);
  if (!data) notFound();
  return (
    <Hydrate queryKey={queryKeys.person(numeric)} data={data}>
      <PersonScreen id={numeric} />
    </Hydrate>
  );
}
