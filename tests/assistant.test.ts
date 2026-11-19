import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import {
  AssistantModelNotFound,
  AssistantNotConfigured,
  assistantCatalog,
  assistantSettings,
  resolveAssistantSettings,
  runAssistant,
  streamAssistant,
  type AssistantEvent,
} from "@/server/assistant";

const repo = process.cwd();
let dir = "";

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-assistant-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  getDb();
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  // The suite tests the environment fallback, not whichever opencode is installed.
  vi.stubEnv("MANAGR_OPENCODE", "0");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function completion(message: unknown) {
  return new Response(JSON.stringify({ choices: [{ message }] }), { status: 200, headers: { "content-type": "application/json" } });
}

function eventStream(payload: string, slice = 17) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let index = 0; index < payload.length; index += slice) {
          controller.enqueue(encoder.encode(payload.slice(index, index + slice)));
        }
        controller.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

function chunk(delta: unknown): string {
  return `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;
}

describe("assistant settings", () => {
  it("defaults to a local Ollama endpoint and detects a remote one", () => {
    vi.stubEnv("MANAGR_AI_MODEL", "qwen2.5:14b");
    expect(assistantSettings()).toMatchObject({ model: "qwen2.5:14b", local: true, hasKey: false });
    vi.stubEnv("MANAGR_AI_BASE_URL", "https://api.example.com/v1/");
    expect(assistantSettings()).toMatchObject({ baseUrl: "https://api.example.com/v1", local: false });
  });
});

describe("assistant model choice", () => {
  it("offers the environment model when opencode is turned off", async () => {
    vi.stubEnv("MANAGR_AI_MODEL", "test-model");
    const catalog = await assistantCatalog();
    expect(catalog.providers).toEqual([{ id: "env", name: "MANAGR_AI_*" }]);
    expect(catalog.models).toEqual([
      expect.objectContaining({ providerID: "env", modelID: "test-model", name: "test-model", local: true }),
    ]);
    expect(catalog.default).toEqual({ providerID: "env", modelID: "test-model" });
  });

  it("resolves the environment provider and refuses an opencode model while discovery is off", async () => {
    vi.stubEnv("MANAGR_AI_MODEL", "test-model");
    await expect(resolveAssistantSettings({ providerID: "env", modelID: "test-model" })).resolves.toMatchObject({
      model: "test-model",
      source: "env",
      local: true,
    });
    await expect(resolveAssistantSettings({ providerID: "qwen", modelID: "qwen-max" })).rejects.toBeInstanceOf(
      AssistantModelNotFound,
    );
  });
});

describe("assistant loop", () => {
  it("refuses to answer without a configured model", async () => {
    vi.stubEnv("MANAGR_AI_MODEL", "");
    await expect(runAssistant([{ role: "user", content: "Hallo" }])).rejects.toBeInstanceOf(AssistantNotConfigured);
  });

  it("skips an empty assistant turn and keeps only the recent turns", async () => {
    vi.stubEnv("MANAGR_AI_MODEL", "test-model");
    const fetchMock = vi.fn().mockResolvedValueOnce(completion({ role: "assistant", content: "Alles klar." }));
    vi.stubGlobal("fetch", fetchMock);

    const turns = [
      ...Array.from({ length: 30 }, (_, index) => ({ role: "user" as const, content: `Frage ${index + 1}` })),
      { role: "assistant" as const, content: "   " },
    ];
    await runAssistant(turns);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages.length).toBeLessThanOrEqual(25);
    expect(body.messages.some((message: { content: string }) => message.content.trim() === "")).toBe(false);
    expect(body.messages.at(-1).content).toBe("Frage 30");
  });

  it("runs a read tool and returns the answer with a trace", async () => {
    vi.stubEnv("MANAGR_AI_MODEL", "test-model");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        completion({
          role: "assistant",
          content: "",
          tool_calls: [{ id: "call-1", type: "function", function: { name: "read_desk", arguments: "{}" } }],
        }),
      )
      .mockResolvedValueOnce(completion({ role: "assistant", content: "Die Bank steht im Briefing." }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runAssistant([{ role: "user", content: "Wie hoch ist die Bank?" }]);

    expect(result.reply).toBe("Die Bank steht im Briefing.");
    expect(result.trace).toEqual([{ name: "read_desk", input: {}, ok: true, summary: "ok" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(secondBody.messages.some((message: { role: string }) => message.role === "tool")).toBe(true);
    expect(secondBody.tools.some((tool: { function: { name: string } }) => tool.function.name === "create_invoice")).toBe(true);
  });

  it("tells the model when a tool refuses its input and keeps the error in the trace", async () => {
    vi.stubEnv("MANAGR_AI_MODEL", "test-model");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        completion({
          role: "assistant",
          content: "",
          tool_calls: [{ id: "call-2", type: "function", function: { name: "post_journal_entry", arguments: "{}" } }],
        }),
      )
      .mockResolvedValueOnce(completion({ role: "assistant", content: "Dafür fehlen die Buchungszeilen." }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runAssistant([{ role: "user", content: "Buch das mal." }]);

    expect(result.reply).toContain("Buchungszeilen");
    expect(result.trace[0].ok).toBe(false);
    expect(result.trace[0].summary).toMatch(/memo/);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const toolMessage = secondBody.messages.find((message: { role: string }) => message.role === "tool");
    expect(toolMessage.content).toContain("error");
  });

  it("surfaces a failing model endpoint", async () => {
    vi.stubEnv("MANAGR_AI_MODEL", "test-model");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 429 })));
    await expect(runAssistant([{ role: "user", content: "Hallo" }])).rejects.toThrow(/429/);
  });

  it("streams text deltas, a tool call, and the tool result in order", async () => {
    vi.stubEnv("MANAGR_AI_MODEL", "test-model");
    const first = eventStream(
      [
        chunk({ content: "Ich schaue " }),
        chunk({ tool_calls: [{ index: 0, id: "call-9", function: { name: "read_desk", arguments: "{}" } }] }),
        "data: [DONE]\n\n",
      ].join(""),
    );
    const second = eventStream([chunk({ content: "Die Bank " }), chunk({ content: "steht im Briefing." }), "data: [DONE]\n\n"].join(""));
    const fetchMock = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    vi.stubGlobal("fetch", fetchMock);

    const events: AssistantEvent[] = [];
    for await (const event of streamAssistant([{ role: "user", content: "Wie hoch ist die Bank?" }])) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual(["delta", "reset", "tool", "tool_result", "delta", "delta", "reply"]);
    expect(events[0]).toEqual({ type: "delta", text: "Ich schaue " });
    expect(events[2]).toEqual({ type: "tool", name: "read_desk", input: {} });
    expect(events[3]).toMatchObject({ type: "tool_result", name: "read_desk", ok: true });
    expect(events[6]).toEqual({ type: "reply", text: "Die Bank steht im Briefing." });

    const firstRequest = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(firstRequest.stream).toBe(true);
    expect(firstRequest.tool_choice).toBe("auto");
  });

  it("streams a write result with the data the panel renders", async () => {
    vi.stubEnv("MANAGR_AI_MODEL", "test-model");
    const { customers } = await import("@/db/schema");
    const customer = getDb().select().from(customers).get();
    expect(customer).toBeTruthy();
    const args = JSON.stringify({
      customerId: customer!.id,
      issueDate: "2026-11-10",
      lines: [{ description: "Streamed workshop", quantity: "1", unitNet: "100,00", vatBps: 1900 }],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        completion({ role: "assistant", content: "", tool_calls: [{ id: "call-w1", type: "function", function: { name: "create_invoice", arguments: args } }] }),
      )
      .mockResolvedValueOnce(completion({ role: "assistant", content: "Die Rechnung ist als Entwurf angelegt." }));
    vi.stubGlobal("fetch", fetchMock);

    const events: AssistantEvent[] = [];
    for await (const event of streamAssistant([{ role: "user", content: "Erstelle eine Rechnung über 100 Euro." }])) {
      events.push(event);
    }
    const result = events.find((event) => event.type === "tool_result");
    expect(result).toMatchObject({ type: "tool_result", name: "create_invoice", ok: true });
    const data = result && result.type === "tool_result" ? (result.data as { invoiceId: number; grossCents: number }) : null;
    expect(data?.invoiceId).toBeGreaterThan(0);
    expect(data?.grossCents).toBe(11_900);
    expect(events.some((event) => event.type === "reply" && event.text.includes("Entwurf"))).toBe(true);
  });
});