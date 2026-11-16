import { describe, expect, it } from "vitest";
import { reviewDirectorSalary, type DirectorSalaryInput } from "@/domain/director-salary";

const base: DirectorSalaryInput = {
  kind: "managing_director",
  ownershipBps: 10_000,
  shareholderLinked: true,
  salaryResolutionDate: "2024-03-15",
  startDate: "2024-03-15",
  grossMonthlyCents: 320_000,
};

function warnings(patch: Partial<DirectorSalaryInput>): string[] {
  return reviewDirectorSalary({ ...base, ...patch }).warnings;
}

describe("shareholder-director salary review", () => {
  it("keeps the appropriateness reminder and nothing else when the agreement is in order", () => {
    const result = warnings({});
    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(/arm's length/);
  });

  it("asks for the shareholder link when the director holds shares", () => {
    expect(warnings({ shareholderLinked: false }).join(" ")).toMatch(/not linked to a shareholder record/);
  });

  it("asks for a resolution and names a retroactive one", () => {
    expect(warnings({ salaryResolutionDate: null }).join(" ")).toMatch(/No shareholder resolution/);
    expect(warnings({ salaryResolutionDate: "2024-06-01" }).join(" ")).toMatch(/dated after the salary began/);
  });

  it("does not review anybody who is not a managing director", () => {
    expect(reviewDirectorSalary({ ...base, kind: "regular" }).warnings).toEqual([]);
  });
});