import { NextResponse } from "next/server";
import { z } from "zod";
import { AssistantNotConfigured, assistantSettings, runAssistant } from "@/server/assistant";

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
  try {
    const result = await runAssistant(parsed.data.messages);
    return NextResponse.json({
      ...result,
      model: settings.model,
      baseUrl: settings.baseUrl,
      local: settings.local,
    });
  } catch (error) {
    if (error instanceof AssistantNotConfigured) {
      return NextResponse.json({ error: error.message, notConfigured: true }, { status: 503 });
    }
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The assistant failed." },
      { status: 502 },
    );
  }
}