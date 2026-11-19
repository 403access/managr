import type { ReactNode } from "react";
import { queryKeys } from "@/client/query-keys";
import { AppShell } from "@/components/screens/app-shell";
import { Hydrate } from "@/server/hydrate";
import { readLastDeletion } from "@/server/deletions";
import { shellView } from "@/server/views";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const data = shellView();
  const lastDeletion = await readLastDeletion();
  return (
    <Hydrate queryKey={queryKeys.shell} data={data}>
      <AppShell lastDeletion={lastDeletion}>{children}</AppShell>
    </Hydrate>
  );
}
