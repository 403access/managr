export type FounderHealthKind = "private" | "voluntary_statutory";
export type StatusProcedure = "not_required" | "requested" | "completed";
export type StatusOutcome = "open" | "not_socially_insured" | "socially_insured";

export type FounderHealthRecord = {
  kind: string;
  provider: string;
  monthlyPremiumCents: number;
  startsOn: string;
  statusProcedure: string;
  statusOn: string | null;
  statusOutcome: string;
  notes: string;
};

export type FounderHealthReviewInput = {
  kind: string;
  ownershipBps: number;
  cover: FounderHealthRecord | null;
  startDate: string;
  today: string;
};

/**
 * A controlling shareholder-director is usually not socially insured, but that
 * is a default, not a Statusfeststellung. Health cover is private or voluntary
 * statutory and never a payroll deduction in this desk.
 */
export function reviewFounderHealth(input: FounderHealthReviewInput): { warnings: string[] } {
  if (input.kind !== "managing_director") return { warnings: [] };
  const warnings: string[] = [];
  if (!input.cover) {
    warnings.push(
      "No health cover is recorded for this managing director. Record private or voluntary statutory cover and its premium.",
    );
    return { warnings };
  }
  if (input.cover.monthlyPremiumCents <= 0) {
    warnings.push("The health cover has no monthly premium recorded.");
  }
  if (input.cover.statusProcedure === "requested" || input.cover.statusOutcome === "open") {
    warnings.push("The Statusfeststellungsverfahren is still open. Keep the outcome with the cover record.");
  }
  if (input.cover.statusProcedure === "completed" && !input.cover.statusOn) {
    warnings.push("The status procedure is marked completed but has no date.");
  }
  if (input.ownershipBps <= 5000 && input.cover.statusProcedure === "not_required") {
    warnings.push(
      "A managing director with half the shares or less often needs a Statusfeststellungsverfahren. Record whether it was requested or completed.",
    );
  }
  return { warnings };
}