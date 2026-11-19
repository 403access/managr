import { describe, expect, it } from "vitest";
import {
  DEFAULT_TASK_SORT,
  DEFAULT_TIME_ENTRY_SORT,
  daySpan,
  filterTasks,
  filterTimeEntries,
  resolveTimeRange,
  sortTasks,
  sortTimeEntries,
  type FilterableTask,
  type FilterableTimeEntry,
} from "@/domain/time";

type Entry = FilterableTimeEntry & { id: number };

const entries: Entry[] = [
  {
    id: 1,
    entryDate: "2026-11-09",
    startedAt: "09:00",
    minutes: 450,
    memo: "Startseite gebaut",
    billable: true,
    employeeId: 1,
    firstName: "Anna",
    projectId: 10,
    projectName: "Website Relaunch",
    taskType: "development",
  },
  {
    id: 2,
    entryDate: "2026-11-09",
    startedAt: "14:00",
    minutes: 60,
    memo: "Teamrunde",
    billable: false,
    employeeId: null,
    firstName: "",
    projectId: null,
    projectName: "",
    taskType: "meeting",
  },
  {
    id: 3,
    entryDate: "2026-11-10",
    startedAt: "08:30",
    minutes: 120,
    memo: "Angebot Müller",
    billable: true,
    employeeId: 2,
    firstName: "Bilal",
    projectId: 11,
    projectName: "Beispiel AG",
    taskType: "admin",
  },
  {
    id: 4,
    entryDate: "2026-11-11",
    startedAt: "10:00",
    minutes: 30,
    memo: "Übergabe",
    billable: false,
    employeeId: 1,
    firstName: "Anna",
    projectId: 10,
    projectName: "Website Relaunch",
    taskType: "communication",
  },
];

function ids<T extends { id: number }>(list: T[]): number[] {
  return list.map((item) => item.id);
}

const noEntryFilter = { query: "", person: null, project: null, taskType: "", billable: "" } as const;

describe("time entry filters", () => {
  it("returns every entry when no filter is set", () => {
    expect(ids(filterTimeEntries(entries, noEntryFilter))).toEqual([1, 2, 3, 4]);
  });

  it("filters by free text over memo, person, and project, ignoring case and umlauts", () => {
    expect(ids(filterTimeEntries(entries, { ...noEntryFilter, query: "muller" }))).toEqual([3]);
    expect(ids(filterTimeEntries(entries, { ...noEntryFilter, query: "UBERGABE" }))).toEqual([4]);
    expect(ids(filterTimeEntries(entries, { ...noEntryFilter, query: "anna" }))).toEqual([1, 4]);
    expect(ids(filterTimeEntries(entries, { ...noEntryFilter, query: "beispiel" }))).toEqual([3]);
  });

  it("filters by person, including entries without one", () => {
    expect(ids(filterTimeEntries(entries, { ...noEntryFilter, person: 1 }))).toEqual([1, 4]);
    expect(ids(filterTimeEntries(entries, { ...noEntryFilter, person: "none" }))).toEqual([2]);
  });

  it("filters by project, including entries without one", () => {
    expect(ids(filterTimeEntries(entries, { ...noEntryFilter, project: 10 }))).toEqual([1, 4]);
    expect(ids(filterTimeEntries(entries, { ...noEntryFilter, project: "none" }))).toEqual([2]);
  });

  it("filters by task type and billable flag", () => {
    expect(ids(filterTimeEntries(entries, { ...noEntryFilter, taskType: "meeting" }))).toEqual([2]);
    expect(ids(filterTimeEntries(entries, { ...noEntryFilter, billable: "yes" }))).toEqual([1, 3]);
    expect(ids(filterTimeEntries(entries, { ...noEntryFilter, billable: "no" }))).toEqual([2, 4]);
  });

  it("combines filters", () => {
    expect(ids(filterTimeEntries(entries, { ...noEntryFilter, query: "website", person: 1, billable: "yes" }))).toEqual([1]);
    expect(ids(filterTimeEntries(entries, { ...noEntryFilter, query: "website", person: 1, billable: "no" }))).toEqual([4]);
    expect(ids(filterTimeEntries(entries, { ...noEntryFilter, taskType: "admin", project: "none" }))).toEqual([]);
  });
});

describe("time entry sorting", () => {
  it("keeps the day order by default", () => {
    expect(DEFAULT_TIME_ENTRY_SORT).toBe("dateAsc");
    expect(ids(sortTimeEntries(entries, DEFAULT_TIME_ENTRY_SORT))).toEqual([1, 2, 3, 4]);
  });

  it("sorts by day in both directions", () => {
    expect(ids(sortTimeEntries(entries, "dateDesc"))).toEqual([4, 3, 2, 1]);
  });

  it("sorts by duration in both directions", () => {
    expect(ids(sortTimeEntries(entries, "durationDesc"))).toEqual([1, 3, 2, 4]);
    expect(ids(sortTimeEntries(entries, "durationAsc"))).toEqual([4, 2, 3, 1]);
  });

  it("sorts by person and project, keeping the day order inside a tie", () => {
    expect(ids(sortTimeEntries(entries, "person"))).toEqual([2, 1, 4, 3]);
    expect(ids(sortTimeEntries(entries, "project"))).toEqual([2, 3, 1, 4]);
  });
});

type Task = FilterableTask & { id: number };

const tasks: Task[] = [
  {
    id: 1,
    title: "Angebot schreiben",
    notes: "",
    area: "invoices",
    status: "open",
    taskType: "admin",
    dueDate: "2026-11-20",
    projectId: 10,
    projectName: "Website Relaunch",
  },
  {
    id: 2,
    title: "Startseite",
    notes: "Hero überarbeiten",
    area: "general",
    status: "doing",
    taskType: "development",
    dueDate: "2026-11-15",
    projectId: 10,
    projectName: "Website Relaunch",
  },
  {
    id: 3,
    title: "Teamrunde",
    notes: "",
    area: "people",
    status: "done",
    taskType: "meeting",
    dueDate: null,
    projectId: null,
    projectName: "",
  },
  {
    id: 4,
    title: "Steuer prüfen",
    notes: "USt-Voranmeldung",
    area: "tax",
    status: "open",
    taskType: "admin",
    dueDate: "2026-11-12",
    projectId: null,
    projectName: "",
  },
];

const noTaskFilter = { query: "", status: "", project: null, area: "", taskType: "" } as const;

describe("task filters", () => {
  it("returns every task when no filter is set", () => {
    expect(ids(filterTasks(tasks, noTaskFilter))).toEqual([1, 2, 3, 4]);
  });

  it("filters by free text over title, note, and project", () => {
    expect(ids(filterTasks(tasks, { ...noTaskFilter, query: "hero" }))).toEqual([2]);
    expect(ids(filterTasks(tasks, { ...noTaskFilter, query: "ust" }))).toEqual([4]);
    expect(ids(filterTasks(tasks, { ...noTaskFilter, query: "website" }))).toEqual([1, 2]);
  });

  it("filters by status, project, area, and task type", () => {
    expect(ids(filterTasks(tasks, { ...noTaskFilter, status: "open" }))).toEqual([1, 4]);
    expect(ids(filterTasks(tasks, { ...noTaskFilter, status: "done" }))).toEqual([3]);
    expect(ids(filterTasks(tasks, { ...noTaskFilter, project: "none" }))).toEqual([3, 4]);
    expect(ids(filterTasks(tasks, { ...noTaskFilter, project: 10 }))).toEqual([1, 2]);
    expect(ids(filterTasks(tasks, { ...noTaskFilter, area: "tax" }))).toEqual([4]);
    expect(ids(filterTasks(tasks, { ...noTaskFilter, taskType: "admin" }))).toEqual([1, 4]);
  });

  it("combines filters", () => {
    expect(ids(filterTasks(tasks, { ...noTaskFilter, area: "tax", status: "open", project: "none" }))).toEqual([4]);
    expect(ids(filterTasks(tasks, { ...noTaskFilter, area: "tax", taskType: "meeting" }))).toEqual([]);
  });
});

describe("task sorting", () => {
  it("puts open work first by default and undated tasks last", () => {
    expect(DEFAULT_TASK_SORT).toBe("status");
    expect(ids(sortTasks(tasks, DEFAULT_TASK_SORT))).toEqual([4, 1, 2, 3]);
  });

  it("sorts by due date in both directions, undated last", () => {
    expect(ids(sortTasks(tasks, "dueAsc"))).toEqual([4, 2, 1, 3]);
    expect(ids(sortTasks(tasks, "dueDesc"))).toEqual([1, 2, 4, 3]);
  });

  it("sorts by title and project", () => {
    expect(ids(sortTasks(tasks, "title"))).toEqual([1, 2, 4, 3]);
    expect(ids(sortTasks(tasks, "project"))).toEqual([4, 3, 2, 1]);
  });

  it("keeps the chosen sort order after filtering", () => {
    const open = filterTasks(tasks, { ...noTaskFilter, status: "open" });
    expect(ids(sortTasks(open, "dueAsc"))).toEqual([4, 1]);
  });
});

describe("time range", () => {
  it("counts both ends of a range", () => {
    expect(daySpan("2026-11-09", "2026-11-09")).toBe(1);
    expect(daySpan("2026-11-09", "2026-11-15")).toBe(7);
    expect(daySpan("2026-11-01", "2026-11-30")).toBe(30);
  });

  it("prefers an explicit pair and orders it", () => {
    expect(resolveTimeRange("2026-11-01", "2026-11-30", "2026-11-12")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(resolveTimeRange("2026-11-30", "2026-11-01", "2026-11-12")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });

  it("fills a week from a single end and falls back to the anchor week", () => {
    expect(resolveTimeRange("2026-11-04", null, "2026-11-12")).toEqual({ from: "2026-11-04", to: "2026-11-10" });
    expect(resolveTimeRange(null, "2026-11-04", "2026-11-12")).toEqual({ from: "2026-10-29", to: "2026-11-04" });
    expect(resolveTimeRange(null, null, "2026-11-12")).toEqual({ from: "2026-11-09", to: "2026-11-15" });
  });
});