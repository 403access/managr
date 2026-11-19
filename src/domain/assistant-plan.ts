export type PlanStepStatus = "pending" | "doing" | "done" | "skipped";

export type PlanStep = {
  id: string;
  title: string;
  status: PlanStepStatus;
  note?: string;
};

export type PlanChange = "added" | "changed" | "removed";

/** The plan as the panel keeps it, with a marker for every later change. */
export type PlanStepView = PlanStep & { change?: PlanChange };

/**
 * Merge a new roadmap into the previous one. Stable ids let the panel keep the
 * order and show what was added, changed, or dropped; a dropped step remains
 * visible as skipped instead of disappearing.
 */
export function mergePlan(previous: PlanStepView[], next: PlanStep[]): PlanStepView[] {
  const before = new Map(previous.map((step) => [step.id, step]));
  const nextIds = new Set(next.map((step) => step.id));
  const merged: PlanStepView[] = next.map((step) => {
    const old = before.get(step.id);
    let change = old?.change;
    if (!old) {
      if (previous.length > 0) change = "added";
    } else if (old.title !== step.title) {
      change = "changed";
    } else if (old.status !== "skipped" && step.status === "skipped") {
      change = "removed";
    } else if (old.status === "skipped" && step.status !== "skipped") {
      change = "changed";
    } else if ((old.note ?? "") !== (step.note ?? "")) {
      change = "changed";
    }
    return change ? { ...step, change } : { ...step };
  });

  for (const old of previous) {
    if (nextIds.has(old.id)) continue;
    merged.push({ ...old, status: "skipped", change: "removed" });
  }
  return merged;
}