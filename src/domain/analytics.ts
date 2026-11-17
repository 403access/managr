/**
 * Work classification for the project and time analysis.
 *
 * Productive means the work creates the delivered result: programming, design,
 * planning (including architecture), and research. Documentation, meetings,
 * communication, and administration are necessary but do not create the result,
 * so they count as unproductive time in the analysis. The bucket never changes
 * what was booked; it only groups the minutes.
 */
export const TASK_TYPES = [
  "development",
  "design",
  "planning",
  "research",
  "documentation",
  "meeting",
  "communication",
  "admin",
  "other",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export const PRODUCTIVE_TASK_TYPES: readonly TaskType[] = ["development", "design", "planning", "research"];

export function isTaskType(value: string): value is TaskType {
  return (TASK_TYPES as readonly string[]).includes(value);
}

export function isProductiveTaskType(value: string): boolean {
  return (PRODUCTIVE_TASK_TYPES as readonly string[]).includes(value);
}

export const PROJECT_STATUSES = ["active", "done", "paused"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export function isProjectStatus(value: string): value is ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(value);
}

export type ProjectTiming = {
  status: string;
  startedOn: string;
  endedOn: string | null;
};

export type ProjectCounts = {
  started: number;
  completed: number;
  active: number;
  paused: number;
};

/**
 * "Started" and "completed" are events in the selected year. "Active" and
 * "paused" describe the projects as they stand today, not a date in the past.
 */
export function projectCounts(projects: ProjectTiming[], year: number): ProjectCounts {
  const prefix = `${year}-`;
  return {
    started: projects.filter((project) => project.startedOn.startsWith(prefix)).length,
    completed: projects.filter((project) => (project.endedOn ?? "").startsWith(prefix)).length,
    active: projects.filter((project) => project.status === "active").length,
    paused: projects.filter((project) => project.status === "paused").length,
  };
}

export type WorkRow = {
  month: string;
  minutes: number;
  taskType: string;
  billable?: boolean;
};

export type WorkTotals = {
  minutes: number;
  productiveMinutes: number;
  unproductiveMinutes: number;
  billableMinutes: number;
};

export function emptyWorkTotals(): WorkTotals {
  return { minutes: 0, productiveMinutes: 0, unproductiveMinutes: 0, billableMinutes: 0 };
}

export function addWork(totals: WorkTotals, minutes: number, taskType: string, billable = false): WorkTotals {
  totals.minutes += minutes;
  if (isProductiveTaskType(taskType)) totals.productiveMinutes += minutes;
  else totals.unproductiveMinutes += minutes;
  if (billable) totals.billableMinutes += minutes;
  return totals;
}

export function workTotals(rows: WorkRow[]): WorkTotals {
  return rows.reduce((totals, row) => addWork(totals, row.minutes, row.taskType, row.billable), emptyWorkTotals());
}

export function sharePercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part * 100) / total);
}

export type MonthWork = {
  month: string;
  minutes: number;
  productiveMinutes: number;
  unproductiveMinutes: number;
  billableMinutes: number;
};

export function monthlyWork(rows: WorkRow[], year: number): MonthWork[] {
  const months = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  const byMonth = new Map<string, MonthWork>(
    months.map((month) => [month, { month, minutes: 0, productiveMinutes: 0, unproductiveMinutes: 0, billableMinutes: 0 }]),
  );
  for (const row of rows) {
    const bucket = byMonth.get(row.month);
    if (!bucket) continue;
    bucket.minutes += row.minutes;
    if (isProductiveTaskType(row.taskType)) bucket.productiveMinutes += row.minutes;
    else bucket.unproductiveMinutes += row.minutes;
    if (row.billable) bucket.billableMinutes += row.minutes;
  }
  return months.map((month) => byMonth.get(month)!);
}

export function taskTypeMinutes(rows: WorkRow[]): { taskType: string; minutes: number; productive: boolean }[] {
  const map = new Map<string, { taskType: string; minutes: number; productive: boolean }>();
  for (const row of rows) {
    const current = map.get(row.taskType) ?? {
      taskType: row.taskType,
      minutes: 0,
      productive: isProductiveTaskType(row.taskType),
    };
    current.minutes += row.minutes;
    map.set(row.taskType, current);
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes || a.taskType.localeCompare(b.taskType));
}