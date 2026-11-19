"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { dismissSample } from "@/server/actions";
import type { shellView } from "@/server/views";
import { queryKeys, viewPath } from "@/client/query-keys";
import { AddSheetHost, AddSheetProvider } from "@/components/add-sheet";
import { AppNav } from "@/components/app-nav";
import { Assistant } from "@/components/assistant";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CompanySwitcher } from "@/components/company-switcher";
import { CommandBar } from "@/components/command-bar";
import { InfoPanel, InfoProvider } from "@/components/info-sheet";
import { useI18n } from "@/components/locale-provider";
import { SettingsProvider } from "@/components/settings-provider";
import { UndoToast } from "@/components/undo-toast";
import { useView } from "@/components/use-view";

type Shell = ReturnType<typeof shellView>;

type LastDeletion = { kind: string; id: number; label: string; detail?: string };

const SIDEBAR_STORAGE_KEY = "managr-sidebar-collapsed";

function readCollapsedPreference(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell({ children, lastDeletion }: { children: ReactNode; lastDeletion?: LastDeletion | null }) {
  const query = useView<Shell>(queryKeys.shell, viewPath.shell);
  const { t } = useI18n();
  const pathname = usePathname();
  const company = query.data;
  const [collapsed, setCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const openCommand = useCallback(() => setCommandOpen(true), []);
  const closeCommand = useCallback(() => setCommandOpen(false), []);

  useEffect(() => {
    if (readCollapsedPreference()) setCollapsed(true);
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // A private window may refuse storage; the choice then lasts for the session.
      }
      return next;
    });
  }

  return (
    <InfoProvider>
      <SettingsProvider settings={company?.settings}>
        <AddSheetProvider>
        <div className="min-h-dvh">
        <div className="flex w-full">
          <aside
            id="app-sidebar"
            className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line py-6 transition-[width,padding] duration-200 md:flex ${collapsed ? "w-16 px-2" : "w-60 px-4"}`}
          >
            <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between gap-2"}`}>
              {collapsed ? null : (
                <div className="min-w-0">
                  <p className="font-display text-2xl text-pine">managr</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{company?.legalName}</p>
                </div>
              )}
              <button
                type="button"
                onClick={toggleSidebar}
                aria-controls="app-sidebar"
                aria-expanded={!collapsed}
                aria-label={t(collapsed ? "nav.expand" : "nav.collapse")}
                title={t(collapsed ? "nav.expand" : "nav.collapse")}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-white hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                  <path
                    d={collapsed ? "M4 5.5h16v13H4zM9 5.5v13M13.5 9.5 16 12l-2.5 2.5" : "M4 5.5h16v13H4zM9 5.5v13M16 9.5 13.5 12 16 14.5"}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <button
              type="button"
              onClick={openCommand}
              aria-label={t("command.open")}
              title={t("command.open")}
              className={`mt-4 flex min-h-11 items-center rounded-xl border border-line bg-card text-sm text-muted transition hover:border-ink hover:text-ink ${collapsed ? "w-11 justify-center" : "w-full gap-2 px-3"}`}
            >
              <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m15.5 15.5 4.5 4.5" strokeLinecap="round" />
              </svg>
              {collapsed ? null : (
                <>
                  <span className="min-w-0 flex-1 truncate text-left">{t("command.open")}</span>
                  <kbd className="rounded border border-line bg-white px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
                </>
              )}
            </button>
            {company && !collapsed ? <CompanySwitcher companies={company.companies} activeId={company.activeCompanyId} /> : null}
            <AppNav variant="side" collapsed={collapsed} />
          </aside>
          <div className="min-w-0 flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-12">
            <div className="mb-4 flex items-start justify-between gap-3 md:hidden">
              <div className="min-w-0">
                <p className="font-display text-2xl text-pine">managr</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{company?.legalName}</p>
              </div>
              <button
                type="button"
                onClick={openCommand}
                aria-label={t("command.open")}
                title={t("command.open")}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-muted hover:border-ink hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="m15.5 15.5 4.5 4.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            {company ? <div className="mb-4 md:hidden"><CompanySwitcher companies={company.companies} activeId={company.activeCompanyId} /></div> : null}
            {company?.isSample ? (
              <ActionForm action={dismissSample} className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber/40 bg-amber/10 px-4 py-3 text-sm">
                <p>{t("shell.sample")}</p>
                <SubmitButton tone="quiet">{t("shell.hideSample")}</SubmitButton>
              </ActionForm>
            ) : null}
            <InfoPanel variant="inline" />
            {children}
          </div>
          <AddSheetHost />
          <InfoPanel variant="column" />
        </div>
        <AppNav variant="bottom" />
        <CommandBar open={commandOpen} onOpen={openCommand} onClose={closeCommand} />
        {pathname === "/assistant" ? null : <Assistant />}
        {lastDeletion ? <UndoToast deletion={lastDeletion} /> : null}
      </div>
        </AddSheetProvider>
      </SettingsProvider>
    </InfoProvider>
  );
}