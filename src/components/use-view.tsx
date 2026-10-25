"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

export function useView<T>(queryKey: readonly unknown[], path: string): UseQueryResult<T, Error> {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch(path, { cache: "no-store" });
      if (response.status === 404) throw new Error("That record was not found.");
      if (!response.ok) throw new Error("The desk could not refresh.");
      return response.json() as Promise<T>;
    },
  });
}

export function ViewGate<T>({ query, children }: { query: UseQueryResult<T, Error>; children: (data: T) => ReactNode }) {
  if (query.isError) {
    return (
      <p className="text-sm text-clay" role="alert">
        {query.error.message}
      </p>
    );
  }
  if (!query.data) return <p className="text-sm text-muted">Loading…</p>;
  return children(query.data);
}
