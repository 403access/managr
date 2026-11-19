import { describe, expect, it } from "vitest";
import { mergePlan, type PlanStep, type PlanStepView } from "@/domain/assistant-plan";

function step(id: string, title: string, status: PlanStep["status"] = "pending", note?: string): PlanStep {
  return { id, title, status, ...(note ? { note } : {}) };
}

describe("assistant plan", () => {
  it("keeps the first plan unmarked", () => {
    expect(mergePlan([], [step("1", "Zeiten lesen"), step("2", "Rechnung prüfen")])).toEqual([
      { id: "1", title: "Zeiten lesen", status: "pending" },
      { id: "2", title: "Rechnung prüfen", status: "pending" },
    ]);
  });

  it("marks added, changed, and dropped steps with the model's reasons", () => {
    const first: PlanStepView[] = [
      { id: "1", title: "Zeiten lesen", status: "done" },
      { id: "2", title: "Zeiten ändern", status: "doing" },
      { id: "3", title: "Rechnung prüfen", status: "pending" },
    ];
    const merged = mergePlan(first, [
      step("1", "Zeiten lesen", "done"),
      step("2", "Zeiten und Pausen ändern", "doing", "Pause gehört zum Block"),
      step("4", "Rückfrage stellen", "pending", "Kunde fehlt"),
      step("3", "Rechnung prüfen", "skipped", "Entwurf ist bereits bezahlt"),
    ]);

    expect(merged).toEqual([
      { id: "1", title: "Zeiten lesen", status: "done" },
      { id: "2", title: "Zeiten und Pausen ändern", status: "doing", note: "Pause gehört zum Block", change: "changed" },
      { id: "4", title: "Rückfrage stellen", status: "pending", note: "Kunde fehlt", change: "added" },
      { id: "3", title: "Rechnung prüfen", status: "skipped", note: "Entwurf ist bereits bezahlt", change: "removed" },
    ]);
  });

  it("keeps a dropped step visible and can bring it back", () => {
    const first: PlanStepView[] = [
      { id: "1", title: "Lesen", status: "done" },
      { id: "2", title: "Buchen", status: "pending" },
    ];
    const dropped = mergePlan(first, [step("1", "Lesen", "done")]);
    expect(dropped[1]).toEqual({ id: "2", title: "Buchen", status: "skipped", change: "removed" });

    const revived = mergePlan(dropped, [step("1", "Lesen", "done"), step("2", "Buchen", "doing", "Doch nötig")]);
    expect(revived[1]).toEqual({ id: "2", title: "Buchen", status: "doing", note: "Doch nötig", change: "changed" });
  });

  it("treats a changed note as a plan change but not plain progress", () => {
    const first: PlanStepView[] = [{ id: "1", title: "Lesen", status: "pending", note: "Erst prüfen" }];
    const progress = mergePlan(first, [{ ...first[0], status: "doing" }])[0];
    expect(progress.status).toBe("doing");
    expect(progress.change).toBeUndefined();
    expect(mergePlan(first, [{ ...first[0], status: "doing", note: "Andere Quelle" }])[0]).toMatchObject({
      status: "doing",
      note: "Andere Quelle",
      change: "changed",
    });
  });
});