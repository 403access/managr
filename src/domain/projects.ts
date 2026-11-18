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
};

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