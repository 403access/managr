import { describe, expect, it } from "vitest";
import { buildOrgChart, managerProblem, type OrgMember } from "@/domain/org";

const today = "2026-11-18";

function person(id: number, lastName: string, managerId: number | null = null, endDate: string | null = null): OrgMember {
  return { id, firstName: "Test", lastName, role: "", kind: "regular", endDate, managerId };
}

describe("org chart", () => {
  it("places reports below their manager and sorts each level by name", () => {
    const chart = buildOrgChart(
      [person(1, "Zimmer"), person(2, "Albers", 1), person(3, "Brandt", 1), person(4, "Conrad", 3)],
      today,
    );
    expect(chart.total).toBe(4);
    expect(chart.depth).toBe(3);
    expect(chart.roots.map((node) => node.id)).toEqual([1]);
    expect(chart.roots[0]!.children.map((node) => node.id)).toEqual([2, 3]);
    expect(chart.roots[0]!.children[1]!.children.map((node) => node.id)).toEqual([4]);
  });

  it("keeps people without a manager at the top and leaves former people out of the tree", () => {
    const chart = buildOrgChart(
      [person(1, "Chefin"), person(2, "Alt", 1, "2026-10-31"), person(3, "Neu", 99), person(4, "EndetHeute", 1, today)],
      today,
    );
    expect(chart.roots.map((node) => node.id).sort()).toEqual([1, 3]);
    expect(chart.former.map((node) => node.id)).toEqual([2]);
    expect(chart.total).toBe(3);
  });

  it("breaks a reporting loop instead of recursing forever", () => {
    const chart = buildOrgChart([person(1, "A", 3), person(2, "B", 1), person(3, "C", 2)], today);
    expect(chart.total).toBe(3);
    expect(chart.depth).toBeLessThanOrEqual(3);
    const seen: number[] = [];
    const walk = (nodes: typeof chart.roots) => {
      for (const node of nodes) {
        seen.push(node.id);
        walk(node.children);
      }
    };
    walk(chart.roots);
    expect(seen.sort()).toEqual([1, 2, 3]);
  });
});

describe("manager changes", () => {
  const people = [
    { id: 1, managerId: null },
    { id: 2, managerId: 1 },
    { id: 3, managerId: 2 },
  ];

  it("accepts a reporting line without a loop", () => {
    expect(managerProblem(people, 3, 1)).toBe("");
    expect(managerProblem(people, null, 3)).toBe("");
    expect(managerProblem(people, 2, null)).toBe("");
  });

  it("rejects a person as their own manager, a loop, or a missing manager", () => {
    expect(managerProblem(people, 2, 2)).toContain("themselves");
    expect(managerProblem(people, 1, 3)).toContain("loop");
    expect(managerProblem(people, 2, 99)).toContain("not found");
  });
});