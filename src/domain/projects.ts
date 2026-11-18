export const PROJECT_STATUSES = ["active", "done", "paused"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type ProjectFilter = {
  query: string;
  status: ProjectStatus | "";
  /** Customer id, `"none"` for projects without a customer, or `null` for every customer. */
  customer: number | "none" | null;
};

export type FilterableProject = {
  name: string;
  status: string;
  notes: string | null;
  customerId: number | null;
  customerName: string | null;
  endedOn: string | null;
};

export const PROJECT_GROUPINGS = ["customer", "none", "deadline"] as const;

export type ProjectGrouping = (typeof PROJECT_GROUPINGS)[number];

export const DEFAULT_PROJECT_GROUPING: Exclude<ProjectGrouping, "none"> = "customer";

export type ProjectGroup<T extends FilterableProject> =
  | { kind: "customer"; key: string; customerId: number | null; name: string | null; projects: T[] }
  | { kind: "deadline"; key: string; month: string | null; projects: T[] };

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function searchText(project: FilterableProject): string {
  return normalize([project.name, project.customerName ?? "", project.notes ?? ""].join(" "));
}

/** Projects narrowed by a free-text query, status, and customer. */
export function filterProjects<T extends FilterableProject>(projects: readonly T[], filter: ProjectFilter): T[] {
  const needle = normalize(filter.query.trim());
  return projects.filter((project) => {
    if (filter.status && project.status !== filter.status) return false;
    if (filter.customer === "none") {
      if (project.customerId !== null) return false;
    } else if (filter.customer !== null && project.customerId !== filter.customer) {
      return false;
    }
    return !needle || searchText(project).includes(needle);
  });
}

function byName<T extends FilterableProject>(left: T, right: T): number {
  return left.name.localeCompare(right.name);
}

export const PROJECT_SORTS = ["name", "startedDesc", "startedAsc", "deadlineAsc", "minutesDesc"] as const;

export type ProjectSort = (typeof PROJECT_SORTS)[number];

export const DEFAULT_PROJECT_SORT: ProjectSort = "name";

export type SortableProject = FilterableProject & {
  startedOn: string;
  minutes: number;
};

/** Projects in the chosen order. Ties fall back to the project name. */
export function sortProjects<T extends SortableProject>(projects: readonly T[], sort: ProjectSort): T[] {
  return [...projects].sort((left, right) => {
    switch (sort) {
      case "startedDesc":
        return right.startedOn.localeCompare(left.startedOn) || byName(left, right);
      case "startedAsc":
        return left.startedOn.localeCompare(right.startedOn) || byName(left, right);
      case "deadlineAsc":
        return (left.endedOn ?? "9999-12-31").localeCompare(right.endedOn ?? "9999-12-31") || byName(left, right);
      case "minutesDesc":
        return right.minutes - left.minutes || byName(left, right);
      default:
        return byName(left, right);
    }
  });
}

/**
 * Groups projects by customer or by the month of their end date. Projects without a
 * customer or without an end date form the last group. The order inside each group is
 * the input order, so sort the projects first. No grouping is the caller's job.
 */
export function groupProjects<T extends FilterableProject>(
  projects: readonly T[],
  grouping: Exclude<ProjectGrouping, "none">,
): ProjectGroup<T>[] {
  if (grouping === "customer") {
    const buckets = new Map<string, T[]>();
    for (const project of projects) {
      const key = project.customerId === null ? "none" : String(project.customerId);
      buckets.set(key, [...(buckets.get(key) ?? []), project]);
    }
    return [...buckets.entries()]
      .map(([key, members]) => ({
        kind: "customer" as const,
        key,
        customerId: members[0]?.customerId ?? null,
        name: members[0]?.customerName ?? null,
        projects: members,
      }))
      .sort((left, right) => {
        if (left.customerId === null) return right.customerId === null ? 0 : 1;
        if (right.customerId === null) return -1;
        return (left.name ?? "").localeCompare(right.name ?? "");
      });
  }

  const buckets = new Map<string, T[]>();
  for (const project of projects) {
    const key = project.endedOn ? project.endedOn.slice(0, 7) : "none";
    buckets.set(key, [...(buckets.get(key) ?? []), project]);
  }
  return [...buckets.entries()]
    .map(([key, members]) => ({
      kind: "deadline" as const,
      key,
      month: key === "none" ? null : key,
      projects: members,
    }))
    .sort((left, right) => {
      if (left.month === null) return right.month === null ? 0 : 1;
      if (right.month === null) return -1;
      return left.month.localeCompare(right.month);
    });
}