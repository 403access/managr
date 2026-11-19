import { describe, expect, it } from "vitest";
import { nextMessageId, readChat, readDraft, writeChat, writeDraft, type ChatMessage } from "@/client/chat-history";

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

  it("keeps the details of a prompt and an answer", () => {
    const storage = memoryStorage();
    const chat: ChatMessage[] = [
      {
        ...message(1, "user", "Zeiten für IT Works"),
        details: {
          at: "2026-11-19T08:30:00.000Z",
          model: "Qwen Max",
          provider: "Qwen Cloud",
          local: false,
          mcpServer: "managr-mcp",
          retries: 2,
          lastRetryAt: "2026-11-19T08:35:00.000Z",
        },
      },
      {
        ...message(2, "assistant", "Drei Zeiten gebucht."),
        details: {
          at: "2026-11-19T08:30:04.200Z",
          durationMs: 4200,
          model: "Qwen Max",
          provider: "Qwen Cloud",
          baseUrl: "https://token-plan.example/v1",
          local: false,
          mcpServer: "managr-mcp",
          toolCalls: 3,
          status: "ok",
        },
      },
    ];

    writeChat(storage, chat);

    expect(readChat(storage)).toEqual(chat);
  });

  it("keeps a message without details and drops one with broken details", () => {
    const storage = memoryStorage();
    storage.setItem(
      "managr-assistant-chat",
      JSON.stringify({
        version: 1,
        messages: [
          message(1, "user", "alt"),
          { ...message(2, "assistant", "kaputt"), details: { at: 3, status: "vielleicht" } },
        ],
      }),
    );

    expect(readChat(storage)).toEqual([message(1, "user", "alt")]);
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

describe("assistant draft", () => {
  it("round-trips an unsent draft and removes it when cleared", () => {
    const storage = memoryStorage();

    writeDraft(storage, "Trage die letzten beiden Zeiten auf das Projekt Arbeitsmittel Setup um.");
    expect(readDraft(storage)).toBe("Trage die letzten beiden Zeiten auf das Projekt Arbeitsmittel Setup um.");

    writeDraft(storage, "");
    expect(readDraft(storage)).toBe("");
    expect(storage.data.size).toBe(0);
  });

  it("keeps the plan of an assistant answer", () => {
    const storage = memoryStorage();
    const chat: ChatMessage[] = [
      {
        ...message(1, "assistant", "Erledigt."),
        plan: [
          { id: "1", title: "Zeiten lesen", status: "done" },
          { id: "2", title: "Rechnung prüfen", status: "pending", change: "added", note: "Nach der Antwort ergänzt" },
        ],
      },
    ];

    writeChat(storage, chat);

    expect(readChat(storage)).toEqual(chat);
  });

  it("drops an assistant message with a malformed plan", () => {
    const storage = memoryStorage();
    storage.setItem(
      "managr-assistant-chat",
      JSON.stringify({
        version: 1,
        messages: [{ ...message(1, "assistant", "x"), plan: [{ id: 1, title: "x", status: "unbekannt" }] }],
      }),
    );

    expect(readChat(storage)).toEqual([]);
  });

  it("returns nothing when storage is missing or broken", () => {
    const storage = memoryStorage();
    expect(readDraft(storage)).toBe("");

    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(readDraft(broken)).toBe("");
    expect(() => writeDraft(broken, "Hallo")).not.toThrow();
  });
});