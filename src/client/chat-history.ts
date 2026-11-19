export type ChatStep = {
  key: string;
  name: string;
  input: unknown;
  status: "running" | "ok" | "error";
  summary: string;
  data?: unknown;
};

export type ChatMessage = { id: number; role: "user" | "assistant"; content: string; steps: ChatStep[] };

const STORAGE_KEY = "managr-assistant-chat";
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

function isMessage(value: unknown): value is ChatMessage {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    Number.isFinite(value.id) &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string" &&
    Array.isArray(value.steps) &&
    value.steps.every(isStep)
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