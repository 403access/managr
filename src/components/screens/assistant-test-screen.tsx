"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatMessageDetails } from "@/client/chat-history";
import { MOCK_SESSIONS, type MockSession } from "@/client/assistant-mock-sessions";
import { applyStreamEvent, emptyReplay, streamingState, type ReplayState } from "@/client/assistant-stream";
import { MCP_SERVER } from "@/client/assistant-types";
import { AssistantStreamingTurn, AssistantTurn, protocolLabel } from "@/components/assistant";
import { useI18n } from "@/components/locale-provider";
import { buttonClass } from "@/components/ui";
import { useFollowBottom } from "@/components/use-follow-bottom";

type SpeedID = "normal" | "fast" | "instant";

const SPEEDS: { id: SpeedID; labelKey: "test.speedNormal" | "test.speedFast" | "test.speedInstant"; multiplier: number }[] = [
  { id: "normal", labelKey: "test.speedNormal", multiplier: 1 },
  { id: "fast", labelKey: "test.speedFast", multiplier: 3 },
  { id: "instant", labelKey: "test.speedInstant", multiplier: 0 },
];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A stage for canned assistant turns. It feeds the same events the server
 * streams into the same reducer the panel uses, so the preview cannot show a
 * behaviour the live chat does not have.
 */
export function AssistantTestScreen() {
  const { t, tx, locale } = useI18n();
  const [sessionID, setSessionID] = useState(MOCK_SESSIONS[0].id);
  const [speedID, setSpeedID] = useState<SpeedID>("normal");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stream, setStream] = useState<ReplayState | null>(null);
  const [playing, setPlaying] = useState(false);
  const [runError, setRunError] = useState("");
  const runRef = useRef(0);
  const speedRef = useRef<SpeedID>("normal");
  const promptRef = useRef<ChatMessage | null>(null);
  const startedRef = useRef(0);
  speedRef.current = speedID;

  const session = MOCK_SESSIONS.find((item) => item.id === sessionID) ?? MOCK_SESSIONS[0];

  /** Moves the finished turn into the transcript, details included. */
  function commit(state: ReplayState, target: MockSession) {
    const prompt = promptRef.current;
    if (!prompt) return;
    if (state.content || state.steps.length > 0) {
      const startedAt = startedRef.current;
      const details: ChatMessageDetails = {
        at: new Date().toISOString(),
        durationMs: startedAt ? Date.now() - startedAt : undefined,
        model: state.model?.model ?? target.model.name,
        provider: target.model.provider,
        protocol: state.model?.protocol ?? target.model.protocol,
        baseUrl: state.model?.baseUrl,
        local: state.model?.local,
        mcpServer: MCP_SERVER,
        toolCalls: state.steps.length,
        status: state.error ? "error" : "ok",
      };
      setMessages([
        prompt,
        {
          id: 2,
          role: "assistant",
          content: state.content,
          steps: state.steps,
          details,
          ...(state.plan.length > 0 ? { plan: state.plan } : {}),
        },
      ]);
    }
    setStream(null);
    setRunError(state.error);
  }

  async function play(target: MockSession) {
    const run = ++runRef.current;
    const multiplier = SPEEDS.find((speed) => speed.id === speedRef.current)?.multiplier ?? 1;
    const startedAt = Date.now();
    const prompt: ChatMessage = {
      id: 1,
      role: "user",
      content: target.prompt[locale],
      steps: [],
      details: {
        at: new Date(startedAt).toISOString(),
        model: target.model.name,
        provider: target.model.provider,
        protocol: target.model.protocol,
        local: target.model.local,
        mcpServer: MCP_SERVER,
        ...(target.retries ? { retries: target.retries, lastRetryAt: new Date(startedAt).toISOString() } : {}),
      },
    };
    promptRef.current = prompt;
    startedRef.current = startedAt;
    setRunError("");
    setPlaying(true);
    setMessages([prompt]);
    let state = emptyReplay();
    setStream(state);
    for (const item of target.events) {
      if (multiplier > 0) await wait(item.after / multiplier);
      if (runRef.current !== run) return;
      state = applyStreamEvent(state, item.event);
      setStream(state);
    }
    if (multiplier > 0) await wait(250);
    if (runRef.current !== run) return;
    setPlaying(false);
    // A pending confirmation keeps the live turn open, just like the panel.
    if (state.proposal) return;
    commit(state, target);
  }

  function stop() {
    runRef.current += 1;
    setPlaying(false);
  }

  /** The mock stops at the card; a decision continues with made-up results. */
  function decide(approved: string[]) {
    const run = runRef.current;
    const changes = stream?.proposal?.changes ?? [];
    setStream((current) => {
      if (!current?.proposal) return current;
      let next = current;
      for (const change of changes) {
        const ok = approved.includes(change.callId);
        const input = typeof change.input === "object" && change.input !== null ? (change.input as Record<string, unknown>) : {};
        next = applyStreamEvent(next, { type: "tool", name: change.name, input: change.input });
        next = applyStreamEvent(next, {
          type: "tool_result",
          name: change.name,
          input: change.input,
          ok,
          summary: ok ? "ok" : "The user rejected this change.",
          data: ok ? { ...input, id: typeof input.id === "number" ? input.id : 46 } : undefined,
        });
      }
      window.setTimeout(() => {
        if (runRef.current !== run) return;
        commit(next, session);
      }, 600);
      return next;
    });
    setRunError("");
  }

  useEffect(() => {
    void play(session);
    // A speed change applies to the next run, not to the one in flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionID]);

  useEffect(() => () => {
    runRef.current += 1;
  }, []);

  const listRef = useFollowBottom<HTMLDivElement>([messages, stream]);

  const protocol = protocolLabel(session.model.protocol, t);
  const calls = session.events.filter((item) => item.event.type === "tool").length;

  return (
    <main className="grid w-full gap-6 px-4 py-8 md:px-8">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl">{t("test.title")}</h1>
          <Link href="/" className="text-xs font-medium text-pine hover:underline">
            {t("test.back")}
          </Link>
        </div>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">{t("test.lede")}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <nav aria-label={t("test.sessions")} className="grid gap-2">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">{t("test.sessions")}</p>
          {MOCK_SESSIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === sessionID}
              onClick={() => setSessionID(item.id)}
              className={`rounded-xl border p-3 text-left transition ${
                item.id === sessionID ? "border-pine bg-pine/5" : "border-line bg-card hover:border-ink/30"
              }`}
            >
              <span className="block text-sm font-medium">{item.title[locale]}</span>
              <span className="mt-1 block text-[11px] leading-relaxed text-muted">{item.note[locale]}</span>
              <span className="mt-1.5 block font-mono text-[10px] text-muted">
                {t("test.calls", { count: item.events.filter((entry) => entry.event.type === "tool").length })}
              </span>
            </button>
          ))}
        </nav>

        <section className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={buttonClass()} onClick={() => void play(session)} disabled={playing}>
              {t("test.replay")}
            </button>
            <button type="button" className={buttonClass("quiet")} onClick={stop} disabled={!playing}>
              {t("test.stop")}
            </button>
            <label className="ml-auto flex items-center gap-2 text-[11px] text-muted">
              <span>{t("test.speed")}</span>
              <select
                value={speedID}
                onChange={(event) => setSpeedID(event.target.value as SpeedID)}
                className="min-h-9 rounded-xl border border-line bg-white px-2 text-xs text-ink"
              >
                {SPEEDS.map((speed) => (
                  <option key={speed.id} value={speed.id}>
                    {t(speed.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-[11px] text-muted" aria-live="polite">
              {playing ? t("test.playing") : stream?.proposal ? t("test.waiting") : t("test.done")}
            </span>
          </div>

          <section
            aria-label={t("assistant.title")}
            className="flex h-[70dvh] min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-sm md:h-[calc(100dvh-13rem)]"
          >
            <header className="border-b border-line px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg leading-tight">{t("assistant.title")}</h2>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {session.model.name} · {session.model.provider}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-pine/10 px-2 py-0.5 text-[10px] font-medium text-pine">
                  {session.model.local ? t("assistant.local") : t("assistant.remote")}
                </span>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
                <span className="rounded-full bg-amber/15 px-1.5 py-0.5 font-medium text-amber">{protocol}</span>
                <span className="truncate font-mono normal-case">{session.model.baseUrl}</span>
              </p>
            </header>

            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
              <ol className="grid gap-3">
                {messages.map((message) => (
                  <AssistantTurn
                    key={message.id}
                    message={message}
                    pending={playing}
                    lastUserMessageId={1}
                    onRetry={() => void play(session)}
                  />
                ))}
                {stream ? <AssistantStreamingTurn state={streamingState(stream)} onApprove={decide} /> : null}
              </ol>
              {runError ? <p className="mt-3 text-sm text-clay">{tx(runError)}</p> : null}
            </div>

            <footer className="border-t border-line px-3 py-3">
              <p className="rounded-xl border border-dashed border-line bg-white px-3 py-2 text-xs leading-relaxed text-muted">
                {t("test.draft")}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted">{t("assistant.footer")}</p>
                <button type="button" className={buttonClass()} disabled>
                  {t("assistant.send")}
                </button>
              </div>
            </footer>
          </section>

          <p className="text-[11px] text-muted">
            {t("test.calls", { count: calls })} · {session.title[locale]}
          </p>
        </section>
      </div>
    </main>
  );
}