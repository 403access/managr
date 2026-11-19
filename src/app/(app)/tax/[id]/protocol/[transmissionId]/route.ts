import { NextResponse } from "next/server";
import { readTaxProtocol } from "@/server/tax-filings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string; transmissionId: string }> }) {
  const { id, transmissionId } = await context.params;
  const filingId = Number(id);
  const numeric = Number(transmissionId);
  if (!Number.isInteger(filingId) || filingId < 1 || !Number.isInteger(numeric) || numeric < 1) {
    return new NextResponse("Not found", { status: 404 });
  }
  const result = readTaxProtocol(numeric, filingId);
  if (!result) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Blob([new Uint8Array(result.buffer)]), {
    headers: {
      "Content-Type": result.mimeType,
      "Content-Disposition": `attachment; filename="${result.name.replace(/["\\\r\n]/g, "_")}"`,
    },
  });
}