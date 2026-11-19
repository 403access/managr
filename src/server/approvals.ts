import "server-only";
import { randomUUID } from "node:crypto";
import { type ChangeAction } from "@/domain/assistant-actions";

export { changeAction, type ChangeAction } from "@/domain/assistant-actions";

/** One write the model wants to run, as shown in the confirmation card. */
export type ProposedChange = {
  /** The OpenAI tool_call id, used to approve or reject this one change. */
  callId: string;
  name: string;
  action: ChangeAction;
  input: unknown;
  /** Display names for ids in the input, such as a customer or project name. */
  labels?: Record<string, string>;
};

export type ApprovalGate = {
  /** Register a proposal and return the id the panel confirms plus its decision. */
  open: (changes: ProposedChange[]) => { id: string; decision: Promise<Set<string>> };
};

type Pending = {
  callIds: Set<string>;
  settle: (approved: Set<string>) => void;
};

// Route handlers can be compiled as separate bundles, so the map lives on
// globalThis: /api/assistant and /api/assistant/approve must see the same
// proposals inside one local Next process.
type ApprovalGlobal = typeof globalThis & { __managrApprovals?: Map<string, Pending> };
const pending = ((globalThis as ApprovalGlobal).__managrApprovals ??= new Map<string, Pending>());
const APPROVAL_TTL_MS = 10 * 60_000;

export function createApprovalGate(signal?: AbortSignal): ApprovalGate {
  return {
    open: (changes) => openProposal(changes, signal),
  };
}

function openProposal(
  changes: ProposedChange[],
  signal?: AbortSignal,
): { id: string; decision: Promise<Set<string>> } {
  const id = randomUUID();
  let settle!: (approved: Set<string>) => void;
  const decision = new Promise<Set<string>>((resolve) => {
    settle = resolve;
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = (approved: Set<string>) => {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    pending.delete(id);
    settle(approved);
  };
  const onAbort = () => finish(new Set());

  timer = setTimeout(() => finish(new Set()), APPROVAL_TTL_MS);
  if (signal) {
    if (signal.aborted) {
      finish(new Set());
      return { id, decision };
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }
  pending.set(id, { callIds: new Set(changes.map((change) => change.callId)), settle: finish });

  return { id, decision };
}

/**
 * Resolve a waiting proposal. Unknown ids and call ids are ignored, so a stale
 * panel cannot approve a different request or a call that was not proposed.
 */
export function decideProposal(id: string, approved: string[]): boolean {
  const entry = pending.get(id);
  if (!entry) return false;
  const allowed = new Set(approved.filter((callId) => entry.callIds.has(callId)));
  entry.settle(allowed);
  return true;
}