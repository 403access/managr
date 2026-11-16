export type DirectorSalaryInput = {
  kind: string;
  ownershipBps: number;
  shareholderLinked: boolean;
  /** Earliest shareholder resolution of kind `salary` that names this person, or null. */
  salaryResolutionDate: string | null;
  startDate: string;
  grossMonthlyCents: number;
};

/**
 * A shareholder-director is not a normal employee: the salary has to be agreed in advance,
 * it has to be arm's length, and an excessive salary is a hidden profit distribution (vGA).
 * These are reminders. managr cannot judge appropriateness and does not block a payout.
 */
export function reviewDirectorSalary(input: DirectorSalaryInput): { warnings: string[] } {
  if (input.kind !== "managing_director") return { warnings: [] };
  const warnings: string[] = [];
  if (input.ownershipBps > 0 && !input.shareholderLinked) {
    warnings.push("This managing director holds shares but is not linked to a shareholder record. Link them so salary, payout, and resolution stay together.");
  }
  if (input.salaryResolutionDate === null) {
    warnings.push("No shareholder resolution fixes this salary. Agree it before it is paid and record the resolution; a retroactive agreement can be a hidden profit distribution.");
  } else if (input.salaryResolutionDate > input.startDate) {
    warnings.push("The salary resolution is dated after the salary began. A retroactive agreement is treated as a hidden profit distribution.");
  }
  warnings.push("Check that the salary is arm's length. A salary an unrelated managing director would not get can be a hidden profit distribution to the extent of the excess, and that excess is not a business expense.");
  return { warnings };
}