import { NextResponse } from "next/server";
import { getLocale } from "@/server/locale";
import { loadInvoice } from "@/server/queries";
import { zugferdFile } from "@/server/zugferd";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric < 1) return new NextResponse("Not found", { status: 404 });
  const loaded = loadInvoice(numeric);
  if (!loaded) return new NextResponse("Not found", { status: 404 });
  const locale = await getLocale();
  const result = await zugferdFile(loaded.company, loaded, locale === "en" ? "en-US" : "de-DE");
  if ("blockers" in result) {
    return new NextResponse(result.blockers.join("\n"), {
      status: 422,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new NextResponse(Buffer.from(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
