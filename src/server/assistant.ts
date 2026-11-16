import "server-only";
import { todayIso } from "@/domain/calendar";
import { loadCompany } from "./queries";
import { openAiTools, runTool } from "./tools";

export type AssistantSettings = {
  baseUrl: string;
  model: string;
  hasKey: boolean;
  /** A loopback endpoint keeps the conversation on this computer. */
  local: boolean;
};

export type AssistantTurn = { role: "user" | "assistant"; content: string };

export type ToolTrace = { name: string; input: unknown; ok: boolean; summary: string };

const MAX_STEPS = 8;
const MAX_TOOL_CHARS = 12_000;
const MAX_MESSAGES = 24;

/** Read the model settings on every request, so a change does not need a rebuild. */
export function assistantSettings(): AssistantSettings {
  const baseUrl = (process.env.MANAGR_AI_BASE_URL?.trim() || "http://127.0.0.1:11434/v1").replace(/\/+$/, "");
  const model = process.env.MANAGR_AI_MODEL?.trim() ?? "";
  const local = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::|\/|$)/.test(baseUrl);
  return { baseUrl, model, hasKey: Boolean(process.env.MANAGR_AI_API_KEY?.trim()), local };
}

function systemPrompt(): string {
  const company = loadCompany();
  return [
    "You are the assistant inside managr, a local desk for German companies run by one person.",
    `Today is ${todayIso()}. The active company is ${company.legalName} (id ${company.id}, legal form ${company.legalForm}).`,
    "",
    "Rules:",
    "- Use the tools for every figure, date, and status. Never invent an amount, a deadline, a tax rate, a wage-tax figure, or a social-insurance status.",
    "- Read before you write: list or get the record, then act. Ask before deleting, voiding, switching company, or recording a profit distribution.",
    "- Money inputs are euro strings such as \"1.234,56\". Dates are YYYY-MM-DD. VAT rates are basis points: 1900, 700, 0.",
    "- The books are append-only. A correction is a reversing entry, never an edit.",
    "- Nothing is sent or filed. Never claim an e-invoice, an e-mail, or a tax return was transmitted.",
    "- When a tool returns ok:false, explain the error in plain words and propose the fix. Do not repeat the same call unchanged.",
    "- After a write, name what was posted and where the user can see it.",
    "- Keep the answer short and concrete. Use the German statutory term for German institutions. Answer in the language the user writes in.",
    "",
    "The conversation is local to this desk, but the model endpoint may be remote. The user configured it.",
  ].join("\n");
}

function toolContent(result: Awaited<ReturnType<typeof runTool>>): string {
  const text = JSON.stringify(result.ok ? result.data : { error: result.error });
  if (text.length <= MAX_TOOL_CHARS) return text;
  return JSON.stringify({
    truncated: true,
    note: "The tool result was too large. Ask for a narrower range or a single record.",
    preview: text.slice(0, MAX_TOOL_CHARS),
  });
}

function parseArguments(raw: unknown): unknown {
  if (typeof raw !== "string") return raw ?? {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export class AssistantNotConfigured extends Error {}

export async function runAssistant(turns: AssistantTurn[]): Promise<{ reply: string; trace: ToolTrace[] }> {
  const settings = assistantSettings();
  if (!settings.model) {
    throw new AssistantNotConfigured("No model is configured. Set MANAGR_AI_MODEL and, if needed, MANAGR_AI_BASE_URL.");
  }
  const chat: Record<string, unknown>[] = [
    { role: "system", content: systemPrompt() },
    ...turns.slice(-MAX_MESSAGES).map((turn) => ({ role: turn.role, content: turn.content })),
  ];
  const trace: ToolTrace[] = [];

  for (let step = 0; step < MAX_STEPS; step += 1) {
    chat[0] = { role: "system", content: systemPrompt() };
    const response = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(settings.hasKey ? { authorization: `Bearer ${process.env.MANAGR_AI_API_KEY ?? ""}` } : {}),
      },
      body: JSON.stringify({
        model: settings.model,
        messages: chat,
        tools: openAiTools(),
        tool_choice: "auto",
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => "")).slice(0, 400);
      throw new Error(`The model endpoint answered ${response.status}. ${detail}`.trim());
    }
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
    };
    const message = payload.choices?.[0]?.message;
    if (!message) throw new Error("The model returned no message.");
    if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      chat.push({ role: "assistant", content: message.content ?? "", tool_calls: message.tool_calls });
      for (const call of message.tool_calls) {
        const input = parseArguments(call.function.arguments);
        const result = await runTool(call.function.name, input);
        trace.push({
          name: call.function.name,
          input,
          ok: result.ok,
          summary: result.ok ? "ok" : result.error,
        });
        chat.push({ role: "tool", tool_call_id: call.id, content: toolContent(result) });
      }
      continue;
    }
    const reply = (message.content ?? "").trim();
    if (!reply) throw new Error("The model returned no message.");
    return { reply, trace };
  }
  throw new Error("The assistant stopped after too many tool steps. Try a smaller request.");
}