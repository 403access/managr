import { NextResponse } from "next/server";
import { assistantCatalog } from "@/server/assistant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Providers and models from the local opencode installation. No credential is included. */
export async function GET() {
  const catalog = await assistantCatalog();
  return NextResponse.json(catalog, { headers: { "cache-control": "no-store" } });
}