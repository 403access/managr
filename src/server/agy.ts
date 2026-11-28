import "server-only";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { PlanStep } from "@/domain/assistant-plan";
import { changeAction, type ApprovalGate, type ProposedChange } from "./approvals";
import type { AssistantEvent, AssistantTurn } from "./assistant";
import { changeLabels } from "./change-labels";
import type { AssistantCatalog, AssistantSelection } from "./opencode";
import { enabledTools, needsApproval, runTool, type ToolResult } from "./tools";

const run = promisify(execFile);

export const AGY_PROVIDER_ID = "agy";
export const AGY_PROVIDER_NAME = "Antigravity (agy)";
const AGY_MCP_SERVER_NAME = "managr-desk";
const MAX_AGY_MESSAGES = 24;
const SUCCESS_TTL = 60_000;
const FAILURE_TTL = 10_000;
const MCP_TIMEOUT_SECONDS = 600;

export type AgyModel = {
  modelID: string;
  name: string;
};

export type AgySnapshot = {
  at: number;
  available: boolean;
  error?: string;
  binary?: string;
  models: AgyModel[];
  catalog: AssistantCatalog;
};

export type AgyStreamEvent =
  | { kind: "delta"; text: string }
  | { kind: "tool_start"; name: string }
  | { kind: "result"; status: string; response: string; error?: string };

let snapshot: AgySnapshot | null = null;
let inflight: Promise<AgySnapshot> | null = null;

export function agyEnabled(): boolean {
  const flag = process.env.MANAGR_AGY?.trim().toLowerCase();
  return flag !== "0" && flag !== "off" && flag !== "false";
}

function explicitAgyBinary(): string | null {
  return process.env.MANAGR_AGY_BIN?.trim() || null;
}

function candidateBinaries(): string[] {
  const explicit = explicitAgyBinary();
  if (explicit) return [explicit];
  const localBin = path.join(os.homedir(), ".local", "bin", "agy");
  return fs.existsSync(localBin) ? ["agy", localBin] : ["agy"];
}

/** Parse `agy models` output, ignoring ANSI escapes and status lines. */
export function parseAgyModels(stdout: string): AgyModel[] {
  const clean = stdout.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, "");
  const models: AgyModel[] = [];
  const seen = new Set<string>();
  for (const rawLine of clean.split(/[\r\n]+/)) {
    // The CLI prints a "Fetching available models..." status line before the table.
    const line = rawLine.trim();
    if (!line || /^fetching\b/i.test(line)) continue;
    // Columns are tab separated today; accept runs of spaces as well. A single
    // space stays prose, so a status line is not mistaken for a model.
    const match = /^([A-Za-z0-9][A-Za-z0-9._:/-]*)(?:\t+|\s{2,})(.+)$/.exec(line);
    if (!match) continue;
    const modelID = match[1].trim();
    const name = match[2].trim();
    if (!modelID || !name || seen.has(modelID)) continue;
    seen.add(modelID);
    models.push({ modelID, name });
  }
  return models;
}

export function buildAgyCatalog(models: AgyModel[]): AssistantCatalog {
  if (models.length === 0) {
    return {
      available: false,
      error: "agy returned no models.",
      providers: [],
      models: [],
      default: null,
    };
  }
  return {
    available: true,
    providers: [
      {
        id: AGY_PROVIDER_ID,
        name: AGY_PROVIDER_NAME,
        protocol: "agy",
        local: false,
        modelCount: models.length,
      },
    ],
    models: models.map((model) => ({
      id: `${AGY_PROVIDER_ID}/${model.modelID}`,
      providerID: AGY_PROVIDER_ID,
      modelID: model.modelID,
      name: model.name,
      providerName: AGY_PROVIDER_NAME,
      protocol: "agy",
      local: false,
    })),
    default: { providerID: AGY_PROVIDER_ID, modelID: models[0].modelID },
  };
}

export function resolveAgyModel(models: AgyModel[], selection: AssistantSelection): AgyModel | null {
  if (selection.providerID !== AGY_PROVIDER_ID) return null;
  return models.find((candidate) => candidate.modelID === selection.modelID) ?? null;
}

function failure(error: unknown): AgySnapshot {
  const message = error instanceof Error ? error.message.split("\n")[0].slice(0, 200) : "agy could not be read.";
  return {
    at: Date.now(),
    available: false,
    error: message,
    models: [],
    catalog: { available: false, error: message, providers: [], models: [], default: null },
  };
}

async function readAgy(): Promise<AgySnapshot> {
  if (!agyEnabled()) return failure(new Error("agy discovery is turned off. Set MANAGR_AGY=1 to use it."));
  let lastError: unknown;
  for (const binary of candidateBinaries()) {
    try {
      const { stdout } = await run(binary, ["models"], {
        timeout: 15_000,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      });
      const models = parseAgyModels(stdout);
      const catalog = buildAgyCatalog(models);
      if (!catalog.available) return failure(new Error(catalog.error ?? "agy returned no models."));
      return {
        at: Date.now(),
        available: true,
        binary,
        models,
        catalog,
      };
    } catch (error) {
      lastError = error;
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === "ENOENT") continue;
      break;
    }
  }
  return failure(lastError);
}

export async function agySnapshot(): Promise<AgySnapshot> {
  const age = snapshot ? Date.now() - snapshot.at : Number.POSITIVE_INFINITY;
  if (snapshot && age < (snapshot.available ? SUCCESS_TTL : FAILURE_TTL)) return snapshot;
  if (inflight) return inflight;
  inflight = readAgy()
    .then((next) => {
      snapshot = next;
      return next;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function clearAgySnapshotCache(): void {
  snapshot = null;
}

/** Build the single-turn prompt sent to `agy` over stdin stream-json. */
export function buildAgyPrompt(system: string, turns: AssistantTurn[]): string {
  const recent = turns.slice(-MAX_AGY_MESSAGES).filter((turn) => turn.role === "user" || turn.content.trim().length > 0);
  const prior = recent.slice(0, -1);
  const latest = recent.at(-1);
  const parts = [
    system,
    "",
    "Tool environment:",
    `- All managr desk tools are available on the MCP server "${AGY_MCP_SERVER_NAME}".`,
    `- Use ONLY the tools on "${AGY_MCP_SERVER_NAME}" (including update_plan, read_*, write tools, web_*, read_guides, read_sources). Never use filesystem, shell, or browser tools.`,
  ];
  if (prior.length > 0) {
    parts.push("", "Conversation so far:");
    for (const turn of prior) {
      parts.push(`${turn.role === "user" ? "User" : "Assistant"}: ${turn.content}`);
    }
  }
  if (latest) {
    parts.push("", `User request:\n${latest.content}`);
  }
  return parts.join("\n");
}

/** Parse one NDJSON line emitted by `agy --output-format stream-json`. */
export function parseAgyStreamLine(line: string): AgyStreamEvent | null {
  if (!line.trim()) return null;
  let parsed: {
    event?: string;
    step_update?: {
      step_type?: string;
      tool_name?: string;
      text_delta?: string;
      state?: string;
    };
    result?: {
      status?: string;
      response?: string;
      error?: string;
    };
  };
  try {
    parsed = JSON.parse(line);
  } catch {
    return null;
  }
  if (parsed.event === "step_update" && parsed.step_update) {
    const step = parsed.step_update;
    if (step.step_type === "agent_response" && typeof step.text_delta === "string" && step.text_delta.length > 0) {
      return { kind: "delta", text: step.text_delta };
    }
    if (step.step_type === "tool" && step.state === "ACTIVE" && step.tool_name) {
      return { kind: "tool_start", name: step.tool_name };
    }
    return null;
  }
  if (parsed.event === "result" && parsed.result) {
    return {
      kind: "result",
      status: parsed.result.status ?? "",
      response: parsed.result.response ?? "",
      error: parsed.result.error,
    };
  }
  return null;
}

class AsyncQueue<T> {
  private items: T[] = [];
  private waiters: ((result: IteratorResult<T>) => void)[] = [];
  private ended = false;
  private failure: unknown = null;

  push(item: T): void {
    if (this.ended) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter({ value: item, done: false });
    else this.items.push(item);
  }

  finish(): void {
    if (this.ended) return;
    this.ended = true;
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift()!;
      waiter({ value: undefined as T, done: true });
    }
  }

  fail(error: unknown): void {
    if (this.ended) return;
    this.failure = error;
    this.finish();
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    for (;;) {
      if (this.items.length > 0) {
        yield this.items.shift()!;
        continue;
      }
      if (this.ended) {
        if (this.failure !== null) throw this.failure;
        return;
      }
      const next = await new Promise<IteratorResult<T>>((resolve) => {
        this.waiters.push(resolve);
      });
      if (next.done) {
        if (this.failure !== null) throw this.failure;
        return;
      }
      yield next.value;
    }
  }
}

function readHttpBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function buildMcpServer(options: {
  gate?: ApprovalGate;
  emit: (event: AssistantEvent) => void;
  resetIfStreamed: () => void;
  toolContent: (result: ToolResult) => string;
  uiData: (result: ToolResult) => unknown;
}): McpServer {
  const { gate, emit, resetIfStreamed, toolContent, uiData } = options;
  const server = new McpServer({ name: AGY_MCP_SERVER_NAME, version: "1.0.0" }, { capabilities: { tools: {} } });
  // Serialize write confirmations so concurrent tool calls do not overwrite an
  // open proposal card in the assistant panel.
  let writeChain = Promise.resolve();
  const serializeWrite = <T>(work: () => Promise<T>): Promise<T> => {
    const next = writeChain.then(work, work);
    writeChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  for (const deskTool of enabledTools()) {
    server.registerTool(
      deskTool.name,
      { description: deskTool.description, inputSchema: deskTool.schema.shape },
      async (rawInput) => {
        const input = rawInput ?? {};
        if (deskTool.name === "update_plan") {
          const result = await runTool(deskTool.name, input);
          if (result.ok) {
            emit({ type: "plan", steps: (result.data as { steps: PlanStep[] }).steps });
          }
          return {
            isError: !result.ok,
            content: [{ type: "text", text: toolContent(result) }],
          };
        }

        const isWrite = needsApproval(deskTool.name) && deskTool.schema.safeParse(input).success;
        if (!isWrite) {
          resetIfStreamed();
          emit({ type: "tool", name: deskTool.name, input });
          const result = await runTool(deskTool.name, input);
          const summary = result.ok ? "ok" : result.error;
          emit({ type: "tool_result", name: deskTool.name, input, ok: result.ok, summary, data: uiData(result) });
          return {
            isError: !result.ok,
            content: [{ type: "text", text: toolContent(result) }],
          };
        }

        return serializeWrite(async () => {
          resetIfStreamed();
          if (gate) {
            const callId = randomUUID();
            const change: ProposedChange = {
              callId,
              name: deskTool.name,
              action: changeAction(deskTool.name, input),
              input,
              labels: changeLabels(deskTool.name, input),
            };
            const approval = gate.open([change]);
            emit({ type: "proposal", id: approval.id, changes: [change] });
            const approved = await approval.decision;
            if (!approved.has(callId)) {
              const summary = "The user rejected this change.";
              emit({ type: "tool", name: deskTool.name, input });
              emit({ type: "tool_result", name: deskTool.name, input, ok: false, summary });
              return {
                isError: true,
                content: [{ type: "text", text: JSON.stringify({ rejected: true, error: summary }) }],
              };
            }
          }

          emit({ type: "tool", name: deskTool.name, input });
          const result = await runTool(deskTool.name, input);
          const summary = result.ok ? "ok" : result.error;
          emit({ type: "tool_result", name: deskTool.name, input, ok: result.ok, summary, data: uiData(result) });
          return {
            isError: !result.ok,
            content: [{ type: "text", text: toolContent(result) }],
          };
        });
      },
    );
  }
  return server;
}

export async function* streamAgyAssistant(options: {
  modelID: string;
  system: string;
  turns: AssistantTurn[];
  signal?: AbortSignal;
  gate?: ApprovalGate;
  binary?: string;
  toolContent: (result: ToolResult) => string;
  uiData: (result: ToolResult) => unknown;
}): AsyncGenerator<AssistantEvent> {
  const { modelID, system, turns, signal, gate, binary, toolContent, uiData } = options;
  const queue = new AsyncQueue<AssistantEvent>();
  let streamed = false;
  const resetIfStreamed = () => {
    if (!streamed) return;
    streamed = false;
    queue.push({ type: "reset" });
  };

  const authToken = randomBytes(24).toString("hex");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-agy-"));
  let server: http.Server | null = null;
  let child: ChildProcess | null = null;
  let killTimer: ReturnType<typeof setTimeout> | undefined;

  const cleanup = () => {
    if (killTimer) clearTimeout(killTimer);
    signal?.removeEventListener("abort", onAbort);
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      const target = child;
      killTimer = setTimeout(() => {
        if (target.exitCode === null && target.signalCode === null) target.kill("SIGKILL");
      }, 2000);
    }
    if (server) {
      server.closeAllConnections?.();
      server.close();
      server = null;
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup of the ephemeral workspace.
    }
  };

  const onAbort = () => {
    queue.finish();
    cleanup();
  };

  try {
    if (signal?.aborted) return;
    signal?.addEventListener("abort", onAbort, { once: true });

    server = http.createServer(async (req, res) => {
      if (req.url !== "/mcp" || req.method !== "POST") {
        res.statusCode = 405;
        res.setHeader("Allow", "POST");
        res.end();
        return;
      }
      if (req.headers.authorization !== `Bearer ${authToken}`) {
        res.statusCode = 401;
        res.end();
        return;
      }
      try {
        const body = await readHttpBody(req);
        const mcpServer = buildMcpServer({
          gate,
          emit: (event) => queue.push(event),
          resetIfStreamed,
          toolContent,
          uiData,
        });
        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });
        await mcpServer.connect(transport);
        const webReq = new Request("http://127.0.0.1/mcp", {
          method: "POST",
          headers: {
            "content-type": req.headers["content-type"] || "application/json",
            accept: req.headers.accept || "application/json, text/event-stream",
          },
          body: new Uint8Array(body),
        });
        const webRes = await transport.handleRequest(webReq);
        res.statusCode = webRes.status;
        webRes.headers.forEach((value, key) => res.setHeader(key, value));
        res.end(Buffer.from(await webRes.arrayBuffer()));
      } catch (error) {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end(error instanceof Error ? error.message : "MCP error");
        }
      }
    });

    const port = await new Promise<number>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(0, "127.0.0.1", () => {
        const address = server!.address();
        if (address && typeof address === "object") resolve(address.port);
        else reject(new Error("Could not bind local MCP bridge."));
      });
    });

    fs.mkdirSync(path.join(tempDir, ".agents"), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, ".agents", "mcp_config.json"),
      JSON.stringify({
        mcpServers: {
          [AGY_MCP_SERVER_NAME]: {
            serverUrl: `http://127.0.0.1:${port}/mcp`,
            headers: { Authorization: `Bearer ${authToken}` },
            timeoutSeconds: MCP_TIMEOUT_SECONDS,
          },
        },
      }),
    );

    const mcpDir = path.join(os.homedir(), ".gemini", "antigravity-cli", "mcp");
    const settings = JSON.stringify({
      agentMode: "",
      toolPermission: "request-review",
      allowNonWorkspaceAccess: false,
      disableSlashCommands: true,
      permissions: {
        allow: [`mcp(${AGY_MCP_SERVER_NAME}/*)`, `read_file(${mcpDir})`],
        deny: ["command(*)", "write_file(*)", "read_url(*)", "execute_url(*)", "download_url(*)"],
      },
    });

    const bin = binary || candidateBinaries()[0];
    child = spawn(
      bin,
      [
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--model",
        modelID,
        "--disable-slash-commands",
        "--settings",
        settings,
      ],
      {
        cwd: tempDir,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    // A fast exit closes stdin before the prompt is written; the close handler
    // reports the real error, so an EPIPE here must not crash the server.
    child.stdin?.on("error", () => undefined);

    let sawResult = false;
    let stdoutBuffer = "";
    let stderrText = "";

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      if (stderrText.length < 2000) stderrText += chunk;
    });

    const handleLine = (line: string) => {
      const parsed = parseAgyStreamLine(line);
      if (!parsed) return;
      if (parsed.kind === "delta") {
        streamed = true;
        queue.push({ type: "delta", text: parsed.text });
      } else if (parsed.kind === "tool_start" && parsed.name === "call_mcp_tool") {
        resetIfStreamed();
      } else if (parsed.kind === "result") {
        sawResult = true;
        if (parsed.status !== "SUCCESS") {
          queue.fail(new Error(parsed.error?.trim() || "The assistant failed."));
        } else {
          const reply = parsed.response.trim();
          if (!reply) queue.fail(new Error("The model returned no message."));
          else {
            queue.push({ type: "reply", text: reply });
            queue.finish();
          }
        }
      }
    };

    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdoutBuffer += chunk;
      let newline = stdoutBuffer.indexOf("\n");
      while (newline !== -1) {
        const line = stdoutBuffer.slice(0, newline).trim();
        stdoutBuffer = stdoutBuffer.slice(newline + 1);
        newline = stdoutBuffer.indexOf("\n");
        handleLine(line);
      }
    });

    child.on("error", (error) => {
      if (!signal?.aborted) queue.fail(error);
    });

    child.on("close", (code) => {
      if (signal?.aborted) {
        queue.finish();
        return;
      }
      if (stdoutBuffer.trim()) {
        handleLine(stdoutBuffer.trim());
        stdoutBuffer = "";
      }
      if (!sawResult) {
        const detail = stderrText.trim().split("\n").find((line) => line.trim())?.slice(0, 300);
        queue.fail(new Error(detail || (code ? `agy exited with code ${code}.` : "The model returned no message.")));
      } else {
        queue.finish();
      }
    });

    const prompt = buildAgyPrompt(system, turns);
    child.stdin?.write(`${JSON.stringify({ event: "user", message: { content: prompt } })}\n`);
    child.stdin?.end();

    for await (const event of queue) {
      yield event;
    }
  } finally {
    cleanup();
  }
}
