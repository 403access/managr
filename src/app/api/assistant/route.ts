import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AssistantModelNotFound,
  AssistantNotConfigured,
  assistantSettings,
  resolveAssistantSettings,
  streamAssistant,
  type ResolvedAssistantSettings,
} from "@/server/assistant";
import { webEnabled } from "@/server/web";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const messageSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), content: z.string().trim().min(1).max(8000) }),
  // An assistant turn can be empty when a run stopped after a tool call, and a
  // long answer can exceed the user limit. Both are history, not new input.
  z.object({ role: z.literal("assistant"), content: z.string().max(32_000) }),
]);

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(200),
  selection: z
    .object({
      providerID: z.string().trim().min(1).max(200),
      modelID: z.string().trim().min(1).max(300),
    })
    .optional(),
});

/** The widget asks for the model settings without sending a message. The API key is never returned. */
export function GET() {
  const settings = assistantSettings();
  return NextResponse.json({
    configured: Boolean(settings.model),
    model: settings.model,
    baseUrl: settings.baseUrl,
    local: settings.local,
    web: webEnabled(),
  });
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    // A rejected body must be diagnosable from the server log; the panel only
    // shows the translated one-liner.
    console.warn(
      "assistant request rejected:",
      parsed.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; "),
    );
    return NextResponse.json({ error: "The message could not be read." }, { status: 400 });
  }
  let settings: ResolvedAssistantSettings;
  try {
    settings = await resolveAssistantSettings(parsed.data.selection);
  } catch (error) {
    if (error instanceof AssistantNotConfigured) {
      const env = assistantSettings();
      return NextResponse.json(
        { error: error.message, notConfigured: true, baseUrl: env.baseUrl, model: env.model },
        { status: 503 },
      );
    }
    if (error instanceof AssistantModelNotFound) {
      return NextResponse.json({ error: error.message, notConfigured: false }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "The assistant failed.", notConfigured: false }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The client went away; the loop stops when the request signal aborts.
        }
      };
      send({
        type: "model",
        model: settings.displayName,
        baseUrl: settings.baseUrl,
        local: settings.local,
        providerID: settings.providerID,
        modelID: settings.modelID,
      });
      try {
        for await (const event of streamAssistant(parsed.data.messages, request.signal, settings)) {
          send(event);
        }
      } catch (error) {
        if (!request.signal.aborted) {
          console.error(error);
          send({
            type: "error",
            message: error instanceof AssistantNotConfigured || error instanceof Error ? error.message : "The assistant failed.",
          });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by the runtime.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}