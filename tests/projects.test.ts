import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROJECT_GROUPING,
  DEFAULT_PROJECT_SORT,
  filterProjects,
  groupProjects,
  sortProjects,
  type FilterableProject,
} from "@/domain/projects";

type Sample = FilterableProject & { id: number; startedOn: string; minutes: number };

const projects: Sample[] = [
  {
    id: 1,
    name: "Website Relaunch",
    status: "active",
    notes: "Überarbeitung der Startseite",
    customerId: 10,
    customerName: "Müller GmbH",
    endedOn: "2026-11-30",
    startedOn: "2026-01-10",
    minutes: 120,
  },
  { id: 2, name: "Intranet", status: "done", notes: "", customerId: 11, customerName: "Beispiel AG", endedOn: "2026-03-15", startedOn: "2025-11-02", minutes: 60 },
  {
    id: 3,
    name: "Internes Tool",
    status: "paused",
    notes: "Ohne Auftraggeber",
    customerId: null,
    customerName: null,
    endedOn: null,
    startedOn: "2026-03-01",
    minutes: 30,
  },
  { id: 4, name: "App Wartung", status: "active", notes: "", customerId: 11, customerName: "Beispiel AG", endedOn: "2026-11-15", startedOn: "2026-02-20", minutes: 240 },
  { id: 5, name: "Blog", status: "active", notes: "", customerId: 11, customerName: "Beispiel AG", endedOn: "2026-11-01", startedOn: "2026-04-01", minutes: 90 },
];

function ids(list: Sample[]): number[] {
  return list.map((project) => project.id);
}

describe("project filters", () => {
  it("returns every project when no filter is set", () => {
    expect(ids(filterProjects(projects, { query: "", status: "", customer: null }))).toEqual([1, 2, 3, 4, 5]);
  });

  it("filters by free text, ignoring case and umlauts", () => {
    expect(ids(filterProjects(projects, { query: "muller", status: "", customer: null }))).toEqual([1]);
    expect(ids(filterProjects(projects, { query: "UBERARBEITUNG", status: "", customer: null }))).toEqual([1]);
    expect(ids(filterProjects(projects, { query: "intranet", status: "", customer: null }))).toEqual([2]);
  });

  it("filters by status", () => {
    expect(ids(filterProjects(projects, { query: "", status: "active", customer: null }))).toEqual([1, 4, 5]);
    expect(ids(filterProjects(projects, { query: "", status: "done", customer: null }))).toEqual([2]);
    expect(ids(filterProjects(projects, { query: "", status: "paused", customer: null }))).toEqual([3]);
  });

  it("filters by customer, including projects without one", () => {
    expect(ids(filterProjects(projects, { query: "", status: "", customer: 11 }))).toEqual([2, 4, 5]);
    expect(ids(filterProjects(projects, { query: "", status: "", customer: "none" }))).toEqual([3]);
  });

  it("combines filters", () => {
    expect(ids(filterProjects(projects, { query: "tool", status: "active", customer: null }))).toEqual([]);
    expect(ids(filterProjects(projects, { query: "tool", status: "paused", customer: "none" }))).toEqual([3]);
  });
});

describe("project sorting", () => {
  it("sorts by name by default", () => {
    expect(DEFAULT_PROJECT_SORT).toBe("name");
    expect(ids(sortProjects(projects, DEFAULT_PROJECT_SORT))).toEqual([4, 5, 3, 2, 1]);
  });

  it("sorts by start date in both directions", () => {
    expect(ids(sortProjects(projects, "startedDesc"))).toEqual([5, 3, 4, 1, 2]);
    expect(ids(sortProjects(projects, "startedAsc"))).toEqual([2, 1, 4, 3, 5]);
  });

  it("sorts by deadline and puts projects without one last", () => {
    expect(ids(sortProjects(projects, "deadlineAsc"))).toEqual([2, 5, 4, 1, 3]);
  });

  it("sorts by booked time, most first", () => {
    expect(ids(sortProjects(projects, "minutesDesc"))).toEqual([4, 1, 5, 2, 3]);
  });
});

describe("project grouping", () => {
  it("groups by customer by default", () => {
    expect(DEFAULT_PROJECT_GROUPING).toBe("customer");
    const groups = groupProjects(sortProjects(projects, DEFAULT_PROJECT_SORT), DEFAULT_PROJECT_GROUPING);
    expect(groups.map((group) => group.key)).toEqual(["11", "10", "none"]);
    expect(groups.map((group) => group.projects.map((project) => project.id))).toEqual([[4, 5, 2], [1], [3]]);
    expect(groups.map((group) => (group.kind === "customer" ? group.name : null))).toEqual([
      "Beispiel AG",
      "Müller GmbH",
      null,
    ]);
  });

  it("groups by the month of the deadline and puts projects without one last", () => {
    const groups = groupProjects(sortProjects(projects, "deadlineAsc"), "deadline");
    expect(groups.map((group) => group.key)).toEqual(["2026-03", "2026-11", "none"]);
    expect(groups.map((group) => group.projects.map((project) => project.id))).toEqual([[2], [5, 4, 1], [3]]);
    expect(groups.every((group) => group.kind === "deadline")).toBe(true);
  });

  it("keeps the chosen sort order inside a group", () => {
    const groups = groupProjects(sortProjects(projects, "startedDesc"), "customer");
    const beispiel = groups.find((group) => group.key === "11");
    expect(beispiel?.projects.map((project) => project.id)).toEqual([5, 4, 2]);
  });

  it("keeps the order of an already filtered list", () => {
    const filtered = filterProjects(projects, { query: "wartung", status: "", customer: null });
    const groups = groupProjects(filtered, "customer");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.projects.map((project) => project.id)).toEqual([4]);
  });
});