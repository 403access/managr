import "server-only";
import fs from "fs";
import path from "path";
import { uploadsDir } from "@/db/paths";

const MAX_BYTES = 12 * 1024 * 1024;

export function storedFilePath(storedName: string): string {
  if (!/^[\w.-]+$/.test(storedName)) throw new Error("Bad file name.");
  const root = path.resolve(uploadsDir());
  const full = path.resolve(root, storedName);
  if (full !== path.join(root, storedName)) throw new Error("Bad file name.");
  return full;
}

export async function saveUpload(file: File): Promise<{ storedName: string; fileName: string; mimeType: string; sizeBytes: number }> {
  if (!(file instanceof File) || file.size <= 0) throw new Error("Choose a file.");
  if (file.size > MAX_BYTES) throw new Error("Files must be 12 MB or smaller.");
  const fileName = file.name.replace(/[^\w.\- ]+/g, "").trim().slice(0, 120) || "upload";
  const storedName = `${crypto.randomUUID()}-${fileName.replace(/\s+/g, "_")}`;
  const target = storedFilePath(storedName);
  fs.mkdirSync(uploadsDir(), { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(target, bytes);
  return { storedName, fileName, mimeType: file.type || "application/octet-stream", sizeBytes: bytes.length };
}

export function removeUpload(storedName: string): void {
  const target = storedFilePath(storedName);
  if (fs.existsSync(target)) fs.unlinkSync(target);
}
