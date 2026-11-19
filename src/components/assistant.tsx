"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/domain/calendar";
import { formatEuro } from "@/domain/money";
import { nextMessageId, readChat, writeChat, type ChatMessage, type ChatMessageDetails, type ChatStep } from "@/client/chat-history";
import { queryKeys, viewPath } from "@/client/query-keys";
import type { MessageKey } from "@/i18n";
import { Combobox } from "./combobox";
import { useI18n } from "./locale-provider";
import { Markdown } from "./markdown";
import { buttonClass, inputClass, Pill } from "./ui";

type Step = ChatStep;

type Message = ChatMessage;

type Settings = { configured: boolean; model: string; baseUrl: string; local: boolean; web?: boolean };

type Selection = { providerID: string; modelID: string };

type CatalogProvider = { id: string; name: string };

type CatalogModel = {
  id: string;
  providerID: string;
  modelID: string;
  name: string;
  providerName: string;
  local: boolean;
  context?: number;
};

type Catalog = {
  available: boolean;
  error?: string;
  providers: CatalogProvider[];
  models: CatalogModel[];
  default: Selection | null;
};

type StreamEvent =
  | { type: "model"; model: string; baseUrl: string; local: boolean; providerID?: string; modelID?: string }
  | { type: "delta"; text: string }
  | { type: "reset" }
  | { type: "tool"; name: string; input: unknown }
  | { type: "tool_result"; name: string; input: unknown; ok: boolean; summary: string; data?: unknown }
  | { type: "proposal"; id: string; changes: ProposalChange[] }
  | { type: "reply"; text: string }
  | { type: "error"; message: string };

type ProposalChange = {
  callId: string;
  name: string;
  action: "add" | "update" | "delete";
  input: unknown;
  labels?: Record<string, string>;
};

type Proposal = { id: string; changes: ProposalChange[] };

const TOOL_LABEL_KEYS: Record<string, MessageKey> = {
  read_companies: "assistant.tool.read_companies",
  read_desk: "assistant.tool.read_desk",
  read_company: "assistant.tool.read_company",
  read_customers: "assistant.tool.read_customers",
  read_invoices: "assistant.tool.read_invoices",
  read_invoice: "assistant.tool.read_invoice",
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

const READ_ONLY = /^read_/;
const NO_WRITE = new Set(["daily_briefing", "vat_overview", "monthly_close_checklist", "draft_dunning_letter", "web_search", "web_fetch"]);

function writes(name: string): boolean {
  return !READ_ONLY.test(name) && !NO_WRITE.has(name);
}

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

let nextId = 1;

const MODEL_STORAGE_KEY = "managr-assistant-model";
/** The desk's own tool registry, also served at /api/mcp. */
const MCP_SERVER = "managr-mcp";

function readStoredSelection(): Selection | null {
  try {
    const raw = window.localStorage.getItem(MODEL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Selection>;
    return typeof parsed.providerID === "string" && typeof parsed.modelID === "string"
      ? { providerID: parsed.providerID, modelID: parsed.modelID }
      : null;
  } catch {
    return null;
  }
}

function storeSelection(selection: Selection): void {
  try {
    window.localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // A private window may refuse storage; the choice then lasts for the session.
  }
}

function contextHint(tokens?: number): string | undefined {
  if (!tokens || tokens < 1_000) return undefined;
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  return `${Math.round(tokens / 1_000)}k`;
}

export function Assistant({ variant = "popover" }: { variant?: "popover" | "page" } = {}) {
  const { t, tx, label } = useI18n();
  const queryClient = useQueryClient();
  const page = variant === "page";
  const [open, setOpen] = useState(false);
  const shown = page || open;
  const [messages, setMessages] = useState<Message[]>([]);
  const [restored, setRestored] = useState(false);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<{ content: string; steps: Step[]; proposal?: Proposal } | null>(null);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pending = streaming !== null;

  useEffect(() => {
    let active = true;
    fetch("/api/assistant")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Settings | null) => {
        if (active && data) setSettings(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let stored: Message[] = [];
    try {
      stored = readChat(window.localStorage);
    } catch {
      // A private window may refuse storage; the history then lasts for the session.
    }
    if (stored.length > 0) {
      nextId = Math.max(nextId, nextMessageId(stored));
      setMessages((current) => (current.length > 0 ? current : stored));
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      writeChat(window.localStorage, messages);
    } catch {
      // A private window may refuse storage; the history then lasts for the session.
    }
  }, [messages, restored]);

  useEffect(() => {
    let active = true;
    fetch("/api/assistant/models")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Catalog | null) => {
        if (active) setCatalog(data ?? { available: false, providers: [], models: [], default: null });
      })
      .catch(() => {
        if (active) setCatalog({ available: false, providers: [], models: [], default: null });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!catalog) return;
    const valid = (candidate: Selection | null): Selection | null =>
      candidate && catalog.models.some((model) => model.providerID === candidate.providerID && model.modelID === candidate.modelID)
        ? candidate
        : null;
    if (valid(selection)) return;
    const first = catalog.models[0];
    const next =
      valid(readStoredSelection()) ??
      valid(catalog.default) ??
      (first ? { providerID: first.providerID, modelID: first.modelID } : null);
    if (next) {
      setSelection(next);
      storeSelection(next);
    } else {
      setSelection(null);
    }
  }, [catalog, selection]);

  useEffect(() => {
    if (!shown) return;
    inputRef.current?.focus();
  }, [shown]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, streaming, error]);

  function chooseSelection(next: Selection) {
    setSelection(next);
    storeSelection(next);
  }

  async function send(raw: string) {
    const content = raw.trim();
    if (!content || pending) return;
    const startedAt = Date.now();
    const promptModel = selection
      ? (catalog?.models.find((model) => model.providerID === selection.providerID && model.modelID === selection.modelID) ?? null)
      : null;
    const question: Message = {
      id: nextId++,
      role: "user",
      content,
      steps: [],
      details: {
        at: new Date(startedAt).toISOString(),
        model: promptModel?.name ?? (settings?.model || undefined),
        provider: promptModel?.providerName,
        local: promptModel?.local ?? settings?.local,
        mcpServer: MCP_SERVER,
      },
    };
    const history = [...messages, question];
    setMessages(history);
    setDraft("");
    setError("");
    let answer = "";
    let steps: Step[] = [];
    let stepSeq = 0;
    let errorText = "";
    let modelInfo: { name: string; providerID?: string; modelID?: string; baseUrl: string; local: boolean } | null = null;
    let proposal: Proposal | null = null;
    setStreaming({ content: "", steps: [] });
    const sync = () => setStreaming({ content: answer, steps, ...(proposal ? { proposal } : {}) });
    const clearProposal = () => {
      if (!proposal) return;
      proposal = null;
      sync();
    };
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // An assistant turn that only ran tools has no text; it adds nothing to
      // the model's context. Keep the request near the stored history size.
      const turns = history
        .filter((message) => message.role === "user" || message.content.trim().length > 0)
        .slice(-40)
        .map(({ role, content: text }) => ({ role, content: text }));
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: turns,
          ...(selection ? { selection } : {}),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (data.notConfigured) {
          setSettings((current) => ({
            configured: false,
            model: data.model ?? "",
            baseUrl: data.baseUrl ?? "",
            local: true,
            web: current?.web,
          }));
        }
        errorText = typeof data.error === "string" ? data.error : t("assistant.failed");
      } else if (!response.body) {
        errorText = t("assistant.failed");
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let sawReply = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline = buffer.indexOf("\n");
          while (newline !== -1) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            newline = buffer.indexOf("\n");
            if (!line) continue;
            let event: StreamEvent;
            try {
              event = JSON.parse(line) as StreamEvent;
            } catch {
              continue;
            }
            if (proposal && event.type !== "model" && event.type !== "proposal") {
              clearProposal();
            }
            if (event.type === "model") {
              modelInfo = {
                name: event.model,
                providerID: event.providerID,
                modelID: event.modelID,
                baseUrl: event.baseUrl,
                local: Boolean(event.local),
              };
              setSettings({ configured: true, model: event.model, baseUrl: event.baseUrl, local: Boolean(event.local) });
            } else if (event.type === "delta") {
              answer += event.text;
              sync();
            } else if (event.type === "reset") {
              answer = "";
              sync();
            } else if (event.type === "tool") {
              steps = [...steps, { key: `${stepSeq++}`, name: event.name, input: event.input, status: "running", summary: "" }];
              sync();
            } else if (event.type === "tool_result") {
              steps = steps.map((step, index) =>
                index === steps.length - 1 ? { ...step, status: event.ok ? "ok" : "error", summary: event.summary, data: event.data } : step,
              );
              sync();
              if (event.ok && writes(event.name)) {
                void queryClient.invalidateQueries({ queryKey: ["view"] });
              }
            } else if (event.type === "reply") {
              answer = event.text;
              sawReply = true;
              sync();
            } else if (event.type === "proposal") {
              proposal = { id: event.id, changes: event.changes };
              sync();
            } else if (event.type === "error") {
              errorText = event.message;
            }
          }
        }
        if (!sawReply && !answer && steps.length === 0 && !errorText) errorText = t("assistant.failed");
      }
    } catch (caught) {
      if (!controller.signal.aborted) errorText = t("assistant.failed");
    } finally {
      abortRef.current = null;
      if (answer || steps.length > 0) {
        const providerName = modelInfo?.providerID
          ? (catalog?.models.find(
              (model) => model.providerID === modelInfo?.providerID && model.modelID === modelInfo?.modelID,
            )?.providerName ?? modelInfo.providerID)
          : promptModel?.providerName;
        const details: ChatMessageDetails = {
          at: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          model: modelInfo?.name ?? promptModel?.name ?? (settings?.model || undefined),
          provider: providerName,
          baseUrl: modelInfo?.baseUrl,
          local: modelInfo?.local ?? promptModel?.local ?? settings?.local,
          mcpServer: MCP_SERVER,
          toolCalls: steps.length,
          status: controller.signal.aborted ? "stopped" : errorText ? "error" : "ok",
        };
        setMessages((current) => [...current, { id: nextId++, role: "assistant", content: answer, steps, details }]);
      }
      setStreaming(null);
      setError(errorText ? tx(errorText) : "");
    }
  }

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
  const providerOptions = (catalog?.providers ?? []).map((provider) => ({
    value: provider.id,
    label: provider.id === "env" ? t("assistant.envProvider") : provider.name,
  }));
  const modelOptions = providerModels.map((model) => ({
    value: model.modelID,
    label: model.name,
    hint: contextHint(model.context),
  }));
  const modelStatus = selectedModel
    ? `${selectedModel.local ? t("assistant.local") : t("assistant.remote")} · ${
        selectedModel.providerID === "env" ? t("assistant.envProvider") : t("assistant.opencode")
      }`
    : settings?.configured
      ? `${settings.model} · ${settings.local ? t("assistant.local") : t("assistant.remote")}`
      : t("assistant.subtitle");

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
          aria-label={shown ? t("assistant.close") : t("assistant.open")}
          className="fixed right-3 bottom-20 z-30 inline-flex min-h-12 items-center gap-2 rounded-full border border-pine-deep bg-pine px-4 text-sm font-medium text-paper shadow-lg shadow-ink/20 md:right-6 md:bottom-6"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path d="M4 12a8 8 0 0 1 8-8h1a7 7 0 0 1 0 14H9l-4 3v-4.5A8 8 0 0 1 4 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          <span className="hidden md:inline">{t("assistant.open")}</span>
        </button>
      )}

      {shown ? (
        <section
          aria-label={t("assistant.title")}
          className={
            page
              ? "flex h-[70dvh] min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-sm md:h-[calc(100dvh-12rem)] md:min-h-[32rem]"
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
                  <button type="button" className="rounded-full px-2 py-1 text-xs text-muted hover:text-ink disabled:opacity-50" onClick={() => { setMessages([]); setError(""); }} disabled={pending}>
                    {t("assistant.newChat")}
                  </button>
                ) : null}
                {page ? null : (
                  <Link href="/assistant" className="rounded-full px-2 py-1 text-xs font-medium text-pine hover:underline">
                    {t("assistant.openPage")}
                  </Link>
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
                  <li key={message.id} className={message.role === "user" ? "justify-self-end" : ""}>
                    {message.role === "user" ? (
                      <>
                        <div className="max-w-[95%] rounded-2xl bg-pine px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-paper">{message.content}</div>
                        {message.details ? <MessageDetails details={message.details} role="user" /> : null}
                      </>
                    ) : (
                      <>
                        <div className="max-w-[95%] rounded-2xl border border-line bg-white px-3 py-2 text-sm">
                          {message.steps.length > 0 ? <Steps steps={message.steps} /> : null}
                          {message.content ? <Markdown text={message.content} className="mt-2" /> : null}
                        </div>
                        {message.details ? <MessageDetails details={message.details} role="assistant" /> : null}
                      </>
                    )}
                  </li>
                ))}
                {streaming ? (
                  <li>
                    <div className="max-w-[95%] rounded-2xl border border-line bg-white px-3 py-2 text-sm">
                      {streaming.steps.length > 0 ? <Steps steps={streaming.steps} /> : null}
                      {streaming.proposal ? <ProposalCard key={streaming.proposal.id} proposal={streaming.proposal} /> : null}
                      {streaming.steps.length === 0 && !streaming.proposal && !streaming.content ? (
                        <p className="text-muted">{t("assistant.thinking")}</p>
                      ) : null}
                      {streaming.content ? <Markdown text={streaming.content} className="mt-2" /> : null}
                    </div>
                  </li>
                ) : null}
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
                <button type="button" className={buttonClass("quiet")} onClick={() => abortRef.current?.abort()}>
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

function Steps({ steps }: { steps: Step[] }) {
  const { t, tx } = useI18n();
  return (
    <ol className="grid gap-2">
      {steps.map((step) => (
        <li key={step.key}>
          <div className="flex items-start gap-2">
            {step.status === "running" ? (
              <span className="mt-1 size-3.5 shrink-0 animate-spin rounded-full border-2 border-line border-t-pine" aria-hidden="true" />
            ) : step.status === "ok" ? (
              <span className="mt-0.5 shrink-0 text-moss" aria-hidden="true">✓</span>
            ) : (
              <span className="mt-0.5 shrink-0 text-clay" aria-hidden="true">✕</span>
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-[12px] font-medium ${step.status === "error" ? "text-clay" : ""}`}>{toolLabelFor(step.name, t)}</p>
              {step.status === "error" ? <p className="mt-0.5 text-[11px] text-clay">{tx(step.summary)}</p> : null}
              {step.status === "ok" ? <StepCard step={step} /> : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function formatMessageTime(iso: string, locale: string): string {
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

const ACTION_STYLE: Record<ProposalChange["action"], string> = {
  add: "bg-moss/15 text-moss",
  update: "bg-amber/15 text-amber",
  delete: "bg-clay/15 text-clay",
};

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
function ProposalCard({ proposal }: { proposal: Proposal }) {
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
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${ACTION_STYLE[change.action]}`}>
                      {t(`assistant.approval.${change.action}`)}
                    </span>
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

function toolLabelFor(name: string, t: (key: MessageKey) => string): string {
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