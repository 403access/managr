import { describe, expect, it } from "vitest";
import { journalImbalance } from "@/domain/accounts";
import { buildShareholderLoanDrawdown, buildShareholderLoanInterest, buildShareholderLoanRepayment } from "@/domain/postings";
import { loanInterestCents, loanOutstandingCents, reviewShareholderLoan } from "@/domain/shareholder-loan";

describe("shareholder loan balance", () => {
  it("adds a further drawdown and subtracts a repayment, while interest leaves the principal alone", () => {
    const movements = [
      { kind: "drawdown", amountCents: 100_000 },
      { kind: "drawdown", amountCents: 50_000 },
      { kind: "repayment", amountCents: 20_000 },
      { kind: "interest", amountCents: 1_000 },
    ];
    expect(loanOutstandingCents(100_000, movements)).toBe(130_000);
    expect(loanOutstandingCents(100_000, [])).toBe(100_000);
    expect(loanOutstandingCents(100_000, [{ kind: "repayment", amountCents: 150_000 }])).toBe(0);
  });

  it("suggests interest on the outstanding balance and rounds to the cent", () => {
    expect(loanInterestCents(100_000, 200)).toBe(2_000);
    expect(loanInterestCents(333_333, 275)).toBe(9_167);
    expect(loanInterestCents(100_000, 0)).toBe(0);
    expect(loanInterestCents(0, 200)).toBe(0);
  });
});

describe("shareholder loan review", () => {
  it("warns about an interest-free loan and a missing note", () => {
    const warnings = reviewShareholderLoan({ label: "Darlehen", outstandingCents: 100_000, interestBps: 0, hasNotes: false }).warnings;
    expect(warnings.join(" ")).toMatch(/no interest/);
    expect(warnings.join(" ")).toMatch(/no note/);
  });

  it("keeps a documented, interest-bearing loan quiet and notes a repaid loan", () => {
    expect(reviewShareholderLoan({ label: "Darlehen", outstandingCents: 100_000, interestBps: 200, hasNotes: true }).warnings).toEqual([]);
    expect(reviewShareholderLoan({ label: "Darlehen", outstandingCents: 0, interestBps: 200, hasNotes: true }).warnings.join(" ")).toMatch(/fully repaid/);
  });
});

describe("shareholder loan postings", () => {
  it("posts a balanced drawdown, repayment, and interest entry", () => {
    expect(journalImbalance(buildShareholderLoanDrawdown(100_000))).toBeNull();
    expect(journalImbalance(buildShareholderLoanRepayment(40_000))).toBeNull();
    expect(journalImbalance(buildShareholderLoanInterest(2_000, true))).toBeNull();
    expect(journalImbalance(buildShareholderLoanInterest(2_000, false))).toBeNull();
  });

  it("refuses a non-positive amount", () => {
    expect(() => buildShareholderLoanDrawdown(0)).toThrow(/positive/);
    expect(() => buildShareholderLoanRepayment(0)).toThrow(/positive/);
    expect(() => buildShareholderLoanInterest(0, true)).toThrow(/positive/);
  });
});