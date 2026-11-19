"use client";

import { createContext, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { nextMessageId, readChat, readDraft, writeChat, writeDraft, type ChatMessageDetails } from "@/client/chat-history";
import { mergePlan, type PlanStepView } from "@/domain/assistant-plan";
import { needsApproval } from "@/domain/assistant-writes";
import {
  MCP_SERVER,
  type Catalog,
  type Message,
  type Selection,
  type Settings,
  type StreamEvent,
  type StreamingState,
  type Proposal,
  type Step,
} from "@/client/assistant-types";
import { useI18n } from "./locale-provider";

type AssistantContextValue = {
  messages: Message[];
  streaming: StreamingState | null;
  error: string;
  settings: Settings | null;
  catalog: Catalog | null;
  selection: Selection | null;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  pending: boolean;
  send: (raw: string, retryOf?: number) => Promise<void>;
  chooseSelection: (selection: Selection) => void;
  clear: () => void;
  abort: () => void;
};

const AssistantContext = createContext<AssistantContextValue | null>(null);
/** The committed turns, apart from the stream that changes on every token. */
const MessagesContext = createContext<Message[] | null>(null);

const MODEL_STORAGE_KEY = "managr-assistant-model";
let nextId = 1;

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

/**
 * Owns the chat, the open stream, and the model choice. It sits above the app
 * routes, so a navigation does not unmount the request; only Stop, a full
 * reload, or closing the window ends it.
 */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const { t, tx } = useI18n();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [restored, setRestored] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [streaming, setStreaming] = useState<StreamingState | null>(null);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
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
    let stored = "";
    try {
      stored = readDraft(window.localStorage);
    } catch {
      // A private window may refuse storage; the draft then lasts for the session.
    }
    if (stored) setDraft((current) => current || stored);
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    try {
      writeDraft(window.localStorage, draft);
    } catch {
      // A private window may refuse storage; the draft then lasts for the session.
    }
  }, [draft, draftLoaded]);

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

  useEffect(() => () => abortRef.current?.abort(), []);

  function chooseSelection(next: Selection) {
    setSelection(next);
    storeSelection(next);
  }

  function clear() {
    setMessages([]);
    setError("");
  }

  function abort() {
    abortRef.current?.abort();
  }

  async function send(raw: string, retryOf?: number) {
    if (pending) return;
    const content = raw.trim();
    if (!retryOf && !content) return;
    const startedAt = Date.now();
    const nowIso = new Date(startedAt).toISOString();
    const promptModel = selection
      ? (catalog?.models.find((model) => model.providerID === selection.providerID && model.modelID === selection.modelID) ?? null)
      : null;
    let history: Message[];
    let retryBackup: Message[] | null = null;
    if (retryOf !== undefined) {
      // Regenerate the last user turn in place: the message stays, the old
      // answer is replaced, and the retry is noted in its details.
      const lastUser = [...messages].reverse().find((message) => message.role === "user");
      if (!lastUser || lastUser.id !== retryOf) return;
      const index = messages.findIndex((message) => message.id === retryOf);
      if (index < 0) return;
      const target = messages[index];
      retryBackup = messages.slice(index + 1);
      const details: ChatMessageDetails = {
        ...(target.details ?? { at: nowIso }),
        at: target.details?.at ?? nowIso,
        retries: (target.details?.retries ?? 0) + 1,
        lastRetryAt: nowIso,
      };
      history = [...messages.slice(0, index), { ...target, details }];
      setMessages(history);
    } else {
      const question: Message = {
        id: nextId++,
        role: "user",
        content,
        steps: [],
        details: {
          at: nowIso,
          model: promptModel?.name ?? (settings?.model || undefined),
          provider: promptModel?.providerName,
          local: promptModel?.local ?? settings?.local,
          mcpServer: MCP_SERVER,
        },
      };
      history = [...messages, question];
      setMessages(history);
      setDraft("");
    }
    setError("");
    let answer = "";
    let steps: Step[] = [];
    let stepSeq = 0;
    let errorText = "";
    let modelInfo: { name: string; providerID?: string; modelID?: string; baseUrl: string; local: boolean } | null = null;
    let proposal: Proposal | null = null;
    let plan: PlanStepView[] = [];
    setStreaming({ content: "", steps: [] });
    const sync = () =>
      setStreaming({
        content: answer,
        steps,
        ...(proposal ? { proposal } : {}),
        ...(plan.length > 0 ? { plan } : {}),
      });
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
              if (event.ok && needsApproval(event.name)) {
                void queryClient.invalidateQueries({ queryKey: ["view"] });
              }
            } else if (event.type === "reply") {
              answer = event.text;
              sawReply = true;
              sync();
            } else if (event.type === "proposal") {
              proposal = { id: event.id, changes: event.changes };
              sync();
            } else if (event.type === "plan") {
              plan = mergePlan(plan, event.steps);
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
        setMessages((current) => [
          ...current,
          { id: nextId++, role: "assistant", content: answer, steps, details, ...(plan.length > 0 ? { plan } : {}) },
        ]);
      } else if (retryBackup && retryBackup.length > 0) {
        // A retry that produced nothing puts the previous answer back.
        setMessages((current) => [...current, ...retryBackup]);
      }
      setStreaming(null);
      setError(errorText ? tx(errorText) : "");
    }
  }

  return (
    <AssistantContext.Provider
      value={{
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
      }}
    >
      <MessagesContext.Provider value={messages}>{children}</MessagesContext.Provider>
    </AssistantContext.Provider>
  );
}

export function useAssistant(): AssistantContextValue {
  const value = useContext(AssistantContext);
  if (!value) throw new Error("AssistantProvider is missing.");
  return value;
}

/** Messages only, so a page beside the chat does not re-render on every token. */
export function useAssistantMessages(): Message[] {
  const value = useContext(MessagesContext);
  if (!value) throw new Error("AssistantProvider is missing.");
  return value;
}