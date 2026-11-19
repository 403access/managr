import type { TaskType } from "./analytics";
import { addDays, parseIso, toUtcDate } from "./calendar";

export function parseClock(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Use a time like 09:30.");
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error("Use a time like 09:30.");
  return hours * 60 + minutes;
}

export function durationMinutes(start: string, end: string, breakMinutes: number): number {
  const span = parseClock(end) - parseClock(start);
  if (span <= 0) throw new Error("End time must be after the start time on the same day.");
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes >= span) {
    throw new Error("The break must be shorter than the recorded span.");
  }
  return span - breakMinutes;
}

export type TimeWarning = { level: "stop" | "watch"; message: string };

export function timeWarnings(netMinutes: number, breakMinutes: number): TimeWarning[] {
  const warnings: TimeWarning[] = [];
  if (netMinutes > 600) warnings.push({ level: "stop", message: "Net working time is over 10 hours (§3 ArbZG)." });
  else if (netMinutes > 480) warnings.push({ level: "watch", message: "Above 8 hours. The average has to come back to 8 (§3 ArbZG)." });
  if (netMinutes > 540 && breakMinutes < 60) warnings.push({ level: "watch", message: "A day over 9 hours needs a 60-minute break (§4 ArbZG)." });
  else if (netMinutes > 360 && breakMinutes < 30) warnings.push({ level: "watch", message: "A day over 6 hours needs a 30-minute break (§4 ArbZG)." });
  return warnings;
}

export function minimumVacationDays(workdaysPerWeek: number): number {
  const days = Math.min(6, Math.max(1, Math.round(workdaysPerWeek)));
  return Math.round((24 * days) / 6);
}

export function vacationShortfall(entitlement: number, workdaysPerWeek: number): string | null {
  const minimum = minimumVacationDays(workdaysPerWeek);
  if (entitlement < minimum) return `Statutory minimum is ${minimum} days on a ${workdaysPerWeek}-day week (BUrlG).`;
  return null;
}

/**
 * Counts the first N weekdays, Monday first. A 5-day week is Monday to Friday.
 * It does not know a person's individual weekday pattern.
 */
export function countWorkdays(startIso: string, endIso: string, workdaysPerWeek: number): number {
  if (endIso < startIso) return 0;
  const openDays = Math.min(6, Math.max(1, Math.round(workdaysPerWeek)));
  let count = 0;
  let cursor = startIso;
  for (let guard = 0; guard < 400 && cursor <= endIso; guard += 1) {
    const sundayBased = toUtcDate(cursor).getUTCDay();
    const mondayBased = sundayBased === 0 ? 6 : sundayBased - 1;
    if (mondayBased < openDays) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

export function weekStart(isoDate: string): string {
  parseIso(isoDate);
  const sundayBased = toUtcDate(isoDate).getUTCDay();
  const mondayOffset = sundayBased === 0 ? 6 : sundayBased - 1;
  return addDays(isoDate, -mondayOffset);
}

/** Inclusive number of days from the first to the last date. */
export function daySpan(from: string, to: string): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000) + 1;
}

/**
 * The viewed range: an explicit pair wins, a single end date fills a week,
 * and without both the week around the anchor is shown.
 */
export function resolveTimeRange(from: string | null, to: string | null, anchor: string): { from: string; to: string } {
  if (from && to) return from <= to ? { from, to } : { from: to, to: from };
  if (from) return { from, to: addDays(from, 6) };
  if (to) return { from: addDays(to, -6), to };
  const start = weekStart(anchor);
  return { from: start, to: addDays(start, 6) };
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export type FilterableTimeEntry = {
  entryDate: string;
  startedAt: string;
  minutes: number;
  memo: string;
  billable: boolean;
  employeeId: number | null;
  firstName: string;
  projectId: number | null;
  projectName: string;
  /** Customer of the project, or `null` when the entry has no project or the project has no customer. */
  customerId: number | null;
  taskType: string;
};

export type TimeEntryFilter = {
  query: string;
  /** Employee id, `"none"` for entries without a person, or `null` for everyone. */
  person: number | "none" | null;
  /** Project id, `"none"` for entries without a project, or `null` for every project. */
  project: number | "none" | null;
  /** Customer id, `"none"` for entries without a customer, or `null` for every customer. */
  customer: number | "none" | null;
  taskType: TaskType | "";
  billable: "" | "yes" | "no";
};

/** Time entries narrowed by free text, person, project, customer, task type, and billable flag. */
export function filterTimeEntries<T extends FilterableTimeEntry>(entries: readonly T[], filter: TimeEntryFilter): T[] {
  const needle = normalize(filter.query.trim());
  return entries.filter((entry) => {
    if (filter.person === "none") {
      if (entry.employeeId !== null) return false;
    } else if (filter.person !== null && entry.employeeId !== filter.person) {
      return false;
    }
    if (filter.project === "none") {
      if (entry.projectId !== null) return false;
    } else if (filter.project !== null && entry.projectId !== filter.project) {
      return false;
    }
    if (filter.customer === "none") {
      if (entry.customerId !== null) return false;
    } else if (filter.customer !== null && entry.customerId !== filter.customer) {
      return false;
    }
    if (filter.taskType && entry.taskType !== filter.taskType) return false;
    if (filter.billable === "yes" && !entry.billable) return false;
    if (filter.billable === "no" && entry.billable) return false;
    if (!needle) return true;
    return normalize([entry.memo, entry.firstName, entry.projectName].join(" ")).includes(needle);
  });
}

export const TIME_ENTRY_SORTS = ["dateAsc", "dateDesc", "durationDesc", "durationAsc", "person", "project"] as const;

export type TimeEntrySort = (typeof TIME_ENTRY_SORTS)[number];

export const DEFAULT_TIME_ENTRY_SORT: TimeEntrySort = "dateAsc";

function byEntryTime(left: FilterableTimeEntry, right: FilterableTimeEntry): number {
  return left.entryDate.localeCompare(right.entryDate) || left.startedAt.localeCompare(right.startedAt);
}

/** Time entries in the chosen order. Ties fall back to the day and start time. */
export function sortTimeEntries<T extends FilterableTimeEntry>(entries: readonly T[], sort: TimeEntrySort): T[] {
  return [...entries].sort((left, right) => {
    switch (sort) {
      case "dateDesc":
        return byEntryTime(right, left);
      case "durationDesc":
        return right.minutes - left.minutes || byEntryTime(left, right);
      case "durationAsc":
        return left.minutes - right.minutes || byEntryTime(left, right);
      case "person":
        return left.firstName.localeCompare(right.firstName) || byEntryTime(left, right);
      case "project":
        return left.projectName.localeCompare(right.projectName) || byEntryTime(left, right);
      default:
        return byEntryTime(left, right);
    }
  });
}

export const TASK_SORTS = ["status", "dueAsc", "dueDesc", "title", "project"] as const;

export type TaskSort = (typeof TASK_SORTS)[number];

export const DEFAULT_TASK_SORT: TaskSort = "status";

export type FilterableTask = {
  title: string;
  notes: string;
  area: string;
  status: string;
  taskType: string;
  dueDate: string | null;
  projectId: number | null;
  projectName: string;
};

export type TaskFilter = {
  query: string;
  /** `""` for every status, otherwise `open`, `doing`, or `done`. */
  status: string;
  /** Project id, `"none"` for tasks without a project, or `null` for every project. */
  project: number | "none" | null;
  /** `""` for every area. */
  area: string;
  taskType: TaskType | "";
};

/** Tasks narrowed by free text, status, project, area, and task type. */
export function filterTasks<T extends FilterableTask>(tasks: readonly T[], filter: TaskFilter): T[] {
  const needle = normalize(filter.query.trim());
  return tasks.filter((task) => {
    if (filter.status && task.status !== filter.status) return false;
    if (filter.project === "none") {
      if (task.projectId !== null) return false;
    } else if (filter.project !== null && task.projectId !== filter.project) {
      return false;
    }
    if (filter.area && task.area !== filter.area) return false;
    if (filter.taskType && task.taskType !== filter.taskType) return false;
    if (!needle) return true;
    return normalize([task.title, task.notes, task.projectName].join(" ")).includes(needle);
  });
}

function taskStatusRank(status: string): number {
  return status === "done" ? 2 : status === "doing" ? 1 : 0;
}

/** Tasks in the chosen order. Open work first, undated tasks last, ties by title. */
export function sortTasks<T extends FilterableTask>(tasks: readonly T[], sort: TaskSort): T[] {
  return [...tasks].sort((left, right) => {
    switch (sort) {
      case "dueAsc":
        return (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31") || left.title.localeCompare(right.title);
      case "dueDesc":
        return (right.dueDate ?? "0000-01-01").localeCompare(left.dueDate ?? "0000-01-01") || left.title.localeCompare(right.title);
      case "title":
        return left.title.localeCompare(right.title);
      case "project":
        return left.projectName.localeCompare(right.projectName) || (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31");
      default:
        return taskStatusRank(left.status) - taskStatusRank(right.status)
          || (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31")
          || left.title.localeCompare(right.title);
    }
  });
}


