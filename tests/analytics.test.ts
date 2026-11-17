import { describe, expect, it } from "vitest";
import {
  addWork,
  emptyWorkTotals,
  isProductiveTaskType,
  monthlyWork,
  projectCounts,
  sharePercent,
  taskTypeMinutes,
  workTotals,
} from "@/domain/analytics";

describe("work classification", () => {
  it("calls programming, design, planning, and research productive", () => {
    for (const type of ["development", "design", "planning", "research"]) {
      expect(isProductiveTaskType(type), type).toBe(true);
    }
  });

  it("calls documentation, meetings, communication, and administration unproductive", () => {
    for (const type of ["documentation", "meeting", "communication", "admin", "other"]) {
      expect(isProductiveTaskType(type), type).toBe(false);
    }
  });

  it("adds productive, unproductive, and billable minutes once", () => {
    const totals = addWork(addWork(emptyWorkTotals(), 90, "development", true), 30, "meeting");
    expect(totals).toEqual({ minutes: 120, productiveMinutes: 90, unproductiveMinutes: 30, billableMinutes: 90 });
    expect(addWork(emptyWorkTotals(), 60, "documentation", true)).toEqual({
      minutes: 60,
      productiveMinutes: 0,
      unproductiveMinutes: 60,
      billableMinutes: 60,
    });
  });

  it("groups minutes by task type, largest first", () => {
    const rows = taskTypeMinutes([
      { month: "2026-01", minutes: 60, taskType: "meeting" },
      { month: "2026-01", minutes: 120, taskType: "development" },
      { month: "2026-02", minutes: 30, taskType: "development" },
    ]);
    expect(rows).toEqual([
      { taskType: "development", minutes: 150, productive: true },
      { taskType: "meeting", minutes: 60, productive: false },
    ]);
  });
});

describe("project counts", () => {
  const projects = [
    { status: "active", startedOn: "2026-01-10", endedOn: null },
    { status: "done", startedOn: "2025-11-02", endedOn: "2026-02-20" },
    { status: "done", startedOn: "2024-04-01", endedOn: "2025-06-30" },
    { status: "paused", startedOn: "2026-03-01", endedOn: null },
  ];

  it("counts starts and completions in the selected year and the open work as of today", () => {
    expect(projectCounts(projects, 2026)).toEqual({ started: 2, completed: 1, active: 1, paused: 1 });
    expect(projectCounts(projects, 2025)).toEqual({ started: 1, completed: 1, active: 1, paused: 1 });
  });

  it("keeps an empty year at zero starts and completions", () => {
    expect(projectCounts(projects, 2027)).toEqual({ started: 0, completed: 0, active: 1, paused: 1 });
  });
});

describe("monthly work", () => {
  it("fills all twelve months and ignores another year", () => {
    const months = monthlyWork(
      [
        { month: "2026-01", minutes: 60, taskType: "development", billable: true },
        { month: "2026-01", minutes: 30, taskType: "meeting" },
        { month: "2026-12", minutes: 120, taskType: "planning" },
        { month: "2025-12", minutes: 999, taskType: "development" },
      ],
      2026,
    );
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ month: "2026-01", minutes: 90, productiveMinutes: 60, unproductiveMinutes: 30, billableMinutes: 60 });
    expect(months[11]).toEqual({ month: "2026-12", minutes: 120, productiveMinutes: 120, unproductiveMinutes: 0, billableMinutes: 0 });
    expect(months.reduce((sum, month) => sum + month.minutes, 0)).toBe(210);
  });
});

describe("percentages", () => {
  it("rounds to whole percent and handles an empty total", () => {
    expect(sharePercent(1, 3)).toBe(33);
    expect(sharePercent(2, 3)).toBe(67);
    expect(sharePercent(0, 0)).toBe(0);
  });

  it("sums rows through the shared work total", () => {
    expect(workTotals([{ month: "2026-01", minutes: 45, taskType: "design", billable: true }])).toEqual({
      minutes: 45,
      productiveMinutes: 45,
      unproductiveMinutes: 0,
      billableMinutes: 45,
    });
  });
});