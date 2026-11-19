import { NextResponse } from "next/server";
import { z } from "zod";
import { decideProposal } from "@/server/approvals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  id: z.string().trim().min(1).max(100),
  approved: z.array(z.string().trim().min(1).max(200)).max(200),
});

/** Resolve the confirmation card of a running assistant turn. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "The confirmation could not be read." }, { status: 400 });
  }
  if (!decideProposal(parsed.data.id, parsed.data.approved)) {
    return NextResponse.json({ error: "The confirmation expired." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}