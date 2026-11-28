import { describe, expect, it } from "vitest";
import { buildAgyCatalog, buildAgyPrompt, parseAgyModels, parseAgyStreamLine } from "@/server/agy";

describe("agy models", () => {
  it("reads the tab-separated table and skips the status line", () => {
    const stdout = [
      "Fetching available models...",
      "gemini-4-hydrogen-high\tGemini 4 Hydrogen (High)",
      "claude-sonnet-4-6\tClaude Sonnet 4.6 (Thinking)",
      "",
    ].join("\n");
    expect(parseAgyModels(stdout)).toEqual([
      { modelID: "gemini-4-hydrogen-high", name: "Gemini 4 Hydrogen (High)" },
      { modelID: "claude-sonnet-4-6", name: "Claude Sonnet 4.6 (Thinking)" },
    ]);
  });

  it("accepts space-separated columns and strips ANSI escapes", () => {
    const stdout = "\u001b[32mFetching models...\u001b[0m\ngpt-5   GPT 5\ngpt-5\tGPT 5 duplicate\n";
    expect(parseAgyModels(stdout)).toEqual([{ modelID: "gpt-5", name: "GPT 5" }]);
  });

  it("does not read a one-space status line as a model", () => {
    expect(parseAgyModels("Working on it\n")).toEqual([]);
  });

  it("builds a catalog under its own provider id", () => {
    const catalog = buildAgyCatalog([{ modelID: "gemini-4-hydrogen-high", name: "Gemini 4 Hydrogen (High)" }]);
    expect(catalog.providers).toEqual([
      { id: "agy", name: "Antigravity (agy)", protocol: "agy", local: false, modelCount: 1 },
    ]);
    expect(catalog.models[0]).toMatchObject({ id: "agy/gemini-4-hydrogen-high", providerID: "agy", protocol: "agy" });
    expect(catalog.default).toEqual({ providerID: "agy", modelID: "gemini-4-hydrogen-high" });
  });
});

describe("agy stream", () => {
  it("reads deltas, MCP tool starts, and the final result", () => {
    expect(parseAgyStreamLine('{"event":"step_update","step_update":{"step_type":"agent_response","state":"ACTIVE","text_delta":"Hi"}}')).toEqual({
      kind: "delta",
      text: "Hi",
    });
    expect(
      parseAgyStreamLine(
        '{"event":"step_update","step_update":{"step_type":"tool","state":"ACTIVE","tool_name":"call_mcp_tool"}}',
      ),
    ).toEqual({ kind: "tool_start", name: "call_mcp_tool" });
    expect(
      parseAgyStreamLine('{"event":"result","result":{"status":"SUCCESS","response":"Done"}}'),
    ).toEqual({ kind: "result", status: "SUCCESS", response: "Done", error: undefined });
    expect(parseAgyStreamLine("not json")).toBeNull();
  });
});

describe("agy prompt", () => {
  it("keeps the system prompt, history, and latest request in one turn", () => {
    const prompt = buildAgyPrompt("System.", [
      { role: "user", content: "First" },
      { role: "assistant", content: "Answer" },
      { role: "assistant", content: "   " },
      { role: "user", content: "Second" },
    ]);
    expect(prompt).toContain("System.");
    expect(prompt).toContain("User: First");
    expect(prompt).toContain("Assistant: Answer");
    expect(prompt).toContain("User request:\nSecond");
    expect(prompt).not.toContain("User request:\nFirst");
  });
});
