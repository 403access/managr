import { describe, expect, it } from "vitest";
import { nextSalaryChange, salaryForMonth } from "@/domain/salary";

const contract = 320_000;
const periods = [
  { validFrom: "2026-04-01", grossMonthlyCents: 340_000 },
  { validFrom: "2026-01-01", grossMonthlyCents: 330_000 },
  { validFrom: "2027-01-01", grossMonthlyCents: 360_000 },
];

describe("salary schedule", () => {
  it("falls back to the contract gross before the first change", () => {
    expect(salaryForMonth([], contract, "2026-03")).toBe(contract);
    expect(salaryForMonth(periods, contract, "2025-12")).toBe(contract);
  });

  it("applies the latest change that is not after the month", () => {
    expect(salaryForMonth(periods, contract, "2026-01")).toBe(330_000);
    expect(salaryForMonth(periods, contract, "2026-03")).toBe(330_000);
    expect(salaryForMonth(periods, contract, "2026-04")).toBe(340_000);
    expect(salaryForMonth(periods, contract, "2027-01")).toBe(360_000);
  });

  it("takes an unsorted list and a change dated inside a month as that month", () => {
    expect(salaryForMonth([{ validFrom: "2026-05-17", grossMonthlyCents: 400_000 }], contract, "2026-05")).toBe(400_000);
    expect(salaryForMonth([...periods].reverse(), contract, "2026-06")).toBe(340_000);
  });

  it("names the next change after the month and rejects a malformed month", () => {
    expect(nextSalaryChange(periods, "2026-02")).toEqual({ validFrom: "2026-04-01", grossMonthlyCents: 340_000 });
    expect(nextSalaryChange(periods, "2026-06")).toEqual({ validFrom: "2027-01-01", grossMonthlyCents: 360_000 });
    expect(nextSalaryChange(periods, "2027-02")).toBeNull();
    expect(() => salaryForMonth(periods, contract, "2026-3")).toThrow(/YYYY-MM/);
  });
});