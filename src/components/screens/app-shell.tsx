"use client";

import type { ReactNode } from "react";
import { dismissSample } from "@/server/actions";
import type { shellView } from "@/server/views";
import { queryKeys, viewPath } from "@/client/query-keys";
import { AppNav } from "@/components/app-nav";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useView } from "@/components/use-view";

type Shell = ReturnType<typeof shellView>;

export function AppShell({ children }: { children: ReactNode }) {
  const query = useView<Shell>(queryKeys.shell, viewPath.shell);
  const company = query.data;
  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex max-w-6xl">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-4 py-6 md:flex">
          <p className="font-display text-2xl text-pine">managr</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{company?.legalName}</p>
          <AppNav variant="side" />
        </aside>
        <div className="min-w-0 flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-12">
          <p className="mb-4 font-display text-2xl text-pine md:hidden">managr</p>
          {company?.isSample ? (
            <ActionForm action={dismissSample} className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm">
              <p>Sample company. The figures are invented. The books stay until you delete data/managr.db.</p>
              <SubmitButton tone="quiet">Hide sample label</SubmitButton>
            </ActionForm>
          ) : null}
          {children}
        </div>
      </div>
      <AppNav variant="bottom" />
    </div>
  );
}
