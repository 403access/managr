export type TrashKind =
  | "shareholder"
  | "policy"
  | "invoice"
  | "salary_change"
  | "absence"
  | "project"
  | "milestone"
  | "task"
  | "time"
  | "deadline"
  | "tax-filing"
  | "document"
  | "director_contract"
  | "founder_health"
  | "contact";

export type TrashEntry = {
  kind: TrashKind;
  id: number;
  label: string;
  detail: string;
  deletedAt: string;
};

export const TRASH_KINDS: TrashKind[] = [
  "shareholder",
  "policy",
  "invoice",
  "salary_change",
  "absence",
  "project",
  "milestone",
  "task",
  "time",
  "deadline",
  "tax-filing",
  "document",
  "director_contract",
  "founder_health",
  "contact",
];