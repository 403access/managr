"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDate } from "@/domain/calendar";
import { formatEuro } from "@/domain/money";
import { queryKeys, viewPath } from "@/client/query-keys";
import type { MessageKey } from "@/i18n";
import { Combobox } from "./combobox";
import { useI18n } from "./locale-provider";
import { buttonClass, inputClass, Pill } from "./ui";

type Step = {
  key: string;
  name: string;
  input: unknown;
  status: "running" | "ok" | "error";
  summary: string;
  data?: unknown;
};

type Message = { id: number; role: "user" | "assistant"; content: string; steps: Step[] };

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
  | { type: "reply"; text: string }
  | { type: "error"; message: string };

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

export function Assistant() {
  const { t, tx, label } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState<{ content: string; steps: Step[] } | null>(null);
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
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

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
    const question: Message = { id: nextId++, role: "user", content, steps: [] };
    const history = [...messages, question];
    setMessages(history);
    setDraft("");
    setError("");
    let answer = "";
    let steps: Step[] = [];
    let stepSeq = 0;
    let errorText = "";
    setStreaming({ content: "", steps: [] });
    const sync = () => setStreaming({ content: answer, steps });
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content: text }) => ({ role, content: text })),
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
            if (event.type === "model") {
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
        setMessages((current) => [...current, { id: nextId++, role: "assistant", content: answer, steps }]);
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
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? t("assistant.close") : t("assistant.open")}
        className="fixed right-3 bottom-20 z-30 inline-flex min-h-12 items-center gap-2 rounded-full border border-pine-deep bg-pine px-4 text-sm font-medium text-paper shadow-lg shadow-ink/20 md:right-6 md:bottom-6"
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
          <path d="M4 12a8 8 0 0 1 8-8h1a7 7 0 0 1 0 14H9l-4 3v-4.5A8 8 0 0 1 4 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
        <span className="hidden md:inline">{t("assistant.open")}</span>
      </button>

      {open ? (
        <section
          aria-label={t("assistant.title")}
          className="fixed inset-x-3 bottom-20 z-50 flex max-h-[78dvh] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl shadow-ink/25 md:inset-x-auto md:right-6 md:bottom-24 md:w-[27rem] md:max-h-[42rem]"
        >
          <header className="border-b border-line px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg leading-tight">{t("assistant.title")}</h2>
                <p className="mt-0.5 truncate text-xs text-muted">{modelStatus}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {messages.length > 0 ? (
                  <button type="button" className="rounded-full px-2 py-1 text-xs text-muted hover:text-ink" onClick={() => { setMessages([]); setError(""); }}>
                    {t("assistant.newChat")}
                  </button>
                ) : null}
                <button type="button" className="grid size-9 place-items-center rounded-full text-muted hover:text-ink" onClick={() => setOpen(false)} aria-label={t("assistant.close")}>
                  <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
                    <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
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
                      <div className="max-w-[95%] rounded-2xl bg-pine px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-paper">{message.content}</div>
                    ) : (
                      <div className="max-w-[95%] rounded-2xl border border-line bg-white px-3 py-2 text-sm">
                        {message.steps.length > 0 ? <Steps steps={message.steps} /> : null}
                        {message.content ? <p className="mt-2 leading-relaxed whitespace-pre-wrap">{message.content}</p> : null}
                      </div>
                    )}
                  </li>
                ))}
                {streaming ? (
                  <li>
                    <div className="max-w-[95%] rounded-2xl border border-line bg-white px-3 py-2 text-sm">
                      {streaming.steps.length > 0 ? <Steps steps={streaming.steps} /> : (
                        <p className="text-muted">{t("assistant.thinking")}</p>
                      )}
                      {streaming.content ? <p className="mt-2 leading-relaxed whitespace-pre-wrap">{streaming.content}</p> : null}
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