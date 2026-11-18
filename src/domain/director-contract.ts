export type DirectorContractRecord = {
  signedOn: string;
  validFrom: string;
  grossMonthlyCents: number;
  endedOn: string | null;
};

export type DirectorContractReviewInput = {
  kind: string;
  ownershipBps: number;
  contract: DirectorContractRecord | null;
  employeeGrossCents: number;
  /** Dates of shareholder resolutions of kind `salary` that name this person. */
  salaryResolutionDates: string[];
  salaryChanges: { validFrom: string; grossMonthlyCents: number }[];
};

/**
 * A shareholder-director needs a written service contract with a fixed salary.
 * The contract and every later change must be agreed before they apply; a
 * retroactive agreement can be a hidden profit distribution (vGA).
 */
export function reviewDirectorContract(input: DirectorContractReviewInput): { warnings: string[] } {
  if (input.kind !== "managing_director") return { warnings: [] };
  const warnings: string[] = [];
  if (!input.contract) {
    warnings.push(
      "No written managing-director service contract is recorded. Fix the salary in writing before it is paid.",
    );
  } else {
    if (input.contract.signedOn > input.contract.validFrom) {
      warnings.push(
        "The service contract is dated after it starts. A retroactive agreement can be a hidden profit distribution.",
      );
    }
    if (input.contract.grossMonthlyCents !== input.employeeGrossCents) {
      warnings.push(
        "The contract's fixed monthly gross differs from the person's contract gross. Keep both figures the same, or explain the difference.",
      );
    }
    if (input.contract.grossMonthlyCents === 0) {
      warnings.push(
        "The service contract fixes no salary. That is allowed at the start; record a prospective change before pay begins.",
      );
    }
  }

  const resolutions = [...input.salaryResolutionDates].sort();
  for (const change of input.salaryChanges) {
    if (!resolutions.some((date) => date <= change.validFrom)) {
      warnings.push(
        `The salary change from ${change.validFrom} has no shareholder resolution dated on or before it. A retroactive agreement can be a hidden profit distribution.`,
      );
    }
  }
  return { warnings };
}

/** The contract that applies on a date. A later contract starts a new period. */
export function currentDirectorContract<T extends DirectorContractRecord>(contracts: T[], today: string): T | null {
  const applicable = contracts
    .filter((contract) => contract.validFrom <= today)
    .filter((contract) => contract.endedOn === null || contract.endedOn >= today)
    .sort((left, right) => left.validFrom.localeCompare(right.validFrom));
  return applicable.at(-1) ?? null;
}