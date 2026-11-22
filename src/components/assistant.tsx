"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/domain/calendar";
import { changeAction, type ChangeAction } from "@/domain/assistant-actions";
import { type PlanChange, type PlanStepStatus, type PlanStepView } from "@/domain/assistant-plan";
import { needsApproval } from "@/domain/assistant-writes";
import { formatEuro } from "@/domain/money";
import type { ChatMessageDetails } from "@/client/chat-history";
import {
  MCP_SERVER,
  type Message,
  type Proposal,
  type ProposalChange,
  type Step,
  type StreamingState,
} from "@/client/assistant-types";
import { queryKeys, viewPath } from "@/client/query-keys";
import type { MessageKey } from "@/i18n";
import { useAssistant } from "./assistant-provider";
import { Combobox } from "./combobox";
import { useI18n } from "./locale-provider";
import { Markdown } from "./markdown";
import { buttonClass, inputClass, Pill } from "./ui";
import { useFollowBottom } from "./use-follow-bottom";
import { setJsonView, useJsonView } from "./use-json-view";

const ACTION_STYLE: Record<ChangeAction, string> = {
  add: "bg-moss/15 text-moss",
  update: "bg-amber/15 text-amber",
  delete: "bg-clay/15 text-clay",
};

const PANEL_OPEN_KEY = "managr-assistant-open";
const PANEL_EXPANDED_KEY = "managr-assistant-expanded";

function readPanelOpen(): boolean {
  try {
    return window.sessionStorage.getItem(PANEL_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function storePanelOpen(open: boolean): void {
  try {
    window.sessionStorage.setItem(PANEL_OPEN_KEY, open ? "1" : "0");
  } catch {
    // A private window may refuse storage; the panel then lasts for the mount.
  }
}

function readPanelExpanded(): boolean {
  try {
    return window.sessionStorage.getItem(PANEL_EXPANDED_KEY) === "1";
  } catch {
    return false;
  }
}

function storePanelExpanded(expanded: boolean): void {
  try {
    window.sessionStorage.setItem(PANEL_EXPANDED_KEY, expanded ? "1" : "0");
  } catch {
    // A private window may refuse storage; the size then lasts for the mount.
  }
}

export function ActionBadge({ action }: { action: ChangeAction }) {
  const { t } = useI18n();
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ACTION_STYLE[action]}`}>
      {t(`assistant.approval.${action}`)}
    </span>
  );
}

const PLAN_CHANGE_STYLE: Record<PlanChange, string> = {
  added: "bg-moss/15 text-moss",
  changed: "bg-amber/15 text-amber",
  removed: "bg-clay/15 text-clay",
};

function PlanChangeBadge({ change }: { change: PlanChange }) {
  const { t } = useI18n();
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PLAN_CHANGE_STYLE[change]}`}>
      {t(`assistant.plan.${change}`)}
    </span>
  );
}

function PlanStatusIcon({ status }: { status: PlanStepStatus }) {
  const { t } = useI18n();
  const label = t(`assistant.plan.status.${status}`);
  if (status === "doing") {
    return <span role="img" aria-label={label} className="mt-1 size-3.5 animate-spin rounded-full border-2 border-line border-t-pine" />;
  }
  if (status === "done") {
    return (
      <span role="img" aria-label={label} className="mt-0.5 text-[13px] text-moss">
        ✓
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span role="img" aria-label={label} className="mt-0.5 text-[13px] text-muted">
        –
      </span>
    );
  }
  return (
    <span role="img" aria-label={label} className="mt-1 inline-flex size-3.5 items-center justify-center">
      <span className="size-2.5 rounded-full border border-line bg-white" />
    </span>
  );
}

/** The vertical roadmap above the steps of one assistant turn. */
export function PlanBar({ plan, className = "" }: { plan: PlanStepView[]; className?: string }) {
  const { t } = useI18n();
  const done = plan.filter((step) => step.status === "done").length;
  return (
    <div className={`rounded-xl border border-line bg-card p-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">{t("assistant.plan.title")}</p>
        <p className="text-[10px] text-muted">{t("assistant.plan.progress", { done, total: plan.length })}</p>
      </div>
      <ol className="mt-2 grid">
        {plan.map((step, index) => {
          const reason = step.note ?? (step.change ? t(`assistant.plan.${step.change}Reason`) : "");
          return (
            <li key={step.id} className="flex gap-2">
              <span className="relative flex w-4 shrink-0 justify-center">
                <PlanStatusIcon status={step.status} />
                {index < plan.length - 1 ? (
                  <span className="absolute top-4 bottom-0 w-px bg-line" aria-hidden="true" />
                ) : null}
              </span>
              <div className={`min-w-0 flex-1 ${index < plan.length - 1 ? "pb-3" : ""}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className={`text-xs leading-relaxed ${step.status === "done" || step.status === "skipped" ? "text-muted" : ""} ${step.status === "done" ? "line-through" : ""}`}>
                    {step.title}
                  </p>
                  {step.change ? <PlanChangeBadge change={step.change} /> : null}
                </div>
                {reason ? <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{reason}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const TOOL_LABEL_KEYS: Record<string, MessageKey> = {
  read_companies: "assistant.tool.read_companies",
  read_desk: "assistant.tool.read_desk",
  read_company: "assistant.tool.read_company",
  read_customers: "assistant.tool.read_customers",
  read_contacts: "assistant.tool.read_contacts",
  read_invoices: "assistant.tool.read_invoices",
  read_invoice: "assistant.tool.read_invoice",
  check_xrechnung: "assistant.tool.check_xrechnung",
  read_ledger: "assistant.tool.read_ledger",
  read_people: "assistant.tool.read_people",
  read_person: "assistant.tool.read_person",
  read_time: "assistant.tool.read_time",
  read_tasks: "assistant.tool.read_tasks",
  read_obligations: "assistant.tool.read_obligations",
  read_documents: "assistant.tool.read_documents",
  read_legal: "assistant.tool.read_legal",
  read_projects: "assistant.tool.read_projects",
  read_analytics: "assistant.tool.read_analytics",
  save_project: "assistant.tool.save_project",
  delete_project: "assistant.tool.delete_project",
  switch_company: "assistant.tool.switch_company",
  create_company: "assistant.tool.create_company",
  update_company_identity: "assistant.tool.update_company_identity",
  update_tax_profile: "assistant.tool.update_tax_profile",
  update_bank: "assistant.tool.update_bank",
  add_shareholder: "assistant.tool.add_shareholder",
  delete_shareholder: "assistant.tool.delete_shareholder",
  record_reserve_allocation: "assistant.tool.record_reserve_allocation",
  offset_reserve: "assistant.tool.offset_reserve",
  add_policy: "assistant.tool.add_policy",
  delete_policy: "assistant.tool.delete_policy",
  pay_profit_distribution: "assistant.tool.pay_profit_distribution",
  save_customer: "assistant.tool.save_customer",
  save_contact: "assistant.tool.save_contact",
  delete_contact: "assistant.tool.delete_contact",
  create_invoice: "assistant.tool.create_invoice",
  issue_invoice: "assistant.tool.issue_invoice",
  update_buyer_reference: "assistant.tool.update_buyer_reference",
  record_invoice_payment: "assistant.tool.record_invoice_payment",
  void_invoice: "assistant.tool.void_invoice",
  delete_invoice_draft: "assistant.tool.delete_invoice_draft",
  post_expense: "assistant.tool.post_expense",
  post_vat_prepayment: "assistant.tool.post_vat_prepayment",
  post_journal_entry: "assistant.tool.post_journal_entry",
  create_person: "assistant.tool.create_person",
  update_person: "assistant.tool.update_person",
  add_salary_change: "assistant.tool.add_salary_change",
  add_absence: "assistant.tool.add_absence",
  delete_absence: "assistant.tool.delete_absence",
  post_payroll: "assistant.tool.post_payroll",
  pay_shareholder: "assistant.tool.pay_shareholder",
  add_time: "assistant.tool.add_time",
  update_plan: "assistant.tool.update_plan",
  update_time: "assistant.tool.update_time",
  delete_time: "assistant.tool.delete_time",
  add_task: "assistant.tool.add_task",
  set_task_status: "assistant.tool.set_task_status",
  delete_task: "assistant.tool.delete_task",
  set_obligation: "assistant.tool.set_obligation",
  add_deadline: "assistant.tool.add_deadline",
  complete_deadline: "assistant.tool.complete_deadline",
  delete_deadline: "assistant.tool.delete_deadline",
  set_compliance_done: "assistant.tool.set_compliance_done",
  save_resolution: "assistant.tool.save_resolution",
  daily_briefing: "assistant.tool.daily_briefing",
  vat_overview: "assistant.tool.vat_overview",
  monthly_close_checklist: "assistant.tool.monthly_close_checklist",
  draft_dunning_letter: "assistant.tool.draft_dunning_letter",
  web_search: "assistant.tool.web_search",
  web_fetch: "assistant.tool.web_fetch",
};



function recordHref(step: Step): string | null {
  const data = (step.data ?? {}) as Record<string, unknown>;
  const id = (key: string) => (typeof data[key] === "number" ? (data[key] as number) : null);
  switch (step.name) {
    case "create_person":
    case "update_person":
      return id("id") ? `/people/${id("id")}` : null;
    case "add_salary_change":
    case "add_absence":
    case "post_payroll":
    case "pay_shareholder":
      return id("personId") ? `/people/${id("personId")}` : null;
    case "save_customer":
      return "/customers";
    case "save_contact":
    case "delete_contact":
      return "/customers";
    case "post_expense":
    case "post_vat_prepayment":
    case "post_journal_entry":
      return "/ledger";
    case "add_time":
    case "update_time":
    case "add_task":
    case "set_task_status":
      return "/time";
    case "save_project":
    case "delete_project":
      return "/projects";
    case "add_deadline":
    case "complete_deadline":
    case "set_obligation":
      return "/obligations";
    case "set_compliance_done":
    case "save_resolution":
      return "/legal";
    case "add_shareholder":
    case "delete_shareholder":
      return "/company#shareholders";
    case "record_reserve_allocation":
    case "offset_reserve":
      return "/company#reserve";
    case "add_policy":
    case "delete_policy":
      return "/company#cover";
    case "update_company_identity":
      return "/company#identity";
    case "update_tax_profile":
      return "/company#tax";
    case "update_bank":
      return "/company#bank";
    case "pay_profit_distribution":
      return "/company#shareholders";
    case "switch_company":
      return "/";
    default:
      return null;
  }
}

function contextHint(tokens?: number): string | undefined {
  if (!tokens || tokens < 1_000) return undefined;
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  return `${Math.round(tokens / 1_000)}k`;
}

/** The protocol is a property of the provider, so the panel can name it plainly. */
function protocolLabel(protocol: "openai" | "anthropic", t: Translate): string {
  return protocol === "anthropic" ? t("assistant.protocolAnthropic") : t("assistant.protocolOpenai");
}

export function Assistant({ variant = "popover" }: { variant?: "popover" | "page" } = {}) {
  const { t } = useI18n();
  const {
    messages,
    streaming,
    error,
    settings,
    catalog,
    selection,
    draft,
    setDraft,
    pending,
    send,
    chooseSelection,
    clear,
    abort,
  } = useAssistant();
  const page = variant === "page";
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const shown = page || open;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastUserMessageId = [...messages].reverse().find((message) => message.role === "user")?.id ?? null;

  useEffect(() => {
    if (page) return;
    if (readPanelOpen()) setOpen(true);
    if (readPanelExpanded()) setExpanded(true);
  }, [page]);

  useEffect(() => {
    if (page) return;
    storePanelOpen(open);
  }, [open, page]);

  useEffect(() => {
    if (page) return;
    storePanelExpanded(expanded);
  }, [expanded, page]);

  useEffect(() => {
    if (!shown) return;
    inputRef.current?.focus();
  }, [shown]);

  const listRef = useFollowBottom<HTMLDivElement>([messages, streaming, error, expanded]);

  const quickActions = [
    { key: "assistant.quickBriefing", prompt: t("assistant.promptBriefing") },
    { key: "assistant.quickInvoices", prompt: t("assistant.promptInvoices") },
    { key: "assistant.quickDeadlines", prompt: t("assistant.promptDeadlines") },
    { key: "assistant.quickClose", prompt: t("assistant.promptClose") },
  ] as const;

  const providerID = selection?.providerID ?? null;
  const selectedModel = selection
    ? (catalog?.models.find((model) => model.providerID === selection.providerID && model.modelID === selection.modelID) ?? null)
    : null;
  const providerModels = (catalog?.models ?? []).filter((model) => model.providerID === providerID);
  const hasChoices = Boolean(catalog && catalog.providers.length > 0 && catalog.models.length > 0);
  const showConfig = settings !== null && !settings.configured && !hasChoices;
  const selectedProvider = (catalog?.providers ?? []).find((provider) => provider.id === providerID) ?? null;
  const providerOptions = (catalog?.providers ?? []).map((provider) => {
    const label = provider.id === "env" ? t("assistant.envProvider") : provider.name;
    return {
      value: provider.id,
      label,
      tag: protocolLabel(provider.protocol, t),
      description: [
        provider.local ? t("assistant.providerLocal") : t("assistant.providerRemote"),
        provider.modelCount > 0 ? t("assistant.providerModelCount", { count: provider.modelCount }) : t("assistant.providerNoModels"),
        provider.id === "env" ? t("assistant.providerFromEnv") : provider.id,
      ].join(" · "),
      disabled: provider.modelCount === 0,
    };
  });
  const modelOptions = providerModels.map((model) => ({
    value: model.modelID,
    label: model.name,
    hint: contextHint(model.context),
  }));
  const modelStatus = selectedModel
    ? `${selectedModel.local ? t("assistant.local") : t("assistant.remote")} · ${protocolLabel(selectedModel.protocol, t)}${
        selectedModel.providerID === "env" ? ` · ${t("assistant.envProvider")}` : ""
      }`
    : settings?.configured
      ? `${settings.model} · ${settings.local ? t("assistant.local") : t("assistant.remote")}`
      : t("assistant.subtitle");
  const unusableProvider =
    selectedProvider && selectedProvider.modelCount === 0
      ? t("assistant.providerUnusable", { provider: selectedProvider.name })
      : null;
  // opencode found providers but none of them can be driven: say which ones, so
  // the entry the user added is not silently missing from the panel.
  const unusableProviders =
    catalog && catalog.providers.length > 0 && catalog.models.length === 0
      ? catalog.providers.map((provider) => provider.name).join(", ")
      : null;

  function chooseProvider(nextProviderID: string) {
    if (nextProviderID === providerID) return;
    const first = catalog?.models.find((model) => model.providerID === nextProviderID);
    if (first) chooseSelection({ providerID: first.providerID, modelID: first.modelID });
  }

  function chooseModel(nextModelID: string) {
    if (!providerID) return;
    chooseSelection({ providerID, modelID: nextModelID });
  }

  return (
    <>
      {page ? null : (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={shown}
          aria-label={shown ? t("assistant.close") : pending ? t("assistant.openRunning") : t("assistant.open")}
          className="fixed right-3 bottom-20 z-30 inline-flex min-h-12 items-center gap-2 rounded-full border border-pine-deep bg-pine px-4 text-sm font-medium text-paper shadow-lg shadow-ink/20 md:right-6 md:bottom-6"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path d="M4 12a8 8 0 0 1 8-8h1a7 7 0 0 1 0 14H9l-4 3v-4.5A8 8 0 0 1 4 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          <span className="hidden md:inline">{pending ? t("assistant.openRunning") : t("assistant.open")}</span>
          {pending ? <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-amber" /> : null}
        </button>
      )}

      {shown ? (
        <section
          aria-label={t("assistant.title")}
          className={
            page
              ? "flex h-[70dvh] min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-sm md:h-[calc(100dvh-12rem)] md:min-h-[32rem]"
              : expanded
                ? "fixed inset-3 z-50 flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl shadow-ink/25 md:inset-6"
                : "fixed inset-x-3 bottom-20 z-50 flex max-h-[78dvh] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl shadow-ink/25 md:inset-x-auto md:right-6 md:bottom-24 md:w-[27rem] md:max-h-[42rem]"
          }
        >
          <header className="border-b border-line px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg leading-tight">{t("assistant.title")}</h2>
                <p className="mt-0.5 truncate text-xs text-muted">{modelStatus}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {messages.length > 0 ? (
                  <button type="button" className="rounded-full px-2 py-1 text-xs text-muted hover:text-ink disabled:opacity-50" onClick={clear} disabled={pending}>
                    {t("assistant.newChat")}
                  </button>
                ) : null}
                {page ? null : (
                  <Link href="/assistant" className="rounded-full px-2 py-1 text-xs font-medium text-pine hover:underline">
                    {t("assistant.openPage")}
                  </Link>
                )}
                {page ? null : (
                  <button
                    type="button"
                    className="grid size-9 place-items-center rounded-full text-muted hover:text-ink"
                    onClick={() => setExpanded((value) => !value)}
                    aria-label={expanded ? t("assistant.restore") : t("assistant.maximize")}
                    aria-pressed={expanded}
                    title={expanded ? t("assistant.restore") : t("assistant.maximize")}
                  >
                    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                      {expanded ? (
                        <path
                          d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ) : (
                        <path
                          d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </svg>
                  </button>
                )}
                {page ? null : (
                  <button type="button" className="grid size-9 place-items-center rounded-full text-muted hover:text-ink" onClick={() => setOpen(false)} aria-label={t("assistant.close")}>
                    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                      <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {catalog === null ? <p className="mt-2 text-[11px] text-muted">{t("assistant.modelsLoading")}</p> : null}
            {hasChoices ? (
              <div className="mt-3 grid grid-cols-[minmax(0,0.56fr)_minmax(0,1fr)] gap-2">
                <Combobox
                  label={t("assistant.provider")}
                  value={providerID}
                  options={providerOptions}
                  onSelect={chooseProvider}
                  placeholder={t("assistant.noProvider")}
                  searchPlaceholder={t("assistant.searchProvider")}
                  noResultsLabel={t("assistant.noResults")}
                  disabled={pending}
                />
                <Combobox
                  label={t("assistant.model")}
                  value={selectedModel?.modelID ?? null}
                  options={modelOptions}
                  onSelect={chooseModel}
                  placeholder={t("assistant.noModel")}
                  searchPlaceholder={t("assistant.searchModel")}
                  noResultsLabel={t("assistant.noResults")}
                  disabled={pending || !providerID}
                />
              </div>
            ) : null}
            {selectedProvider && selectedProvider.id !== "env" ? (
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                <span
                  className={`rounded-full px-1.5 py-0.5 font-medium ${
                    selectedProvider.local ? "bg-moss/15 text-moss" : "bg-amber/15 text-amber"
                  }`}
                >
                  {selectedProvider.local ? t("assistant.providerLocal") : t("assistant.providerRemote")}
                </span>
                <span className="rounded-full bg-pine/10 px-1.5 py-0.5 font-medium text-pine">
                  {protocolLabel(selectedProvider.protocol, t)}
                </span>
                <span className="truncate font-mono normal-case">{selectedProvider.id}</span>
              </p>
            ) : null}
            {unusableProvider ? <p className="mt-2 text-[11px] leading-relaxed text-clay">{unusableProvider}</p> : null}
            {unusableProviders ? (
              <p className="mt-2 text-[11px] leading-relaxed text-clay">
                {t("assistant.providerUnusableAll", { providers: unusableProviders })} {t("assistant.providerUnusableHint")}
              </p>
            ) : null}
          </header>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
            {messages.length === 0 && !streaming ? (
              <div className="grid gap-3">
                <p className="text-sm leading-relaxed text-muted">{t("assistant.intro")}</p>
                {settings?.web ? <p className="text-[11px] leading-relaxed text-muted">{t("assistant.webNote")}</p> : null}
                {showConfig ? (
                  <div className="rounded-xl border border-amber/40 bg-amber/10 p-3 text-sm">
                    <p className="font-medium">{t("assistant.configTitle")}</p>
                    <p className="mt-1 text-xs leading-relaxed">{t("assistant.configBody")}</p>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-white/70 p-2 font-mono text-[11px] leading-relaxed">{`MANAGR_AI_MODEL=qwen2.5:14b
MANAGR_AI_BASE_URL=http://127.0.0.1:11434/v1
MANAGR_AI_API_KEY=…`}</pre>
                    <p className="mt-2 text-xs leading-relaxed text-muted">{t("assistant.configLocal")}</p>
                  </div>
                ) : null}
                <div className="grid gap-2">
                  {quickActions.map((action) => (
                    <button
                      key={action.key}
                      type="button"
                      className="min-h-11 rounded-xl border border-line bg-white px-3 text-left text-sm hover:border-ink/25"
                      onClick={() => void send(action.prompt)}
                    >
                      {t(action.key)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ol className="grid gap-3">
                {messages.map((message) => (
                  <AssistantTurn
                    key={message.id}
                    message={message}
                    pending={pending}
                    lastUserMessageId={lastUserMessageId}
                    onRetry={(id) => void send("", id)}
                  />
                ))}
                {streaming ? <AssistantStreamingTurn state={streaming} /> : null}
              </ol>
            )}
            {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}
          </div>

          <form
            className="border-t border-line p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <label className="sr-only" htmlFor="assistant-input">{t("assistant.placeholder")}</label>
            <textarea
              id="assistant-input"
              ref={inputRef}
              className={`${inputClass} min-h-12 resize-none py-2`}
              rows={2}
              value={draft}
              placeholder={t("assistant.placeholder")}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(draft);
                }
              }}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] leading-tight text-muted">{t("assistant.footer")}</p>
              {pending ? (
                <button type="button" className={buttonClass("quiet")} onClick={abort}>
                  {t("assistant.stop")}
                </button>
              ) : (
                <button type="submit" className={buttonClass()} disabled={!draft.trim()}>
                  {t("assistant.send")}
                </button>
              )}
            </div>
          </form>
        </section>
      ) : null}
    </>
  );
}

/**
 * One stored turn in the transcript. The mock page renders the same component,
 * so a preview and the live panel cannot drift apart.
 */
export function AssistantTurn({
  message,
  pending,
  lastUserMessageId,
  onRetry,
}: {
  message: Message;
  pending: boolean;
  lastUserMessageId: number | null;
  onRetry?: (id: number) => void;
}) {
  const { t } = useI18n();
  return (
    <li className={message.role === "user" ? "justify-self-end" : ""}>
      {message.role === "user" ? (
        <>
          <div className="max-w-[95%] rounded-2xl bg-pine px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-paper">{message.content}</div>
          {message.details || (!pending && message.id === lastUserMessageId) ? (
            <div className="mt-1 flex flex-col items-end gap-1">
              {message.details ? <MessageDetails details={message.details} role="user" /> : null}
              {!pending && message.id === lastUserMessageId && onRetry ? (
                <button type="button" onClick={() => onRetry(message.id)} className="text-[11px] font-medium text-pine hover:underline">
                  {t("assistant.retry")}
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="@container max-w-[95%] rounded-2xl border border-line bg-white px-3 py-2 text-sm">
            <TurnParts plan={message.plan} steps={message.steps} content={message.content} />
          </div>
          {message.details ? <MessageDetails details={message.details} role="assistant" /> : null}
        </>
      )}
    </li>
  );
}

/**
 * Roadmap and calls side by side once the bubble is wide enough, with the
 * answer below both. The container query measures the bubble, not the window,
 * so the narrow popover stays stacked while the page view uses two columns.
 */
function TurnParts({
  plan,
  steps,
  content,
  aside,
}: {
  plan?: PlanStepView[];
  steps: Step[];
  content: string;
  aside?: ReactNode;
}) {
  const hasPlan = Boolean(plan?.length);
  const hasSteps = steps.length > 0;
  return (
    <>
      {hasPlan || hasSteps ? (
        <div className={`grid gap-2 ${hasPlan && hasSteps ? "@xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] @xl:items-start" : ""}`}>
          {plan && plan.length > 0 ? <PlanBar plan={plan} /> : null}
          {hasSteps ? <Steps steps={steps} /> : null}
        </div>
      ) : null}
      {aside}
      {content ? <Markdown text={content} className={hasPlan || hasSteps || aside ? "mt-2" : ""} /> : null}
    </>
  );
}

/** The open turn, before it is committed to the transcript. */
export function AssistantStreamingTurn({
  state,
  onApprove,
}: {
  state: StreamingState;
  /** Replaces the real approval request, so the mock page stays offline. */
  onApprove?: (approved: string[]) => void | Promise<void>;
}) {
  const { t } = useI18n();
  return (
    <li>
      <div className="@container max-w-[95%] rounded-2xl border border-line bg-white px-3 py-2 text-sm">
        <TurnParts
          plan={state.plan}
          steps={state.steps}
          content={state.content}
          aside={state.proposal ? <ProposalCard key={state.proposal.id} proposal={state.proposal} onSubmit={onApprove} /> : null}
        />
        {state.steps.length === 0 && !state.plan?.length && !state.proposal && !state.content ? (
          <p className="text-muted">{t("assistant.thinking")}</p>
        ) : null}
      </div>
    </li>
  );
}

type StepGroup = { key: string; name: string; steps: Step[] };

/** Calls of the same tool share one row; their order stays the order they ran in. */
function groupSteps(steps: Step[]): StepGroup[] {
  const groups: StepGroup[] = [];
  const byName = new Map<string, StepGroup>();
  for (const step of steps) {
    const existing = byName.get(step.name);
    if (existing) {
      existing.steps.push(step);
      continue;
    }
    const group: StepGroup = { key: step.key, name: step.name, steps: [step] };
    byName.set(step.name, group);
    groups.push(group);
  }
  return groups;
}

function groupStatus(steps: Step[]): Step["status"] {
  if (steps.some((step) => step.status === "running")) return "running";
  if (steps.some((step) => step.status === "error")) return "error";
  return "ok";
}

/** A short hint that tells one call in a group from its siblings. */
function stepHint(step: Step): string {
  const input = step.input;
  if (typeof input === "string") return input;
  if (typeof input === "number") return String(input);
  if (input && typeof input === "object" && !Array.isArray(input)) {
    for (const value of Object.values(input as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) return value;
      if (typeof value === "number") return String(value);
    }
  }
  return "";
}

function StepStatusIcon({ status }: { status: Step["status"] }) {
  if (status === "running") {
    return <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-line border-t-pine" aria-hidden="true" />;
  }
  return (
    <span className={`shrink-0 ${status === "ok" ? "text-moss" : "text-clay"}`} aria-hidden="true">
      {status === "ok" ? "✓" : "✕"}
    </span>
  );
}

function Steps({ steps }: { steps: Step[] }) {
  const { t } = useI18n();
  const jsonView = useJsonView();
  const groups = groupSteps(steps);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement | null>(null);
  // Without a manual pick the pane follows the newest call, so it changes with
  // the progress and comes to rest on the last action of the turn.
  const newest = steps[steps.length - 1];
  const selectedKey = pinnedKey && steps.some((step) => step.key === pinnedKey) ? pinnedKey : newest?.key ?? null;
  const selected = steps.find((step) => step.key === selectedKey) ?? null;
  const selectedGroup = groups.find((group) => group.steps.some((step) => step.key === selectedKey)) ?? null;
  const selectedIndex = selected && selectedGroup ? selectedGroup.steps.findIndex((step) => step.key === selected.key) : 0;
  const selectedAction = selected && needsApproval(selected.name) ? changeAction(selected.name, selected.input) : null;

  // Keep the highlighted group visible inside the capped list without
  // scrolling the transcript itself.
  useEffect(() => {
    const list = listRef.current;
    const current = list
      ? [...list.querySelectorAll<HTMLElement>('[aria-current="true"]')].filter((node) => node.offsetParent !== null).pop()
      : null;
    if (!list || !current) return;
    const listBox = list.getBoundingClientRect();
    const box = current.getBoundingClientRect();
    if (box.top < listBox.top) list.scrollTop += box.top - listBox.top;
    else if (box.bottom > listBox.bottom) list.scrollTop += box.bottom - listBox.bottom;
  }, [selectedKey]);

  function selectGroup(group: StepGroup) {
    const last = group.steps[group.steps.length - 1];
    if (last) setPinnedKey(last.key);
  }

  return (
    <div className="@container min-w-0">
      <div className="grid gap-2 @sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] @sm:items-start">
        <ol ref={listRef} className="grid gap-1.5 @sm:max-h-64 @sm:overflow-y-auto">
          {groups.map((group) => {
            const current = group === selectedGroup;
            const last = group.steps[group.steps.length - 1];
            const groupAction = last && needsApproval(group.name) ? changeAction(group.name, last.input) : null;
            return (
              <li key={group.key}>
                <div className={`rounded-xl border p-2 transition ${current ? "border-pine/50 bg-pine/5" : "border-line bg-card hover:border-ink/25"}`}>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <button
                      type="button"
                      aria-current={current ? "true" : undefined}
                      onClick={() => selectGroup(group)}
                      className="group flex min-w-0 items-center gap-1.5 rounded text-left"
                    >
                      <StepStatusIcon status={groupStatus(group.steps)} />
                      <span className={`text-[12px] leading-tight font-medium group-hover:text-pine ${last?.status === "error" ? "text-clay" : ""}`}>
                        {toolLabelFor(group.name, t)}
                      </span>
                    </button>
                    {groupAction ? <ActionBadge action={groupAction} /> : null}
                    {group.steps.length > 1 ? (
                      <span
                        role="group"
                        aria-label={t("assistant.step.calls", { count: group.steps.length })}
                        className={`inline-flex items-center gap-0.5 ${current ? "@sm:hidden" : ""}`}
                      >
                        {group.steps.map((entry, index) => {
                          const active = current && index === selectedIndex;
                          return (
                            <button
                              key={entry.key}
                              type="button"
                              aria-label={t("assistant.step.call", { index: index + 1, total: group.steps.length })}
                              aria-current={active ? "true" : undefined}
                              onClick={() => setPinnedKey(entry.key)}
                              className="grid size-4 place-items-center rounded-full hover:bg-ink/5"
                            >
                              <span
                                className={`size-1.5 rounded-full transition ${
                                  active ? "bg-pine" : entry.status === "error" ? "bg-clay/60" : "bg-line"
                                }`}
                              />
                            </button>
                          );
                        })}
                      </span>
                    ) : null}
                  </div>
                  {/* With room to show them, the open group lists its calls
                      instead of leaving the reader with the dots alone. */}
                  {current && group.steps.length > 1 ? (
                    <ol className="mt-1.5 hidden gap-0.5 border-t border-line pt-1.5 @sm:grid">
                      {group.steps.map((entry, index) => {
                        const active = index === selectedIndex;
                        const hint = stepHint(entry);
                        return (
                          <li key={entry.key}>
                            <button
                              type="button"
                              aria-current={active ? "true" : undefined}
                              onClick={() => setPinnedKey(entry.key)}
                              className={`flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[11px] transition ${
                                active ? "bg-pine/10 text-ink" : "text-muted hover:bg-ink/5 hover:text-ink"
                              }`}
                            >
                              <StepStatusIcon status={entry.status} />
                              <span className="min-w-0 flex-1 truncate">
                                {t("assistant.step.call", { index: index + 1, total: group.steps.length })}
                              </span>
                              {hint ? <span className="max-w-[45%] shrink-0 truncate font-mono text-[10px]">{hint}</span> : null}
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
        {selected ? (
          <div className="flex h-64 min-w-0 flex-col rounded-xl border border-line bg-card p-2">
            {/* Keyed by the call and its state, so a swap fades in instead of
                flashing; the fixed height keeps the bubble still meanwhile. */}
            <div key={`${selected.key}-${selected.status}`} className="flex h-full min-h-0 animate-detail-in flex-col motion-reduce:animate-none">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <StepStatusIcon status={selected.status} />
                <p className={`text-[12px] leading-tight font-medium ${selected.status === "error" ? "text-clay" : ""}`}>
                  {toolLabelFor(selected.name, t)}
                </p>
                {selectedAction ? <ActionBadge action={selectedAction} /> : null}
                <span className="ml-auto flex items-center gap-1">
                  {selectedGroup && selectedGroup.steps.length > 1 ? (
                    <span className="text-[10px] text-muted">
                      {t("assistant.step.call", { index: selectedIndex + 1, total: selectedGroup.steps.length })}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    aria-pressed={jsonView === "raw"}
                    title={jsonView === "raw" ? t("assistant.step.rawOff") : t("assistant.step.rawOn")}
                    onClick={() => setJsonView(jsonView === "raw" ? "tree" : "raw")}
                    className={`rounded-full border px-1.5 py-0.5 font-mono text-[10px] leading-none transition ${
                      jsonView === "raw"
                        ? "border-pine bg-pine text-paper"
                        : "border-line bg-white text-muted hover:border-ink hover:text-ink"
                    }`}
                  >
                    JSON
                  </button>
                </span>
              </div>
              <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto">
                <StepDetails step={selected} raw={jsonView === "raw"} />
                {selected.status === "ok" ? <StepCard step={selected} /> : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const stepSectionClass = "text-[10px] font-semibold tracking-[0.12em] text-muted uppercase";

/** What the assistant called, with which arguments, and what came back. */
function StepDetails({ step, raw }: { step: Step; raw: boolean }) {
  const { t, tx } = useI18n();
  const input = step.input;
  const write = needsApproval(step.name);
  const hasInput =
    input !== undefined &&
    input !== null &&
    (typeof input !== "object" || Array.isArray(input) || Object.keys(input as Record<string, unknown>).length > 0);
  const truncated =
    typeof step.data === "object" && step.data !== null && (step.data as { truncated?: unknown }).truncated === true;
  return (
    <div className="grid gap-2 text-[11px]">
      <section>
        <p className={stepSectionClass}>{t("assistant.step.executed")}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <code className="rounded bg-ink/5 px-1 py-0.5 font-mono text-[10px]">{step.name}</code>
          {step.status === "running" ? <span className="text-[10px] text-muted">{t("assistant.step.running")}</span> : null}
        </div>
        {hasInput ? (
          <JsonBlock value={input} raw={raw} className="mt-1" />
        ) : (
          <p className="mt-1 text-[10px] text-muted">{t("assistant.step.noInput")}</p>
        )}
      </section>
      <section className="border-t border-line pt-2">
        <p className={stepSectionClass}>{write ? t("assistant.step.result") : t("assistant.step.read")}</p>
        {step.status === "error" ? (
          <p className="mt-1 text-[10px] text-clay">{step.summary ? tx(step.summary) : t("assistant.step.failed")}</p>
        ) : step.data === undefined ? (
          <p className="mt-1 text-[10px] text-muted">{step.status === "running" ? t("assistant.step.running") : t("assistant.step.noResult")}</p>
        ) : truncated ? (
          <p className="mt-1 text-[10px] text-muted">{t("assistant.step.truncated")}</p>
        ) : (
          <JsonBlock value={step.data} raw={raw} className="mt-1" />
        )}
      </section>
    </div>
  );
}

/** The tool payload either as a readable tree or as its raw JSON block. */
function JsonBlock({ value, raw, className = "" }: { value: unknown; raw: boolean; className?: string }) {
  if (raw) {
    return (
      <pre className={`${className} rounded bg-ink/5 p-1.5 font-mono text-[10px] leading-relaxed break-words whitespace-pre-wrap`}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }
  return (
    <div className={`${className} text-[11px] leading-relaxed`}>
      <JsonTree value={value} />
    </div>
  );
}

function JsonTree({ value }: { value: unknown }) {
  const { t } = useI18n();
  if (value === null) return <span className="text-muted">null</span>;
  if (typeof value === "boolean") return <span>{value ? t("assistant.approval.yes") : t("assistant.approval.no")}</span>;
  if (typeof value === "number" || typeof value === "string") {
    return <span className="break-words whitespace-pre-wrap">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted">{t("assistant.approval.empty")}</span>;
    return (
      <div className="grid gap-1">
        <span className="text-[10px] text-muted">{t("assistant.approval.entries", { count: value.length })}</span>
        <ol className="grid gap-1.5 border-l border-line pl-2">
          {value.map((item, index) => (
            <li key={index} className="min-w-0">
              <JsonTree value={item} />
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-muted">{t("assistant.approval.empty")}</span>;
    return (
      <dl className="grid gap-0.5">
        {entries.map(([key, item]) => (
          <div key={key} className="grid grid-cols-[minmax(4.5rem,auto)_minmax(0,1fr)] gap-x-2">
            <dt className="break-all font-mono text-[10px] text-muted">{key}</dt>
            <dd className="min-w-0">
              <JsonTree value={item} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span>{String(value)}</span>;
}

export function formatMessageTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatDuration(ms: number, locale: string): string {
  const seconds = Math.max(0, ms) / 1000;
  return `${new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(seconds)} s`;
}

/** Time, model, endpoint, MCP server, and tool count behind one message. */
function MessageDetails({ details, role }: { details: ChatMessageDetails; role: "user" | "assistant" }) {
  const { t, locale } = useI18n();
  const rows: { label: string; value: string; title?: string }[] = [];
  if (details.model) rows.push({ label: t("assistant.details.model"), value: details.model });
  if (details.provider) rows.push({ label: t("assistant.details.provider"), value: details.provider });
  if (details.protocol) rows.push({ label: t("assistant.details.protocol"), value: protocolLabel(details.protocol, t) });
  if (details.baseUrl) {
    rows.push({
      label: t("assistant.details.endpoint"),
      value: `${details.baseUrl} · ${details.local ? t("assistant.details.local") : t("assistant.details.remote")}`,
      title: details.baseUrl,
    });
  }
  rows.push({ label: t("assistant.details.mcp"), value: details.mcpServer ?? MCP_SERVER });
  if (role === "assistant" && details.toolCalls !== undefined) {
    rows.push({ label: t("assistant.details.tools"), value: t("assistant.details.toolCount", { count: details.toolCalls }) });
  }
  if (role === "assistant" && details.status) {
    const status =
      details.status === "ok"
        ? t("assistant.details.status.ok")
        : details.status === "error"
          ? t("assistant.details.status.error")
          : t("assistant.details.status.stopped");
    rows.push({ label: t("assistant.details.status"), value: status });
  }
  if (details.retries !== undefined && details.retries > 0) {
    rows.push({ label: t("assistant.details.retries"), value: t("assistant.details.retryCount", { count: details.retries }) });
    if (details.lastRetryAt) {
      rows.push({
        label: t("assistant.details.retryLast"),
        value: formatMessageTime(details.lastRetryAt, locale),
      });
    }
  }
  return (
    <details className={`mt-1 w-fit max-w-[95%] text-[11px] text-muted ${role === "user" ? "ml-auto" : ""}`}>
      <summary className="cursor-pointer select-none">
        {formatMessageTime(details.at, locale)}
        {details.durationMs !== undefined ? ` · ${formatDuration(details.durationMs, locale)}` : ""}
        {" · "}
        {t("assistant.details.summary")}
      </summary>
      <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 border-t border-line pt-1">
        {rows.map((row) => (
          <Fragment key={row.label}>
            <dt>{row.label}</dt>
            <dd className="truncate text-ink/80" title={row.title ?? row.value}>
              {row.value}
            </dd>
          </Fragment>
        ))}
      </dl>
    </details>
  );
}

const FIELD_LABELS: Record<string, { de: string; en: string }> = {
  id: { de: "Datensatz", en: "Record" },
  companyId: { de: "Unternehmen", en: "Company" },
  customerId: { de: "Kunde", en: "Customer" },
  invoiceId: { de: "Rechnung", en: "Invoice" },
  personId: { de: "Person", en: "Person" },
  projectId: { de: "Projekt", en: "Project" },
  taskId: { de: "Aufgabe", en: "Task" },
  shareholderId: { de: "Gesellschafter", en: "Shareholder" },
  shareholderLoanId: { de: "Darlehen", en: "Loan" },
  entryDate: { de: "Datum", en: "Date" },
  startedAt: { de: "Von", en: "From" },
  endedAt: { de: "Bis", en: "To" },
  breakMinutes: { de: "Pause", en: "Break" },
  memo: { de: "Vermerk", en: "Note" },
  taskType: { de: "Tätigkeit", en: "Task type" },
  billable: { de: "Abrechenbar", en: "Billable" },
  issueDate: { de: "Rechnungsdatum", en: "Issue date" },
  serviceDate: { de: "Leistungsdatum", en: "Service date" },
  dueDate: { de: "Fällig", en: "Due" },
  paymentDate: { de: "Zahlungsdatum", en: "Payment date" },
  buyerReference: { de: "Käuferreferenz", en: "Buyer reference" },
  lines: { de: "Positionen", en: "Lines" },
  description: { de: "Bezeichnung", en: "Description" },
  quantity: { de: "Menge", en: "Quantity" },
  unitNet: { de: "Einzelpreis netto", en: "Unit price net" },
  vatBps: { de: "Umsatzsteuer", en: "VAT" },
  amount: { de: "Betrag", en: "Amount" },
  date: { de: "Datum", en: "Date" },
  name: { de: "Name", en: "Name" },
  email: { de: "E-Mail", en: "Email" },
  vatId: { de: "USt-IdNr.", en: "VAT id" },
  street: { de: "Straße", en: "Street" },
  postalCode: { de: "PLZ", en: "Postal code" },
  city: { de: "Ort", en: "City" },
  country: { de: "Land", en: "Country" },
  kind: { de: "Art", en: "Kind" },
  status: { de: "Status", en: "Status" },
  title: { de: "Titel", en: "Title" },
  notes: { de: "Notizen", en: "Notes" },
  note: { de: "Notiz", en: "Note" },
  category: { de: "Kategorie", en: "Category" },
  recurrence: { de: "Wiederholung", en: "Recurrence" },
  label: { de: "Bezeichnung", en: "Label" },
  provider: { de: "Anbieter", en: "Provider" },
  policyNumber: { de: "Police", en: "Policy" },
  monthlyPremium: { de: "Monatsbeitrag", en: "Monthly premium" },
  renewalDate: { de: "Verlängerung", en: "Renewal" },
  shareBps: { de: "Anteil", en: "Share" },
  nominal: { de: "Nominal", en: "Nominal" },
  grossMonthly: { de: "Gehalt monatlich", en: "Monthly gross" },
  validFrom: { de: "Gültig ab", en: "Valid from" },
  startDate: { de: "Von", en: "From" },
  endDate: { de: "Bis", en: "To" },
  year: { de: "Jahr", en: "Year" },
  month: { de: "Monat", en: "Month" },
  progressBps: { de: "Fortschritt", en: "Progress" },
  targetDate: { de: "Ziel", en: "Target date" },
  reason: { de: "Grund", en: "Reason" },
};

const MONEY_FIELDS = new Set(["amount", "nominal", "grossMonthly", "unitNet", "monthlyPremium"]);

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

function fieldLabel(key: string, locale: string): string {
  const entry = FIELD_LABELS[key];
  if (entry) return locale === "de" ? entry.de : entry.en;
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase());
}

function fieldValue(key: string, value: unknown, locale: string, t: Translate): string {
  if (value === null || value === "") return t("assistant.approval.empty");
  if (typeof value === "boolean") return value ? t("assistant.approval.yes") : t("assistant.approval.no");
  if (typeof value === "number") {
    if (key === "vatBps" || key === "shareBps" || key === "progressBps") {
      return `${new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: 2 }).format(value / 100)} %`;
    }
    if (key.endsWith("Id")) return `#${value}`;
    if (key === "breakMinutes") return `${value} min`;
    if (MONEY_FIELDS.has(key)) return `${value} €`;
    return String(value);
  }
  if (Array.isArray(value)) {
    return key === "lines"
      ? t("assistant.approval.lines", { count: value.length })
      : t("assistant.approval.entries", { count: value.length });
  }
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  if (typeof value === "string" && MONEY_FIELDS.has(key)) return `${value} €`;
  return String(value);
}

function changeFields(input: unknown): { key: string; value: unknown }[] {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return input === undefined || input === null ? [] : [{ key: "value", value: input }];
  }
  return Object.entries(input as Record<string, unknown>)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ({ key, value }));
}

/** Confirmation card for the write tools an assistant turn wants to run. */
function ProposalCard({ proposal, onSubmit }: { proposal: Proposal; onSubmit?: (approved: string[]) => void | Promise<void> }) {
  const { t, locale } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(proposal.changes.map((change) => change.callId)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(callId: string) {
    if (busy) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(callId)) next.delete(callId);
      else next.add(callId);
      return next;
    });
  }

  async function submit(approved: string[]) {
    if (busy) return;
    setBusy(true);
    setError("");
    if (onSubmit) {
      try {
        await onSubmit(approved);
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      const response = await fetch("/api/assistant/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: proposal.id, approved }),
      });
      if (!response.ok) {
        setError(response.status === 404 ? t("assistant.approval.expired") : t("assistant.approval.failed"));
        setBusy(false);
      }
    } catch {
      setError(t("assistant.approval.failed"));
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-amber/40 bg-amber/5 p-3">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-amber uppercase">
        {proposal.changes.length === 1
          ? t("assistant.approval.titleOne")
          : t("assistant.approval.title", { count: proposal.changes.length })}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{t("assistant.approval.intro")}</p>
      <ul className="mt-2 grid gap-2">
        {proposal.changes.map((change) => {
          const fields = changeFields(change.input);
          return (
            <li key={change.callId} className="rounded-lg border border-line bg-white p-2">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-pine"
                  checked={selected.has(change.callId)}
                  onChange={() => toggle(change.callId)}
                  disabled={busy}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <ActionBadge action={change.action} />
                    <span className="text-xs font-medium">{toolLabelFor(change.name, t)}</span>
                  </span>
                  {fields.length > 0 ? (
                    <dl className="mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-[11px]">
                      {fields.map(({ key, value }) => {
                        const text = change.labels?.[key] ?? fieldValue(key, value, locale, t);
                        return (
                          <Fragment key={key}>
                            <dt className="text-muted">{fieldLabel(key, locale)}</dt>
                            <dd className="truncate" title={text}>
                              {text}
                            </dd>
                          </Fragment>
                        );
                      })}
                    </dl>
                  ) : null}
                </span>
              </label>
              <details className="mt-1 text-[10px] text-muted">
                <summary className="cursor-pointer select-none">{t("assistant.approval.raw")}</summary>
                <pre className="mt-1 overflow-x-auto rounded bg-ink/5 p-1 font-mono text-[10px] leading-relaxed">
                  {JSON.stringify(change.input, null, 2)}
                </pre>
              </details>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass()}
          disabled={busy}
          onClick={() => void submit(proposal.changes.map((change) => change.callId))}
        >
          {t("assistant.approval.approveAll")}
        </button>
        <button type="button" className={buttonClass("danger")} disabled={busy} onClick={() => void submit([])}>
          {t("assistant.approval.rejectAll")}
        </button>
        <button
          type="button"
          className={buttonClass("quiet")}
          disabled={busy || selected.size === 0}
          onClick={() => void submit([...selected])}
        >
          {t("assistant.approval.approveSelected", { count: selected.size })}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted">
        {t("assistant.approval.selected", { count: selected.size, total: proposal.changes.length })}
      </p>
      {busy ? <p className="mt-1 text-[11px] text-muted">{t("assistant.approval.applying")}</p> : null}
      {error ? <p className="mt-1 text-[11px] text-clay">{error}</p> : null}
    </div>
  );
}

export function toolLabelFor(name: string, t: (key: MessageKey) => string): string {
  const key = TOOL_LABEL_KEYS[name];
  return key ? t(key) : name.replaceAll("_", " ");
}

function StepCard({ step }: { step: Step }) {
  const { t } = useI18n();
  if (step.name === "web_search") {
    const query = (step.input as { query?: string } | undefined)?.query;
    if (!query) return null;
    const results = (step.data as { results?: unknown[] } | undefined)?.results;
    return <p className="mt-1 truncate text-[11px] text-muted">{t("assistant.webResults", { count: results?.length ?? 0, query })}</p>;
  }
  if (step.name === "web_fetch") {
    const url = (step.input as { url?: string } | undefined)?.url;
    return url ? <p className="mt-1 truncate font-mono text-[10px] text-muted">{url}</p> : null;
  }
  if (["create_invoice", "issue_invoice", "record_invoice_payment", "void_invoice"].includes(step.name)) {
    const invoiceId = (step.data as { invoiceId?: number } | undefined)?.invoiceId;
    if (typeof invoiceId === "number") return <InvoiceCard invoiceId={invoiceId} />;
  }
  if (step.name === "post_payroll" && step.data) {
    const data = step.data as { grossCents?: number; netCents?: number; wageTaxCents?: number; employerSocialCents?: number; personId?: number };
    return <PayrollCard data={data} />;
  }
  const href = recordHref(step);
  if (!href) return null;
  return (
    <Link href={href} className={`${buttonClass("quiet")} mt-2`}>
      {t("assistant.openRecord")}
    </Link>
  );
}

function InvoiceCard({ invoiceId }: { invoiceId: number }) {
  const { t, label } = useI18n();
  const query = useQuery({
    queryKey: queryKeys.invoice(invoiceId),
    queryFn: async () => {
      const response = await fetch(viewPath.invoice(invoiceId));
      if (!response.ok) throw new Error("This invoice could not be loaded.");
      return response.json();
    },
  });
  if (query.isPending) return <p className="mt-2 text-[11px] text-muted">{t("common.loading")}</p>;
  if (query.isError || !query.data) return null;
  const data = query.data as {
    invoice: { number: string | null; issueDate: string; dueDate: string };
    customer: { name: string };
    lines: { id: number; description: string; netCents: number }[];
    netCents: number;
    vatCents: number;
    grossCents: number;
    openCents: number;
    displayStatus: string;
  };
  return (
    <div className="mt-2 rounded-xl border border-line bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">{t("invoices.title")}</p>
          <p className="font-display text-lg leading-tight">{data.invoice.number ?? t("common.draft")}</p>
          <p className="truncate text-xs text-muted">{data.customer.name}</p>
          <p className="text-[11px] text-muted">
            {formatDate(data.invoice.issueDate)} · {t("invoices.dueShort", { date: formatDate(data.invoice.dueDate) })}
          </p>
        </div>
        <Pill tone={data.displayStatus}>{label(data.displayStatus)}</Pill>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        <div className="flex justify-between gap-2"><dt className="text-muted">{t("common.net")}</dt><dd className="font-mono">{formatEuro(data.netCents)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted">{t("common.vat")}</dt><dd className="font-mono">{formatEuro(data.vatCents)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted">{t("common.gross")}</dt><dd className="font-mono">{formatEuro(data.grossCents)}</dd></div>
        <div className="flex justify-between gap-2"><dt className="text-muted">{t("common.open")}</dt><dd className="font-mono">{formatEuro(data.openCents)}</dd></div>
      </dl>
      <ul className="mt-2 grid gap-0.5 border-t border-line pt-2 text-[11px]">
        {data.lines.slice(0, 4).map((line) => (
          <li key={line.id} className="flex justify-between gap-2">
            <span className="truncate">{line.description}</span>
            <span className="shrink-0 font-mono">{formatEuro(line.netCents)}</span>
          </li>
        ))}
        {data.lines.length > 4 ? <li className="text-muted">{t("assistant.moreLines", { count: data.lines.length - 4 })}</li> : null}
      </ul>
      <Link href={`/invoices/${invoiceId}`} className={`${buttonClass("quiet")} mt-3`}>
        {t("assistant.openRecord")}
      </Link>
    </div>
  );
}

function PayrollCard({ data }: { data: { grossCents?: number; netCents?: number; wageTaxCents?: number; employerSocialCents?: number; personId?: number } }) {
  const { t } = useI18n();
  const row = (label: string, cents?: number) =>
    typeof cents === "number" ? (
      <div className="flex justify-between gap-2">
        <dt className="text-muted">{label}</dt>
        <dd className="font-mono">{formatEuro(cents)}</dd>
      </div>
    ) : null;
  return (
    <div className="mt-2 rounded-xl border border-line bg-card p-3">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">{t("people.payroll")}</p>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
        {row(t("people.grossPay"), data.grossCents)}
        {row(t("people.wageTaxRow"), data.wageTaxCents)}
        {row(t("people.netPay"), data.netCents)}
        {row(t("people.socialTotal"), data.employerSocialCents)}
      </dl>
      {typeof data.personId === "number" ? (
        <Link href={`/people/${data.personId}`} className={`${buttonClass("quiet")} mt-3`}>
          {t("assistant.openRecord")}
        </Link>
      ) : null}
    </div>
  );
}