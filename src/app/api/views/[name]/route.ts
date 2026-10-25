import { NextResponse } from "next/server";
import { parseViewName } from "@/server/view-request";
import { loadView } from "@/server/views";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  const parsed = parseViewName(name);
  if (!parsed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const data = loadView(parsed, new URL(request.url).searchParams);
    if (data == null) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "The desk could not refresh." }, { status: 500 });
  }
}
