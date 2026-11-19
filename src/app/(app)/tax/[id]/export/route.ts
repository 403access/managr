import { NextResponse } from "next/server";
import { taxFilingExport } from "@/server/tax-filings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric < 1) return new NextResponse("Not found", { status: 404 });
  const format = new URL(request.url).searchParams.get("format") ?? "json";
  if (format !== "json" && format !== "csv" && format !== "xml") return new NextResponse("Not found", { status: 404 });
  try {
    const result = taxFilingExport(numeric, format);
    const body = format === "xml" ? new Blob([new Uint8Array(Buffer.from(result.body, "latin1"))]) : result.body;
    return new NextResponse(body, {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The export could not be created.";
    return new NextResponse(message, { status: 422, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}