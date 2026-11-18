import { describe, expect, it } from "vitest";
import { currentDirectorContract, reviewDirectorContract, type DirectorContractReviewInput } from "@/domain/director-contract";

const base: DirectorContractReviewInput = {
  kind: "managing_director",
  ownershipBps: 10_000,
  contract: { signedOn: "2024-03-15", validFrom: "2024-03-15", grossMonthlyCents: 320_000, endedOn: null },
  employeeGrossCents: 320_000,
  salaryResolutionDates: ["2024-03-15"],
  salaryChanges: [],
};

function warnings(patch: Partial<DirectorContractReviewInput>): string[] {
  return reviewDirectorContract({ ...base, ...patch }).warnings;
}

describe("managing-director service contract", () => {
  it("accepts a contract that is signed when it starts and matches the fixed gross", () => {
    expect(warnings({})).toEqual([]);
  });

  it("asks for the written contract and flags a signature after the start", () => {
    expect(warnings({ contract: null }).join(" ")).toMatch(/No written managing-director service contract/);
    expect(warnings({ contract: { ...base.contract!, signedOn: "2024-06-01" } }).join(" ")).toMatch(/dated after it starts/);
  });

  it("flags a contract gross that differs from the person record and an unpaid start", () => {
    expect(warnings({ employeeGrossCents: 300_000 }).join(" ")).toMatch(/differs from the person's contract gross/);
    expect(warnings({ contract: { ...base.contract!, grossMonthlyCents: 0 }, employeeGrossCents: 0 }).join(" ")).toMatch(/fixes no salary/);
  });

  it("wants a shareholder resolution on or before every salary change", () => {
    const change = { validFrom: "2026-01-01", grossMonthlyCents: 340_000 };
    expect(warnings({ salaryChanges: [change], salaryResolutionDates: [] }).join(" ")).toMatch(/no shareholder resolution/);
    expect(warnings({ salaryChanges: [change], salaryResolutionDates: ["2025-12-01"] })).toEqual([]);
  });

  it("does not review anybody who is not a managing director", () => {
    expect(reviewDirectorContract({ ...base, kind: "regular", contract: null }).warnings).toEqual([]);
  });
});

describe("current contract", () => {
  const contracts = [
    { id: 1, signedOn: "2024-03-15", validFrom: "2024-03-15", grossMonthlyCents: 320_000, endedOn: "2025-12-31" },
    { id: 2, signedOn: "2025-12-01", validFrom: "2026-01-01", grossMonthlyCents: 340_000, endedOn: null },
    { id: 3, signedOn: "2027-12-01", validFrom: "2028-01-01", grossMonthlyCents: 360_000, endedOn: null },
  ];

  it("takes the contract that applies on the date, not a future one", () => {
    expect(currentDirectorContract(contracts, "2024-06-01")?.id).toBe(1);
    expect(currentDirectorContract(contracts, "2026-01-01")?.id).toBe(2);
    expect(currentDirectorContract(contracts, "2025-01-01")?.id).toBe(1);
  });

  it("returns null when no contract applies yet", () => {
    expect(currentDirectorContract([contracts[2]!], "2027-12-31")).toBeNull();
  });
});