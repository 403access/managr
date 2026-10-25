import { readFileSync } from "fs";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { documents } from "@/db/schema";
import { storedFilePath } from "@/server/files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric < 1) return new NextResponse("Not found", { status: 404 });
  const document = getDb().select().from(documents).where(eq(documents.id, numeric)).get();
  if (!document) return new NextResponse("Not found", { status: 404 });
  try {
    const bytes = new Uint8Array(readFileSync(storedFilePath(document.storedName)));
    const filename = document.fileName.replace(/"/g, "");
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(bytes.length),
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
