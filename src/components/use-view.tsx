"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useI18n } from "./locale-provider";

export function useView<T>(queryKey: readonly unknown[], path: string): UseQueryResult<T, Error> {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await fetch(path, { cache: "no-store" });
      if (response.status === 404) throw new Error("not-found");
      if (!response.ok) throw new Error("refresh");
      return response.json() as Promise<T>;
    },
  });
}

export function ViewGate<T>({ query, children }: { query: UseQueryResult<T, Error>; children: (data: T) => ReactNode }) {
  const { t } = useI18n();
  if (query.isError) {
    const message = query.error.message === "not-found" ? t("error.notFound") : t("error.refresh");
    return (
      <p className="text-sm text-clay" role="alert">
        {message}
      </p>
    );
  }
  if (!query.data) return <p className="text-sm text-muted">{t("common.loading")}</p>;
  return children(query.data);
}
