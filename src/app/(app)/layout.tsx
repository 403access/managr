import type { ReactNode } from "react";
import { queryKeys } from "@/client/query-keys";
import { AppShell } from "@/components/screens/app-shell";
import { Hydrate } from "@/server/hydrate";
import { shellView } from "@/server/views";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function AppLayout({ children }: { children: ReactNode }) {
  const data = shellView();
  return (
    <Hydrate queryKey={queryKeys.shell} data={data}>
      <AppShell>{children}</AppShell>
    </Hydrate>
  );
}
