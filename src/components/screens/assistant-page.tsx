"use client";

import { useEffect, useRef, useState } from "react";
import { Assistant, toolLabelFor } from "@/components/assistant";
import { useI18n } from "@/components/locale-provider";
import { Card, PageHeader, inputClass } from "@/components/ui";

type ToolInfo = { name: string; description: string; write: boolean };

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="grid gap-0.5">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-xs font-medium text-muted">{label}</dt>
        <dd className="break-all text-right text-sm">{value}</dd>
      </div>
      {hint ? <p className="text-[11px] leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}

const BRIEFINGS = new Set(["daily_briefing", "vat_overview", "monthly_close_checklist", "draft_dunning_letter"]);

export function AssistantPageScreen({ web, tools, mcpUrl }: { web: boolean; tools: ToolInfo[]; mcpUrl: string }) {
  const { t } = useI18n();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!toolsOpen) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setToolsOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toolsOpen]);

  function closeTools() {
    setToolsOpen(false);
    triggerRef.current?.focus();
  }

  const query = search.trim().toLowerCase();
  const groups = [
    { key: "read", title: t("assistantPage.toolsRead"), items: tools.filter((tool) => !tool.write && tool.name.startsWith("read_")) },
    { key: "write", title: t("assistantPage.toolsWrite"), items: tools.filter((tool) => tool.write) },
    { key: "briefing", title: t("assistantPage.toolsBriefing"), items: tools.filter((tool) => BRIEFINGS.has(tool.name)) },
    { key: "web", title: t("assistantPage.toolsWeb"), items: tools.filter((tool) => tool.name.startsWith("web_")) },
  ]
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (tool) => !query || `${toolLabelFor(tool.name, t)} ${tool.name} ${tool.description}`.toLowerCase().includes(query),
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      <PageHeader title={t("assistantPage.title")} lede={t("assistantPage.lede")} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Assistant variant="page" />
        <aside className="grid gap-3">
          <Card>
            <h2 className="text-base">{t("assistantPage.settings")}</h2>
            <dl className="mt-3 grid gap-3">
              <Row label={t("assistantPage.model")} value={t("assistantPage.modelValue")} hint={t("assistantPage.modelHint")} />
              <Row
                label={t("assistantPage.web")}
                value={web ? t("assistantPage.webOn") : t("assistantPage.webOff")}
                hint={t("assistantPage.webHint")}
              />
              <Row label={t("assistantPage.mcp")} value={mcpUrl} hint={t("assistantPage.mcpHint")} />
              <Row label={t("assistantPage.confirm")} value={t("assistantPage.confirmValue")} />
            </dl>
          </Card>
          <Card>
            <h2 className="text-base">{t("assistantPage.history")}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">{t("assistantPage.historyHint")}</p>
          </Card>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setToolsOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={toolsOpen}
            className="w-full rounded-2xl border border-line bg-card p-4 text-left transition hover:border-ink"
          >
            <span className="block font-display text-base">{t("assistantPage.tools")}</span>
            <span className="mt-2 block text-xs leading-relaxed text-muted">
              {t("assistantPage.toolsHint", { count: tools.length })}
            </span>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-pine">
              {t("assistantPage.toolsOpen")} <span aria-hidden="true">→</span>
            </span>
          </button>
          <Card>
            <h2 className="text-base">{t("assistantPage.privacy")}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">{t("assistantPage.privacyText")}</p>
          </Card>
        </aside>
      </div>

      {toolsOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink/30" onClick={closeTools} aria-hidden="true" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="assistant-tools-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-[30rem] flex-col border-l border-line bg-paper shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">{t("assistantPage.tools")}</p>
                <h2 id="assistant-tools-title" className="mt-0.5 text-xl leading-tight">
                  {t("assistantPage.toolsTitle")}
                </h2>
                <p className="mt-0.5 text-xs text-muted">{t("assistantPage.toolsCount", { count: tools.length })}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={closeTools}
                aria-label={t("assistantPage.toolsClose")}
                className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-card text-ink hover:border-ink"
              >
                <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </header>
            <div className="border-b border-line p-3">
              <input
                type="search"
                className={inputClass}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("assistantPage.toolsSearch")}
                aria-label={t("assistantPage.toolsSearch")}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {groups.length === 0 ? <p className="text-sm text-muted">{t("assistantPage.toolsNoResults")}</p> : null}
              {groups.map((group) => (
                <section key={group.key} className="mb-5 last:mb-0">
                  <h3 className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
                    {group.title} · {group.items.length}
                  </h3>
                  <ul className="mt-2 grid gap-2">
                    {group.items.map((tool) => (
                      <li key={tool.name} className="rounded-xl border border-line bg-white px-3 py-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-medium">{toolLabelFor(tool.name, t)}</p>
                          {tool.write ? (
                            <span className="rounded-full bg-amber/15 px-2 py-0.5 text-[10px] font-medium text-amber">
                              {t("assistantPage.toolsConfirm")}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] text-muted">{tool.name}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted">{tool.description}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <footer className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-muted">
              {t("assistantPage.toolsNote")}
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}