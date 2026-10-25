import "server-only";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

export function Hydrate({ queryKey, data, children }: { queryKey: readonly unknown[]; data: unknown; children: ReactNode }) {
  const client = new QueryClient();
  client.setQueryData(queryKey, data);
  return <HydrationBoundary state={dehydrate(client)}>{children}</HydrationBoundary>;
}
