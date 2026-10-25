import { describe, expect, it } from "vitest";
import { estimateContributions, transitionBases, type SocialInput } from "@/domain/social";

const base: SocialInput = {
  grossMonthlyCents: 300_000,
  kind: "regular",
  ownershipBps: 0,
  svStatus: "subject",
  stateCode: "BE",
  additionalKvBps: 290,
  childlessSurcharge: false,
  careDiscountSteps: 0,
  minijobPublicHealth: true,
  pensionOptOut: false,
  flatTax: true,
};

describe("social insurance 2026", () => {
  it("splits a regular wage under both ceilings", () => {
    const estimate = estimateContributions(base);
    expect(estimate.regime).toBe("regular");
    expect(estimate.employee).toMatchObject({
      healthCents: 21_900,
      additionalHealthCents: 4_350,
      careCents: 5_400,
      pensionCents: 27_900,
      unemploymentCents: 3_900,
    });
    expect(estimate.employer.healthCents).toBe(21_900);
    expect(estimate.employer.insolvencyCents).toBe(450);
    expect(estimate.payoutCents).toBe(300_000 - estimate.employee.totalCents);
  });

  it("caps health and pension on different ceilings", () => {
    const estimate = estimateContributions({ ...base, grossMonthlyCents: 900_000 });
    expect(estimate.employee.healthCents).toBe(42_431);
    expect(estimate.employee.pensionCents).toBe(78_585);
    expect(estimate.employer.insolvencyCents).toBe(1_268);
  });

  it("puts the childless care surcharge and the Saxony split on the employee", () => {
    const childless = estimateContributions({ ...base, childlessSurcharge: true });
    expect(childless.employee.careCents).toBe(5_400 + 1_800);
    expect(childless.employer.careCents).toBe(5_400);
    const saxony = estimateContributions({ ...base, stateCode: "SN", childlessSurcharge: true, careDiscountSteps: 1 });
    expect(saxony.employee.careCents).toBe(Math.round((300_000 * 230) / 10_000) - Math.round((300_000 * 25) / 10_000) + 1_800);
    expect(saxony.employer.careCents).toBe(Math.round((300_000 * 130) / 10_000));
  });

  it("matches the published midijob bases and the employee share at €1,200", () => {
    expect(transitionBases(120_000)).toEqual({ totalCents: 108_325, employeeCents: 85_469 });
    expect(transitionBases(200_000)).toEqual({ totalCents: 200_000, employeeCents: 200_000 });
    const estimate = estimateContributions({ ...base, grossMonthlyCents: 120_000, kind: "regular" });
    expect(estimate.regime).toBe("midijob");
    expect(estimate.employee.totalCents - estimate.employee.insolvencyCents).toBe(18_076);
    expect(estimate.employee).toMatchObject({
      healthCents: 6_239,
      additionalHealthCents: 1_239,
      careCents: 1_538,
      pensionCents: 7_949,
      unemploymentCents: 1_111,
    });
    expect(estimate.employer.insolvencyCents).toBe(180);
  });

  it("uses minijob flats at the ceiling and not above it", () => {
    const minijob = estimateContributions({ ...base, grossMonthlyCents: 45_000, kind: "minijob" });
    expect(minijob.regime).toBe("minijob");
    expect(minijob.employer.pensionCents).toBe(6_750);
    expect(minijob.employer.healthCents).toBe(5_850);
    expect(minijob.employer.flatTaxCents).toBe(900);
    expect(minijob.employee.pensionCents).toBe(1_620);
    expect(minijob.employer.insolvencyCents).toBe(0);
    const crossed = estimateContributions({ ...base, grossMonthlyCents: 70_000, kind: "minijob" });
    expect(crossed.regime).toBe("midijob");
    expect(crossed.warnings.some((warning) => warning.includes("minijob ceiling"))).toBe(true);
  });

  it("does not insure a controlling shareholder-director through payroll", () => {
    const founder = estimateContributions({
      ...base,
      kind: "managing_director",
      ownershipBps: 10_000,
      svStatus: "automatic",
      grossMonthlyCents: 320_000,
    });
    expect(founder.regime).toBe("exempt");
    expect(founder.employee.totalCents).toBe(0);
    expect(founder.employer.totalCents).toBe(0);
  });

  it("keeps apprentices on the regular formula inside the transition band", () => {
    const apprentice = estimateContributions({ ...base, kind: "apprentice", grossMonthlyCents: 120_000 });
    expect(apprentice.regime).toBe("regular");
    expect(apprentice.employee.pensionCents).toBe(Math.round((120_000 * 930) / 10_000));
  });
});
