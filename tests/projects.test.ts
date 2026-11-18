import { describe, expect, it } from "vitest";
import { filterProjects, type FilterableProject } from "@/domain/projects";

type Sample = FilterableProject & { id: number };

const projects: Sample[] = [
  {
    id: 1,
    name: "Website Relaunch",
    status: "active",
    notes: "Überarbeitung der Startseite",
    customerId: 10,
    customerName: "Müller GmbH",
  },
  { id: 2, name: "Intranet", status: "done", notes: "", customerId: 11, customerName: "Beispiel AG" },
  { id: 3, name: "Internes Tool", status: "paused", notes: "Ohne Auftraggeber", customerId: null, customerName: null },
];

function ids(filtered: Sample[]): number[] {
  return filtered.map((project) => project.id);
}

describe("project filters", () => {
  it("returns every project when no filter is set", () => {
    expect(ids(filterProjects(projects, { query: "", status: "", customer: null }))).toEqual([1, 2, 3]);
  });

  it("filters by free text, ignoring case and umlauts", () => {
    expect(ids(filterProjects(projects, { query: "muller", status: "", customer: null }))).toEqual([1]);
    expect(ids(filterProjects(projects, { query: "UBERARBEITUNG", status: "", customer: null }))).toEqual([1]);
    expect(ids(filterProjects(projects, { query: "intranet", status: "", customer: null }))).toEqual([2]);
  });

  it("filters by status", () => {
    expect(ids(filterProjects(projects, { query: "", status: "active", customer: null }))).toEqual([1]);
    expect(ids(filterProjects(projects, { query: "", status: "done", customer: null }))).toEqual([2]);
    expect(ids(filterProjects(projects, { query: "", status: "paused", customer: null }))).toEqual([3]);
  });

  it("filters by customer, including projects without one", () => {
    expect(ids(filterProjects(projects, { query: "", status: "", customer: 11 }))).toEqual([2]);
    expect(ids(filterProjects(projects, { query: "", status: "", customer: "none" }))).toEqual([3]);
  });

  it("combines filters", () => {
    expect(ids(filterProjects(projects, { query: "tool", status: "active", customer: null }))).toEqual([]);
    expect(ids(filterProjects(projects, { query: "tool", status: "paused", customer: "none" }))).toEqual([3]);
  });
});