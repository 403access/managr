import { NextResponse } from "next/server";
import { enabledTools, findTool, needsApproval, runTool, toolJsonSchema } from "@/server/tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * A plain JSON facade over the same tool registry the assistant and MCP use.
 *
 * The native client on the local network cannot drive Next.js server actions
 * (their ids are build artifacts), so reads go through `/api/views/[name]` and
 * writes come here. Same validation, same domain builders, same journal.
 */

export async function GET() {
  return NextResponse.json({
    tools: enabledTools().map((item) => ({
      name: item.name,
      description: item.description,
      write: needsApproval(item.name),
      inputSchema: toolJsonSchema(item),
    })),
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "The request body is not JSON." }, { status: 400 });
  }
  const payload = (body ?? {}) as { name?: unknown; arguments?: unknown };
  const name = typeof payload.name === "string" ? payload.name : "";
  if (!findTool(name)) {
    return NextResponse.json({ ok: false, error: `Unknown tool ${name || "(empty)"}.` }, { status: 404 });
  }
  const result = await runTool(name, payload.arguments ?? {});
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}