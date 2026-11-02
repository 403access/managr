import { NextResponse } from "next/server";
import { loadCompany, loadInvoice } from "@/server/queries";
import { xrechnungFile } from "@/server/xrechnung";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric < 1) return new NextResponse("Not found", { status: 404 });
  const loaded = loadInvoice(numeric);
  if (!loaded) return new NextResponse("Not found", { status: 404 });
  const result = xrechnungFile(loadCompany(), loaded);
  if ("blockers" in result) {
    return new NextResponse(result.blockers.join("\n"), {
      status: 422,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new NextResponse(result.xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
