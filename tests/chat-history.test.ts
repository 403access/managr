import { describe, expect, it } from "vitest";
import { nextMessageId, readChat, writeChat, type ChatMessage } from "@/client/chat-history";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

function message(id: number, role: "user" | "assistant", content: string, steps: ChatMessage["steps"] = []): ChatMessage {
  return { id, role, content, steps };
}

describe("assistant chat history", () => {
  it("round-trips a conversation with tool steps", () => {
    const storage = memoryStorage();
    const chat = [
      message(1, "user", "Adresse von IT Works ändern"),
      message(2, "assistant", "Adresse von **IT Works** aktualisiert", [
        { key: "0", name: "save_customer", input: { id: 1 }, status: "ok", summary: "ok", data: { id: 1 } },
      ]),
    ];

    writeChat(storage, chat);

    expect(readChat(storage)).toEqual(chat);
  });

  it("returns nothing for empty, broken, or foreign storage", () => {
    const storage = memoryStorage();
    expect(readChat(storage)).toEqual([]);

    storage.setItem("managr-assistant-chat", "{not json");
    expect(readChat(storage)).toEqual([]);

    storage.setItem("managr-assistant-chat", JSON.stringify({ version: 1, messages: [{ id: 1, role: "system", content: "x", steps: [] }] }));
    expect(readChat(storage)).toEqual([]);

    storage.setItem("managr-assistant-chat", JSON.stringify({ version: 99, messages: [message(1, "user", "alt")] }));
    expect(readChat(storage)).toEqual([]);
  });

  it("drops a message with a malformed step but keeps the rest", () => {
    const storage = memoryStorage();
    storage.setItem(
      "managr-assistant-chat",
      JSON.stringify({
        version: 1,
        messages: [message(1, "user", "ok"), { id: 2, role: "assistant", content: "x", steps: [{ name: 3 }] }],
      }),
    );

    expect(readChat(storage)).toEqual([message(1, "user", "ok")]);
  });

  it("keeps only the last 40 messages", () => {
    const storage = memoryStorage();
    const chat = Array.from({ length: 45 }, (_, index) => message(index + 1, "user", `Frage ${index + 1}`));

    writeChat(storage, chat);

    expect(readChat(storage)).toHaveLength(40);
    expect(readChat(storage)[0]).toEqual(message(6, "user", "Frage 6"));
  });

  it("removes the entry when the chat is cleared", () => {
    const storage = memoryStorage();
    writeChat(storage, [message(1, "user", "Hallo")]);
    expect(storage.data.size).toBe(1);

    writeChat(storage, []);

    expect(storage.data.size).toBe(0);
  });

  it("survives a storage that refuses to write", () => {
    const storage = memoryStorage();
    const full = {
      ...storage,
      setItem: () => {
        throw new Error("quota");
      },
    };

    expect(() => writeChat(full, [message(1, "user", "Hallo")])).not.toThrow();
  });

  it("continues numbering after the restored messages", () => {
    expect(nextMessageId([])).toBe(1);
    expect(nextMessageId([message(3, "user", "a"), message(7, "assistant", "b")])).toBe(8);
  });
});