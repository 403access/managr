"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useI18n } from "./locale-provider";
import { buttonClass, inputClass } from "./ui";

type Trace = { name: string; input: unknown; ok: boolean; summary: string };

type Message = { id: number; role: "user" | "assistant"; content: string; trace?: Trace[] };

type Settings = { configured: boolean; model: string; baseUrl: string; local: boolean };

let nextId = 1;

export function Assistant() {
  const { t, tx } = useI18n();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, pending, error]);

  async function send(raw: string) {
    const content = raw.trim();
    if (!content || pending) return;
    const question: Message = { id: nextId++, role: "user", content };
    const history = [...messages, question];
    setMessages(history);
    setDraft("");
    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content: text }) => ({ role, content: text })) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.notConfigured) {
          setSettings({ configured: false, model: data.model ?? "", baseUrl: data.baseUrl ?? "", local: true });
        }
        setError(typeof data.error === "string" ? data.error : t("assistant.failed"));
        return;
      }
      setMessages((current) => [
        ...current,
        { id: nextId++, role: "assistant", content: typeof data.reply === "string" ? data.reply : "", trace: Array.isArray(data.trace) ? data.trace : [] },
      ]);
      setSettings({ configured: true, model: data.model ?? "", baseUrl: data.baseUrl ?? "", local: Boolean(data.local) });
      if (Array.isArray(data.trace) && data.trace.length > 0) {
        void queryClient.invalidateQueries({ queryKey: ["view"] });
      }
    } catch {
      setError(t("assistant.failed"));
    } finally {
      setPending(false);
    }
  }

  const quickActions = [
    { key: "assistant.quickBriefing", prompt: t("assistant.promptBriefing") },
    { key: "assistant.quickInvoices", prompt: t("assistant.promptInvoices") },
    { key: "assistant.quickDeadlines", prompt: t("assistant.promptDeadlines") },
  ] as const;

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
          className="fixed inset-x-3 bottom-20 z-50 flex max-h-[72dvh] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl shadow-ink/25 md:inset-x-auto md:right-6 md:bottom-24 md:w-[26rem] md:max-h-[38rem]"
        >
          <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-lg leading-tight">{t("assistant.title")}</h2>
              <p className="mt-0.5 truncate text-xs text-muted">
                {settings?.configured
                  ? `${settings.model} · ${settings.local ? t("assistant.local") : t("assistant.remote")}`
                  : t("assistant.subtitle")}
              </p>
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
          </header>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
            {messages.length === 0 ? (
              <div className="grid gap-3">
                <p className="text-sm leading-relaxed text-muted">{t("assistant.intro")}</p>
                {settings && !settings.configured ? (
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
                    <div
                      className={`max-w-[95%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                        message.role === "user" ? "bg-pine text-paper" : "border border-line bg-white"
                      }`}
                    >
                      {message.content}
                    </div>
                    {message.trace && message.trace.length > 0 ? (
                      <details className="mt-1 rounded-lg border border-line bg-white/60 px-2 py-1">
                        <summary className="cursor-pointer text-[11px] text-muted">
                          {t("assistant.toolsUsed", { count: message.trace.length })}
                        </summary>
                        <ul className="mt-1 grid gap-0.5">
                          {message.trace.map((item, index) => (
                            <li key={`${item.name}-${index}`} className={`font-mono text-[11px] ${item.ok ? "text-muted" : "text-clay"}`}>
                              {item.ok ? "✓" : "✕"} {item.name}
                              {item.ok ? "" : ` · ${item.summary}`}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
            {pending ? <p className="mt-3 text-sm text-muted">{t("assistant.thinking")}</p> : null}
            {error ? <p className="mt-3 text-sm text-clay">{tx(error)}</p> : null}
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
              <button type="submit" className={buttonClass()} disabled={pending || !draft.trim()}>
                {t("assistant.send")}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </>
  );
}