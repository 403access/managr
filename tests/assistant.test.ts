import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { AssistantNotConfigured, assistantSettings, runAssistant } from "@/server/assistant";

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

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function completion(message: unknown) {
  return new Response(JSON.stringify({ choices: [{ message }] }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("assistant settings", () => {
  it("defaults to a local Ollama endpoint and detects a remote one", () => {
    vi.stubEnv("MANAGR_AI_MODEL", "qwen2.5:14b");
    expect(assistantSettings()).toMatchObject({ model: "qwen2.5:14b", local: true, hasKey: false });
    vi.stubEnv("MANAGR_AI_BASE_URL", "https://api.example.com/v1/");
    expect(assistantSettings()).toMatchObject({ baseUrl: "https://api.example.com/v1", local: false });
  });
});

describe("assistant loop", () => {
  it("refuses to answer without a configured model", async () => {
    vi.stubEnv("MANAGR_AI_MODEL", "");
    await expect(runAssistant([{ role: "user", content: "Hallo" }])).rejects.toBeInstanceOf(AssistantNotConfigured);
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
});