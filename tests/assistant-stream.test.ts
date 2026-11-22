import { describe, expect, it } from "vitest";
import { MOCK_SESSIONS } from "@/client/assistant-mock-sessions";
import { applyStreamEvent, emptyReplay, streamingState, type ReplayState } from "@/client/assistant-stream";
import type { StreamEvent } from "@/client/assistant-types";

function replay(events: StreamEvent[]): ReplayState {
  return events.reduce(applyStreamEvent, emptyReplay());
}

describe("assistant stream", () => {
  it("keeps a step key stable when its result arrives", () => {
    const state = replay([
      { type: "tool", name: "read_time", input: { anyDayInWeek: "2026-11-09" } },
      { type: "tool_result", name: "read_time", input: {}, ok: true, summary: "ok", data: { total: 1120 } },
    ]);
    expect(state.steps).toEqual([
      { key: "0", name: "read_time", input: { anyDayInWeek: "2026-11-09" }, status: "ok", summary: "ok", data: { total: 1120 } },
    ]);
    expect(state.seq).toBe(1);
  });

  it("merges plan updates and marks added, changed, and removed steps", () => {
    const state = replay([
      { type: "plan", steps: [{ id: "1", title: "Lesen", status: "doing" }] },
      {
        type: "plan",
        steps: [
          { id: "1", title: "Lesen", status: "done" },
          { id: "2", title: "Prüfen", status: "pending" },
        ],
      },
      { type: "plan", steps: [{ id: "2", title: "Prüfen", status: "pending" }] },
    ]);
    expect(state.plan).toEqual([
      { id: "2", title: "Prüfen", status: "pending", change: "added" },
      { id: "1", title: "Lesen", status: "skipped", change: "removed" },
    ]);
  });

  it("drops a proposal as soon as the turn moves on", () => {
    const changes = [{ callId: "a", name: "add_time", action: "add" as const, input: {} }];
    const state = replay([
      { type: "proposal", id: "p1", changes },
      { type: "tool", name: "add_time", input: {} },
    ]);
    expect(state.proposal).toBeNull();
    expect(state.steps).toHaveLength(1);
  });

  it("replaces streamed text with the final reply and clears it on reset", () => {
    const state = replay([
      { type: "delta", text: "Die Bank " },
      { type: "delta", text: "steht." },
      { type: "reply", text: "Die Bank steht im Briefing." },
    ]);
    expect(state.content).toBe("Die Bank steht im Briefing.");
    expect(state.sawReply).toBe(true);
    expect(replay([{ type: "delta", text: "alt" }, { type: "reset" }]).content).toBe("");
  });

  it("only renders a streaming turn with what it already has", () => {
    expect(streamingState(emptyReplay())).toEqual({ content: "", steps: [] });
    const withPlan = replay([{ type: "plan", steps: [{ id: "1", title: "Lesen", status: "pending" }] }]);
    expect(streamingState(withPlan).plan).toEqual([{ id: "1", title: "Lesen", status: "pending" }]);
  });

  it("replays every mock session into steps and a commit", () => {
    for (const session of MOCK_SESSIONS) {
      const state = replay(session.events.map((entry) => entry.event));
      expect(state.steps.length, session.id).toBeGreaterThan(0);
      expect(state.steps.every((step) => step.status !== "running"), session.id).toBe(true);
      expect(state.error, session.id).toBe("");
    }
  });
});