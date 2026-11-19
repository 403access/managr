import "server-only";
import { cookies } from "next/headers";
import { isTrashKind, trashEntry, type TrashKind } from "./trash";

const COOKIE = "managr-last-delete";

export type LastDeletion = { kind: TrashKind; id: number; label: string; detail: string };

/** Remember the record a screen action just deleted, for the undo toast. */
export async function rememberDeletion(kind: TrashKind, id: number): Promise<void> {
  const entry = trashEntry(kind, id);
  if (!entry) return;
  try {
    const jar = await cookies();
    jar.set(COOKIE, JSON.stringify({ kind, id, label: entry.label, detail: entry.detail }), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
  } catch {
    // A context without a response (for example a tool call) has no cookie jar.
  }
}

export async function readLastDeletion(): Promise<LastDeletion | null> {
  try {
    const raw = (await cookies()).get(COOKIE)?.value;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { kind?: unknown; id?: unknown; label?: unknown; detail?: unknown };
    if (typeof parsed.kind !== "string" || !isTrashKind(parsed.kind)) return null;
    if (typeof parsed.id !== "number" || !Number.isFinite(parsed.id)) return null;
    return {
      kind: parsed.kind,
      id: parsed.id,
      label: typeof parsed.label === "string" ? parsed.label : "",
      detail: typeof parsed.detail === "string" ? parsed.detail : "",
    };
  } catch {
    return null;
  }
}

export async function clearLastDeletion(): Promise<void> {
  try {
    (await cookies()).delete(COOKIE);
  } catch {
    // Reading a page has no writable cookie jar; the next response will clear it.
  }
}