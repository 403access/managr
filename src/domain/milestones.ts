export const MILESTONE_STATUSES = ["planned", "active", "achieved", "missed"] as const;

export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

/** A goal that is still being worked on. Achieved and missed are closed. */
export const OPEN_MILESTONE_STATUSES: readonly MilestoneStatus[] = ["planned", "active"];

export const MILESTONE_CATEGORIES = ["growth", "revenue", "product", "team", "operations", "compliance", "other"] as const;

export type MilestoneCategory = (typeof MILESTONE_CATEGORIES)[number];

export const DEFAULT_MILESTONE_STATUS: MilestoneStatus = "planned";
export const DEFAULT_MILESTONE_CATEGORY: MilestoneCategory = "other";

export function isMilestoneStatus(value: string): value is MilestoneStatus {
  return (MILESTONE_STATUSES as readonly string[]).includes(value);
}

export function isMilestoneCategory(value: string): value is MilestoneCategory {
  return (MILESTONE_CATEGORIES as readonly string[]).includes(value);
}

function statusOf(value: string): MilestoneStatus {
  return isMilestoneStatus(value) ? value : DEFAULT_MILESTONE_STATUS;
}

function categoryOf(value: string): MilestoneCategory {
  return isMilestoneCategory(value) ? value : DEFAULT_MILESTONE_CATEGORY;
}

export function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(100, Math.max(0, Math.round(progress)));
}

/** Achieved goals always read as 100 %, whatever the stored number says. */
export function milestoneProgress(milestone: { status: string; progress: number }): number {
  return statusOf(milestone.status) === "achieved" ? 100 : clampProgress(milestone.progress);
}

export function milestoneIsOpen(milestone: { status: string }): boolean {
  return OPEN_MILESTONE_STATUSES.includes(statusOf(milestone.status));
}

/** A goal whose target date has passed without being achieved. Marking it missed does not hide this. */
export function milestoneIsOverdue(milestone: { status: string; targetDate: string }, today: string): boolean {
  return statusOf(milestone.status) !== "achieved" && milestone.targetDate < today;
}

export function milestoneYear(milestone: { targetDate: string }): number {
  return Number(milestone.targetDate.slice(0, 4));
}

export function quarterOf(targetDate: string): number {
  const month = Number(targetDate.slice(5, 7));
  return Math.min(4, Math.max(1, Math.ceil(month / 3)));
}

export type MilestoneShape = {
  category: string;
  status: string;
  targetDate: string;
  progress: number;
  companyIds: readonly number[];
};

export type FilterableMilestone = MilestoneShape & {
  title: string;
  description: string;
};

export type MilestoneFilter = {
  query: string;
  status: MilestoneStatus | "";
  category: MilestoneCategory | "";
  /** Company id, `"none"` for group-wide goals, or `null` for every goal. */
  company: number | "none" | null;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function searchText(milestone: FilterableMilestone): string {
  return normalize([milestone.title, milestone.description].join(" "));
}

/** Goals narrowed by a free-text query, status, category, and company. */
export function filterMilestones<T extends FilterableMilestone>(milestones: readonly T[], filter: MilestoneFilter): T[] {
  const needle = normalize(filter.query.trim());
  return milestones.filter((milestone) => {
    if (filter.status && statusOf(milestone.status) !== filter.status) return false;
    if (filter.category && categoryOf(milestone.category) !== filter.category) return false;
    if (filter.company === "none") {
      if (milestone.companyIds.length > 0) return false;
    } else if (filter.company !== null && !milestone.companyIds.includes(filter.company)) {
      return false;
    }
    return !needle || searchText(milestone).includes(needle);
  });
}

export function sortMilestones<T extends { targetDate: string; title: string }>(milestones: readonly T[]): T[] {
  return [...milestones].sort((left, right) => left.targetDate.localeCompare(right.targetDate) || left.title.localeCompare(right.title));
}

export type MilestoneQuarterGroup<T> = {
  key: string;
  year: number;
  quarter: number;
  milestones: T[];
};

/** Groups goals by target quarter, earliest first. The input order is kept inside a quarter. */
export function groupMilestonesByQuarter<T extends { targetDate: string }>(milestones: readonly T[]): MilestoneQuarterGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const milestone of milestones) {
    const key = `${milestone.targetDate.slice(0, 4)}-Q${quarterOf(milestone.targetDate)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), milestone]);
  }
  return [...buckets.entries()]
    .map(([key, members]) => ({
      key,
      year: Number(key.slice(0, 4)),
      quarter: Number(key.slice(6)),
      milestones: members,
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export type MilestoneStatusCounts = Record<MilestoneStatus, number>;

export type MilestoneCategoryRow = {
  category: MilestoneCategory;
  total: number;
  achieved: number;
  open: number;
  overdue: number;
  averageProgress: number;
};

export type MilestoneQuarterRow = {
  quarter: number;
  total: number;
  achieved: number;
  open: number;
  overdue: number;
  averageProgress: number;
};

export type MilestoneAnalysis = {
  year: number;
  total: number;
  byStatus: MilestoneStatusCounts;
  open: number;
  achieved: number;
  overdue: number;
  averageProgress: number;
  achievementRate: number;
  categories: MilestoneCategoryRow[];
  quarters: MilestoneQuarterRow[];
};

function averageProgress(milestones: readonly { status: string; progress: number }[]): number {
  if (milestones.length === 0) return 0;
  const sum = milestones.reduce((total, milestone) => total + milestoneProgress(milestone), 0);
  return Math.round(sum / milestones.length);
}

function rollup(milestones: readonly MilestoneShape[], today: string) {
  return {
    total: milestones.length,
    achieved: milestones.filter((milestone) => statusOf(milestone.status) === "achieved").length,
    open: milestones.filter((milestone) => milestoneIsOpen(milestone)).length,
    overdue: milestones.filter((milestone) => milestoneIsOverdue(milestone, today)).length,
    averageProgress: averageProgress(milestones),
  };
}

/** Figures for one target year. Milestones of other years are ignored. */
export function analyzeMilestones(
  milestones: readonly MilestoneShape[],
  year: number,
  today: string,
): MilestoneAnalysis {
  const scoped = milestones.filter((milestone) => milestoneYear(milestone) === year);
  const byStatus: MilestoneStatusCounts = { planned: 0, active: 0, achieved: 0, missed: 0 };
  for (const milestone of scoped) byStatus[statusOf(milestone.status)] += 1;
  const totals = rollup(scoped, today);

  const categories = MILESTONE_CATEGORIES.flatMap((category) => {
    const members = scoped.filter((milestone) => categoryOf(milestone.category) === category);
    if (members.length === 0) return [];
    return [{ category, ...rollup(members, today) }];
  });

  const quarters = [1, 2, 3, 4].map((quarter) => ({
    quarter,
    ...rollup(scoped.filter((milestone) => quarterOf(milestone.targetDate) === quarter), today),
  }));

  return {
    year,
    ...totals,
    byStatus,
    achievementRate: totals.total > 0 ? Math.round((totals.achieved / totals.total) * 100) : 0,
    categories,
    quarters,
  };
}

export type MilestoneCompany = { id: number; name: string };

export type MilestoneCompanyRow = {
  /** `null` is the group-wide row for goals without a company. */
  id: number | null;
  name: string;
  total: number;
  achieved: number;
  open: number;
  overdue: number;
  averageProgress: number;
};

/**
 * One row per company plus a group-wide row when goals without a company exist.
 * Companies with no goal in the year stay in the list with zeros, so a gap is visible.
 */
export function analyzeMilestonesByCompany(
  milestones: readonly MilestoneShape[],
  companies: readonly MilestoneCompany[],
  year: number,
  today: string,
): MilestoneCompanyRow[] {
  const scoped = milestones.filter((milestone) => milestoneYear(milestone) === year);
  const rows: MilestoneCompanyRow[] = companies.map((company) => ({
    id: company.id,
    name: company.name,
    ...rollup(scoped.filter((milestone) => milestone.companyIds.includes(company.id)), today),
  }));
  const groupWide = scoped.filter((milestone) => milestone.companyIds.length === 0);
  if (groupWide.length > 0) {
    rows.push({ id: null, name: "", ...rollup(groupWide, today) });
  }
  return rows.sort((left, right) => {
    if (left.id === null) return right.id === null ? 0 : 1;
    if (right.id === null) return -1;
    return left.name.localeCompare(right.name);
  });
}

/** Target years that actually carry a goal, earliest first. */
export function milestoneYears(milestones: readonly { targetDate: string }[]): number[] {
  return [...new Set(milestones.map(milestoneYear))].sort((left, right) => left - right);
}