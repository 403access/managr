import type { ReactNode } from "react";
import { dismissSample } from "@/server/actions";
import { loadCompany } from "@/server/queries";
import { AppNav } from "@/components/app-nav";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function AppLayout({ children }: { children: ReactNode }) {
  const company = loadCompany();
  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex max-w-6xl">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-4 py-6 md:flex">
          <p className="font-display text-2xl text-pine">managr</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{company.legalName}</p>
          <AppNav variant="side" />
        </aside>
        <div className="min-w-0 flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-12">
          <p className="mb-4 font-display text-2xl text-pine md:hidden">managr</p>
          {company.isSample ? (
            <form action={dismissSample} className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm">
              <p>Sample company. The figures are invented. The books stay until you delete data/managr.db.</p>
              <button type="submit" className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm">Hide sample label</button>
            </form>
          ) : null}
          {children}
        </div>
      </div>
      <AppNav variant="bottom" />
    </div>
  );
}
