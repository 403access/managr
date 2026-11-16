import { NextResponse } from "next/server";
import { z } from "zod";
import { AssistantNotConfigured, assistantSettings, streamAssistant } from "@/server/assistant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
});

/** The widget asks for the model settings without sending a message. The API key is never returned. */
export function GET() {
  const settings = assistantSettings();
  return NextResponse.json({
    configured: Boolean(settings.model),
    model: settings.model,
    baseUrl: settings.baseUrl,
    local: settings.local,
  });
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "The message could not be read." }, { status: 400 });
  }
  const settings = assistantSettings();
  if (!settings.model) {
    return NextResponse.json(
      {
        error: "No model is configured. Set MANAGR_AI_MODEL and, if needed, MANAGR_AI_BASE_URL.",
        notConfigured: true,
        baseUrl: settings.baseUrl,
        model: settings.model,
      },
      { status: 503 },
    );
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
      send({ type: "model", model: settings.model, baseUrl: settings.baseUrl, local: settings.local });
      try {
        for await (const event of streamAssistant(parsed.data.messages, request.signal)) {
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