import { describe, expect, it } from "vitest";
import {
  analyzeMilestones,
  analyzeMilestonesByCompany,
  filterMilestones,
  groupMilestonesByQuarter,
  milestoneIsOverdue,
  milestoneProgress,
  milestoneYears,
  sortMilestones,
  type MilestoneShape,
} from "@/domain/milestones";

function goal(values: Partial<MilestoneShape> & { title: string; description?: string }): MilestoneShape & { title: string; description: string } {
  return {
    title: values.title,
    description: values.description ?? "",
    category: values.category ?? "other",
    status: values.status ?? "planned",
    targetDate: values.targetDate ?? "2026-12-31",
    progress: values.progress ?? 0,
    companyIds: values.companyIds ?? [],
  };
}

const today = "2026-06-15";

describe("milestone rules", () => {
  it("treats an achieved goal as 100 % even when the stored number is lower", () => {
    expect(milestoneProgress({ status: "achieved", progress: 40 })).toBe(100);
    expect(milestoneProgress({ status: "active", progress: 140 })).toBe(100);
    expect(milestoneProgress({ status: "active", progress: -5 })).toBe(0);
    expect(milestoneProgress({ status: "active", progress: 42.6 })).toBe(43);
  });

  it("calls a goal overdue only after its target date and only while it is not achieved", () => {
    expect(milestoneIsOverdue({ status: "active", targetDate: "2026-06-14" }, today)).toBe(true);
    expect(milestoneIsOverdue({ status: "missed", targetDate: "2026-06-14" }, today)).toBe(true);
    expect(milestoneIsOverdue({ status: "planned", targetDate: "2026-06-15" }, today)).toBe(false);
    expect(milestoneIsOverdue({ status: "achieved", targetDate: "2025-01-01" }, today)).toBe(false);
  });

  it("filters by text, status, category, and company including group-wide goals", () => {
    const rows = [
      goal({ title: "Drei Kunden gewinnen", category: "growth", status: "active", companyIds: [1] }),
      goal({ title: "Rücklage aufbauen", category: "revenue", status: "planned", companyIds: [1, 2] }),
      goal({ title: "Unterlagen ordnen", category: "compliance", status: "achieved", companyIds: [] }),
    ];
    const all = { query: "", status: "" as const, category: "" as const, company: null };
    expect(filterMilestones(rows, all)).toHaveLength(3);
    expect(filterMilestones(rows, { ...all, query: "kunden" }).map((row) => row.title)).toEqual(["Drei Kunden gewinnen"]);
    expect(filterMilestones(rows, { ...all, query: "rücklage" }).map((row) => row.title)).toEqual(["Rücklage aufbauen"]);
    expect(filterMilestones(rows, { ...all, status: "achieved" }).map((row) => row.title)).toEqual(["Unterlagen ordnen"]);
    expect(filterMilestones(rows, { ...all, category: "revenue" }).map((row) => row.title)).toEqual(["Rücklage aufbauen"]);
    expect(filterMilestones(rows, { ...all, company: 2 }).map((row) => row.title)).toEqual(["Rücklage aufbauen"]);
    expect(filterMilestones(rows, { ...all, company: "none" }).map((row) => row.title)).toEqual(["Unterlagen ordnen"]);
  });

  it("sorts and groups goals by target quarter", () => {
    const rows = [
      goal({ title: "Spät", targetDate: "2026-11-01" }),
      goal({ title: "Früh", targetDate: "2026-02-01" }),
      goal({ title: "Mitte", targetDate: "2026-07-01" }),
    ];
    expect(sortMilestones(rows).map((row) => row.title)).toEqual(["Früh", "Mitte", "Spät"]);
    const groups = groupMilestonesByQuarter(sortMilestones(rows));
    expect(groups.map((group) => `${group.year}-Q${group.quarter}`)).toEqual(["2026-Q1", "2026-Q3", "2026-Q4"]);
    expect(groups[0].milestones.map((row) => row.title)).toEqual(["Früh"]);
  });

  it("lists only target years that carry a goal", () => {
    expect(milestoneYears([goal({ title: "a", targetDate: "2026-01-01" }), goal({ title: "b", targetDate: "2027-01-01" }), goal({ title: "c", targetDate: "2026-05-01" })])).toEqual([2026, 2027]);
  });
});

describe("milestone analysis", () => {
  const rows = [
    goal({ title: "Kunden", category: "growth", status: "active", targetDate: "2026-03-31", progress: 50, companyIds: [1] }),
    goal({ title: "Gewinn", category: "revenue", status: "achieved", targetDate: "2026-06-30", progress: 100, companyIds: [1, 2] }),
    goal({ title: "Ordnung", category: "compliance", status: "planned", targetDate: "2026-09-30", progress: 0, companyIds: [] }),
    goal({ title: "Alt", category: "growth", status: "missed", targetDate: "2025-12-31", progress: 20, companyIds: [2] }),
  ];

  it("counts status, overdue goals, categories, and quarters for one target year", () => {
    const analysis = analyzeMilestones(rows, 2026, today);
    expect(analysis.total).toBe(3);
    expect(analysis.byStatus).toEqual({ planned: 1, active: 1, achieved: 1, missed: 0 });
    expect(analysis.open).toBe(2);
    expect(analysis.overdue).toBe(1);
    expect(analysis.averageProgress).toBe(50);
    expect(analysis.achievementRate).toBe(33);
    expect(analysis.categories.map((row) => row.category)).toEqual(["growth", "revenue", "compliance"]);
    expect(analysis.categories[0]).toMatchObject({ total: 1, achieved: 0, overdue: 1, averageProgress: 50 });
    expect(analysis.quarters[0]).toMatchObject({ quarter: 1, total: 1, overdue: 1 });
    expect(analysis.quarters[1]).toMatchObject({ quarter: 2, total: 1, achieved: 1 });
    expect(analysis.quarters[2]).toMatchObject({ quarter: 3, total: 1 });
    expect(analysis.quarters[3]).toMatchObject({ quarter: 4, total: 0 });
  });

  it("rolls goals up per company and keeps a group-wide row", () => {
    const companies = [{ id: 1, name: "Erste UG" }, { id: 2, name: "Zweite UG" }, { id: 3, name: "Ohne Ziel" }];
    const companyRows = analyzeMilestonesByCompany(rows, companies, 2026, today);
    expect(companyRows.map((row) => row.name)).toEqual(["Erste UG", "Ohne Ziel", "Zweite UG", ""]);
    expect(companyRows[0]).toMatchObject({ total: 2, achieved: 1, overdue: 1, averageProgress: 75 });
    expect(companyRows[1]).toMatchObject({ total: 0, achieved: 0, averageProgress: 0 });
    expect(companyRows[2]).toMatchObject({ total: 1, achieved: 1, averageProgress: 100 });
    expect(companyRows[3]).toMatchObject({ id: null, total: 1, open: 1, averageProgress: 0 });
  });
});