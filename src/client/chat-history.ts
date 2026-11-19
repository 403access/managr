export type ChatStep = {
  key: string;
  name: string;
  input: unknown;
  status: "running" | "ok" | "error";
  summary: string;
  data?: unknown;
};

/** What the panel shows under a message: when it ran, on what, and with which tools. */
export type ChatMessageDetails = {
  /** ISO timestamp of the message. */
  at: string;
  /** Assistant answers only: wall time of the run. */
  durationMs?: number;
  model?: string;
  provider?: string;
  baseUrl?: string;
  local?: boolean;
  mcpServer?: string;
  toolCalls?: number;
  status?: "ok" | "error" | "stopped";
};

export type ChatMessage = { id: number; role: "user" | "assistant"; content: string; steps: ChatStep[]; details?: ChatMessageDetails };

const STORAGE_KEY = "managr-assistant-chat";
const DRAFT_KEY = "managr-assistant-draft";
const VERSION = 1;
const MAX_MESSAGES = 40;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStep(value: unknown): value is ChatStep {
  return (
    isRecord(value) &&
    typeof value.key === "string" &&
    typeof value.name === "string" &&
    (value.status === "running" || value.status === "ok" || value.status === "error") &&
    typeof value.summary === "string"
  );
}

function isDetails(value: unknown): value is ChatMessageDetails {
  if (!isRecord(value) || typeof value.at !== "string") return false;
  if (value.durationMs !== undefined && typeof value.durationMs !== "number") return false;
  if (value.model !== undefined && typeof value.model !== "string") return false;
  if (value.provider !== undefined && typeof value.provider !== "string") return false;
  if (value.baseUrl !== undefined && typeof value.baseUrl !== "string") return false;
  if (value.local !== undefined && typeof value.local !== "boolean") return false;
  if (value.mcpServer !== undefined && typeof value.mcpServer !== "string") return false;
  if (value.toolCalls !== undefined && typeof value.toolCalls !== "number") return false;
  if (value.status !== undefined && value.status !== "ok" && value.status !== "error" && value.status !== "stopped") return false;
  return true;
}

function isMessage(value: unknown): value is ChatMessage {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    Number.isFinite(value.id) &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string" &&
    Array.isArray(value.steps) &&
    value.steps.every(isStep) &&
    (value.details === undefined || isDetails(value.details))
  );
}

/** The last messages of a saved conversation, or an empty list. */
export function readChat(storage: StorageLike): ChatMessage[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    const list = isRecord(parsed) && parsed.version === VERSION ? parsed.messages : parsed;
    if (!Array.isArray(list)) return [];
    // A half-written or hand-edited entry drops out instead of breaking the panel.
    return list.filter(isMessage).slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

/** Keeps the conversation across a reload; an empty chat removes the entry. */
export function writeChat(storage: StorageLike, messages: ChatMessage[]): void {
  try {
    if (messages.length === 0) {
      storage.removeItem(STORAGE_KEY);
      return;
    }
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, messages: messages.slice(-MAX_MESSAGES) }));
  } catch {
    // A full quota or a private window must not break the panel.
  }
}

/** The id to use for the next message after restoring a conversation. */
export function nextMessageId(messages: ChatMessage[]): number {
  return messages.reduce((highest, message) => Math.max(highest, message.id), 0) + 1;
}

/** An unsent draft survives a reload; an empty draft removes the entry. */
export function readDraft(storage: Pick<Storage, "getItem">): string {
  try {
    return storage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeDraft(storage: StorageLike, draft: string): void {
  try {
    if (!draft) {
      storage.removeItem(DRAFT_KEY);
      return;
    }
    storage.setItem(DRAFT_KEY, draft);
  } catch {
    // A full quota or a private window must not break the input.
  }
}