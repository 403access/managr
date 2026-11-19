/** Read helpers and briefings never change the desk, so they run without a confirmation. */
const READ_ONLY_TOOL = /^read_/;
const NO_WRITE_TOOLS = new Set([
  "daily_briefing",
  "vat_overview",
  "monthly_close_checklist",
  "draft_dunning_letter",
  "web_search",
  "web_fetch",
  "update_plan",
  "check_xrechnung",
]);

export function needsApproval(name: string): boolean {
  return !READ_ONLY_TOOL.test(name) && !NO_WRITE_TOOLS.has(name);
}