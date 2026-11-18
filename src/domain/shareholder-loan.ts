export type ShareholderLoanMovementKind = "drawdown" | "repayment" | "interest";

export type ShareholderLoanMovement = {
  kind: string;
  amountCents: number;
};

/**
 * A drawdown raises what the company owes the shareholder; a repayment lowers it.
 * Interest is not principal and does not change the balance. The initial drawdown
 * is recorded as a movement too; `principalCents` is the fallback for a loan with
 * no movement rows.
 */
export function loanOutstandingCents(principalCents: number, movements: ShareholderLoanMovement[]): number {
  if (movements.length === 0) return Math.max(0, principalCents);
  let balance = 0;
  for (const movement of movements) {
    if (movement.kind === "drawdown") balance += movement.amountCents;
    if (movement.kind === "repayment") balance -= movement.amountCents;
  }
  return Math.max(0, balance);
}

/** Suggested interest for one period on the outstanding principal. */
export function loanInterestCents(outstandingCents: number, interestBps: number): number {
  if (outstandingCents <= 0 || interestBps <= 0) return 0;
  return Math.round((outstandingCents * interestBps) / 10_000);
}

export type ShareholderLoanReviewInput = {
  label: string;
  outstandingCents: number;
  interestBps: number;
  hasNotes: boolean;
};

/**
 * A shareholder loan is a financing arrangement, not salary. The desk records it;
 * it cannot decide whether the interest rate is arm's length.
 */
export function reviewShareholderLoan(input: ShareholderLoanReviewInput): { warnings: string[] } {
  const warnings: string[] = [];
  if (input.outstandingCents <= 0) {
    warnings.push("The loan is fully repaid.");
    return { warnings };
  }
  if (input.interestBps <= 0) {
    warnings.push(
      "The loan carries no interest. An interest-free loan from a shareholder can have tax consequences; confirm the treatment with an adviser.",
    );
  }
  if (!input.hasNotes) {
    warnings.push("The loan has no note. Record the purpose and the agreement so the paperwork can be traced.");
  }
  return { warnings };
}