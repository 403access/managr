export type ChangeAction = "add" | "update" | "delete";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// save_* tools upsert. Only the entity's own id field means "update".
const SAVE_ID_KEYS: Record<string, string> = {
  save_customer: "customerId",
  save_project: "projectId",
  save_milestone: "milestoneId",
  save_director_contract: "personId",
  save_founder_health: "personId",
};

/** Whether a write adds a record, changes one, or removes one. */
export function changeAction(name: string, input: unknown): ChangeAction {
  if (name.startsWith("delete_")) return "delete";
  if (
    name.startsWith("update_") ||
    name.startsWith("set_") ||
    name.startsWith("complete_") ||
    name.startsWith("issue_") ||
    name.startsWith("switch_") ||
    name.startsWith("offset_") ||
    name.startsWith("void_")
  ) {
    return "update";
  }
  if (name.startsWith("save_")) {
    const key = SAVE_ID_KEYS[name];
    const id = key && isRecord(input) ? Number(input[key]) : Number.NaN;
    return Number.isFinite(id) && id > 0 ? "update" : "add";
  }
  return "add";
}