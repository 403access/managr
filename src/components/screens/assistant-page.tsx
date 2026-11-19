"use client";

import { useRef, useState } from "react";
import { Assistant, toolLabelFor } from "@/components/assistant";
import { useI18n } from "@/components/locale-provider";
import { SidePanel } from "@/components/side-panel";
import { useDetailSidebarMode } from "@/components/settings-provider";
import { Card, PageHeader, inputClass } from "@/components/ui";
import { useWideLayout } from "@/components/use-wide-layout";
import type { MessageKey } from "@/i18n";

type ToolInfo = { name: string; description: string; write: boolean };
type ToolAccess = "read" | "write" | "briefing" | "web";
type ToolCategory =
  | "desk"
  | "invoices"
  | "customers"
  | "time"
  | "projects"
  | "dates"
  | "company"
  | "ledger"
  | "cashflow"
  | "bank"
  | "people"
  | "documents"
  | "legal"
  | "analytics"
  | "milestones"
  | "sources"
  | "rates"
  | "briefing"
  | "web"
  | "other";
type Grouping = "category" | "access" | "none";

const BRIEFINGS = new Set(["daily_briefing", "vat_overview", "monthly_close_checklist", "draft_dunning_letter"]);
const ACCESS_ORDER: ToolAccess[] = ["read", "write", "briefing", "web"];
const CATEGORY_ORDER: ToolCategory[] = [
  "desk",
  "invoices",
  "customers",
  "time",
  "projects",
  "dates",
  "company",
  "ledger",
  "cashflow",
  "bank",
  "people",
  "documents",
  "legal",
  "analytics",
  "milestones",
  "sources",
  "rates",
  "briefing",
  "web",
  "other",
];

const ACCESS_LABELS: Record<ToolAccess, MessageKey> = {
  read: "assistantPage.toolsRead",
  write: "assistantPage.toolsWrite",
  briefing: "assistantPage.toolsBriefing",
  web: "assistantPage.toolsWeb",
};

const CATEGORY_LABELS: Record<ToolCategory, MessageKey> = {
  desk: "nav.desk",
  invoices: "nav.invoices",
  customers: "nav.customers",
  time: "nav.time",
  projects: "nav.projects",
  dates: "nav.dates",
  company: "nav.company",
  ledger: "nav.ledger",
  cashflow: "nav.cashflow",
  bank: "nav.bank",
  people: "nav.people",
  documents: "nav.documents",
  legal: "nav.legal",
  analytics: "nav.analytics",
  milestones: "nav.milestones",
  sources: "nav.sources",
  rates: "assistantPage.toolsRates",
  briefing: "assistantPage.toolsBriefing",
  web: "assistantPage.toolsWeb",
  other: "assistantPage.toolsOther",
};

function accessOf(tool: ToolInfo): ToolAccess {
  if (tool.name.startsWith("web_")) return "web";
  if (BRIEFINGS.has(tool.name)) return "briefing";
  return tool.write ? "write" : "read";
}

function categoryOf(tool: ToolInfo): ToolCategory {
  const name = tool.name;
  if (BRIEFINGS.has(name)) return "briefing";
  if (name.startsWith("web_")) return "web";
  if (name === "set_hourly_rate") return "rates";
  if (name.startsWith("read_")) {
    if (name === "read_desk" || name === "read_companies") return "desk";
    if (name === "read_company" || name === "read_shareholder_loans") return "company";
    if (name === "read_customers") return "customers";
    if (name === "read_invoices" || name === "read_invoice") return "invoices";
    if (name === "read_ledger") return "ledger";
    if (name === "read_cashflow") return "cashflow";
    if (name === "read_bank") return "bank";
    if (name === "read_people" || name === "read_person" || name === "read_org") return "people";
    if (name === "read_time" || name === "read_tasks") return "time";
    if (name === "read_obligations") return "dates";
    if (name === "read_documents") return "documents";
    if (name === "read_legal") return "legal";
    if (name === "read_projects") return "projects";
    if (name === "read_analytics") return "analytics";
    if (name === "read_milestones") return "milestones";
    if (name === "read_sources" || name === "read_guides") return "sources";
    return "other";
  }
  if (name === "update_buyer_reference" || name.includes("invoice")) return "invoices";
  if (name.includes("customer")) return "customers";
  if (name.includes("time") || name.includes("task")) return "time";
  if (name.includes("project")) return "projects";
  if (name.includes("milestone")) return "milestones";
  if (name.includes("deadline") || name === "set_obligation") return "dates";
  if (
    name.includes("person") ||
    name.includes("payroll") ||
    name.includes("salary") ||
    name.includes("absence") ||
    name.includes("director") ||
    name.includes("founder") ||
    name === "pay_shareholder"
  ) {
    return "people";
  }
  if (
    name.includes("shareholder") ||
    name.includes("policy") ||
    name.includes("reserve") ||
    name.includes("company") ||
    name.includes("bank") ||
    name === "update_tax_profile" ||
    name === "pay_profit_distribution"
  ) {
    return "company";
  }
  if (name === "set_compliance_done" || name === "save_resolution") return "legal";
  if (name === "post_expense" || name === "post_vat_prepayment" || name === "post_journal_entry") return "ledger";
  return "other";
}

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

type ToolRow = ToolInfo & { label: string; access: ToolAccess; category: ToolCategory };

export function AssistantPageScreen({ web, tools, mcpUrl }: { web: boolean; tools: ToolInfo[]; mcpUrl: string }) {
  const { t, locale } = useI18n();
  const mode = useDetailSidebarMode("assistant");
  const wide = useWideLayout();
  const inline = mode === "inline" && wide;
  const [toolsOpen, setToolsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | ToolAccess>("all");
  const [grouping, setGrouping] = useState<Grouping>("category");
  const triggerRef = useRef<HTMLButtonElement>(null);

  function closeTools() {
    setToolsOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  const rows: ToolRow[] = tools.map((tool) => ({
    ...tool,
    label: toolLabelFor(tool.name, t),
    access: accessOf(tool),
    category: categoryOf(tool),
  }));
  const counts: Record<"all" | ToolAccess, number> = { all: rows.length, read: 0, write: 0, briefing: 0, web: 0 };
  for (const row of rows) counts[row.access] += 1;

  const query = search.trim().toLowerCase();
  const visible = rows.filter(
    (row) =>
      (filter === "all" || row.access === filter) &&
      (!query || `${row.label} ${row.name} ${row.description}`.toLowerCase().includes(query)),
  );
  const sorted = [...visible].sort((left, right) => left.label.localeCompare(right.label, locale === "de" ? "de" : "en"));

  const groups: { key: string; title: string | null; items: ToolRow[] }[] = [];
  if (grouping === "none") {
    if (sorted.length > 0) groups.push({ key: "all", title: null, items: sorted });
  } else if (grouping === "access") {
    for (const access of ACCESS_ORDER) {
      const items = sorted.filter((row) => row.access === access);
      if (items.length > 0) groups.push({ key: access, title: t(ACCESS_LABELS[access]), items });
    }
  } else {
    for (const category of CATEGORY_ORDER) {
      const items = sorted.filter((row) => row.category === category);
      if (items.length > 0) groups.push({ key: category, title: t(CATEGORY_LABELS[category]), items });
    }
  }

  const filters: { key: "all" | ToolAccess; label: string; count: number }[] = [
    { key: "all", label: t("assistantPage.toolsAll"), count: counts.all },
    { key: "read", label: t("assistantPage.toolsRead"), count: counts.read },
    { key: "write", label: t("assistantPage.toolsWrite"), count: counts.write },
    { key: "briefing", label: t("assistantPage.toolsBriefing"), count: counts.briefing },
    { key: "web", label: t("assistantPage.toolsWeb"), count: counts.web },
  ];
  const shownFilters = filters.filter((item) => item.key === "all" || item.count > 0);

  const toolPanel = (
    <SidePanel
      variant={inline ? "inline" : "overlay"}
      title={t("assistantPage.toolsTitle")}
      subtitle={t("assistantPage.toolsCount", { count: tools.length })}
      onClose={closeTools}
    >
      <input
        type="search"
        className={inputClass}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("assistantPage.toolsSearch")}
        aria-label={t("assistantPage.toolsSearch")}
      />
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium text-muted">{t("assistantPage.toolsFilter")}</span>
        {shownFilters.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={filter === item.key}
            onClick={() => setFilter(item.key)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
              filter === item.key
                ? "border-pine bg-pine text-paper"
                : "border-line bg-white text-muted hover:border-ink hover:text-ink"
            }`}
          >
            {item.label} · {item.count}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[11px] text-muted">
          <span>{t("assistantPage.toolsGroupBy")}</span>
          <select
            value={grouping}
            onChange={(event) => setGrouping(event.target.value as Grouping)}
            className="min-h-9 rounded-xl border border-line bg-white px-2 text-xs text-ink"
          >
            <option value="category">{t("assistantPage.toolsGroupCategory")}</option>
            <option value="access">{t("assistantPage.toolsGroupAccess")}</option>
            <option value="none">{t("assistantPage.toolsGroupNone")}</option>
          </select>
        </label>
        <p className="text-[11px] text-muted" aria-live="polite">
          {t("assistantPage.toolsShown", { shown: visible.length, total: tools.length })}
        </p>
      </div>
      <div className="mt-4 grid gap-4">
        {groups.length === 0 ? <p className="text-sm text-muted">{t("assistantPage.toolsNoResults")}</p> : null}
        {groups.map((group) => (
          <section key={group.key} className="grid gap-2">
            {group.title ? (
              <h3 className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">
                {group.title} · {group.items.length}
              </h3>
            ) : null}
            <ul className="grid gap-2">
              {group.items.map((tool) => (
                <li key={tool.name} className="rounded-xl border border-line bg-white px-3 py-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium">{tool.label}</p>
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
      <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">{t("assistantPage.toolsNote")}</p>
    </SidePanel>
  );

  return (
    <>
      <PageHeader title={t("assistantPage.title")} lede={t("assistantPage.lede")} />
      <div
        className={
          inline && toolsOpen
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
            : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start"
        }
      >
        <Assistant variant="page" />
        {inline && toolsOpen ? (
          <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">{toolPanel}</aside>
        ) : (
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
              aria-haspopup={inline ? undefined : "dialog"}
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
        )}
      </div>
      {!inline && toolsOpen ? toolPanel : null}
    </>
  );
}