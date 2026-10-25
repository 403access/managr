import { percentOf } from "./money";
import {
  ADDITIONAL_KV_AVERAGE_BPS,
  AV_BPS,
  AV_EMPLOYEE_BPS,
  AV_EMPLOYER_BPS,
  FAKTOR_F_DENOMINATOR,
  FAKTOR_F_NUMERATOR,
  INSOLVENCY_BPS,
  JAEG_CENTS,
  KV_CEILING_CENTS,
  KV_EMPLOYEE_BPS,
  KV_EMPLOYER_BPS,
  KV_GENERAL_BPS,
  MINIJOB_FLAT_TAX_BPS,
  MINIJOB_KV_EMPLOYER_BPS,
  MINIJOB_LIMIT_CENTS,
  MINIJOB_RV_EMPLOYEE_BPS,
  MINIJOB_RV_EMPLOYER_BPS,
  PV_BPS,
  PV_CHILD_DISCOUNT_BPS,
  PV_CHILDLESS_BPS,
  PV_EMPLOYEE_BPS,
  PV_EMPLOYER_BPS,
  PV_SAXONY_EMPLOYEE_BPS,
  PV_SAXONY_EMPLOYER_BPS,
  RV_BPS,
  RV_CEILING_CENTS,
  RV_EMPLOYEE_BPS,
  RV_EMPLOYER_BPS,
  TRANSITION_UPPER_CENTS,
} from "./rates-2026";

export type EmploymentKind = "regular" | "minijob" | "midijob" | "apprentice" | "managing_director";
export type SvStatus = "automatic" | "subject" | "exempt";
export type PayRegime = "regular" | "midijob" | "minijob" | "exempt";

export type SocialInput = {
  grossMonthlyCents: number;
  kind: EmploymentKind;
  ownershipBps: number;
  svStatus: SvStatus;
  stateCode: string;
  additionalKvBps: number;
  childlessSurcharge: boolean;
  careDiscountSteps: number;
  minijobPublicHealth: boolean;
  pensionOptOut: boolean;
  flatTax: boolean;
};

export type ContributionSide = {
  healthCents: number;
  additionalHealthCents: number;
  careCents: number;
  pensionCents: number;
  unemploymentCents: number;
  insolvencyCents: number;
  flatTaxCents: number;
  totalCents: number;
};

export type ContributionEstimate = {
  regime: PayRegime;
  grossCents: number;
  employee: ContributionSide;
  employer: ContributionSide;
  payoutCents: number;
  employerCashCents: number;
  warnings: string[];
};

function emptySide(): ContributionSide {
  return {
    healthCents: 0,
    additionalHealthCents: 0,
    careCents: 0,
    pensionCents: 0,
    unemploymentCents: 0,
    insolvencyCents: 0,
    flatTaxCents: 0,
    totalCents: 0,
  };
}

function withTotal(side: ContributionSide): ContributionSide {
  return {
    ...side,
    totalCents:
      side.healthCents +
      side.additionalHealthCents +
      side.careCents +
      side.pensionCents +
      side.unemploymentCents +
      side.insolvencyCents +
      side.flatTaxCents,
  };
}

function divRound(numerator: bigint, denominator: bigint): number {
  return Number((numerator + denominator / 2n) / denominator);
}

/** The two §20 Abs. 2a SGB IV assessment bases, in cents. */
export function transitionBases(grossCents: number): { totalCents: number; employeeCents: number } {
  const gross = BigInt(grossCents);
  const floor = BigInt(MINIJOB_LIMIT_CENTS);
  const ceiling = BigInt(TRANSITION_UPPER_CENTS);
  const span = ceiling - floor;
  const factor = BigInt(FAKTOR_F_NUMERATOR);
  const factorDen = BigInt(FAKTOR_F_DENOMINATOR);
  const above = gross - floor;
  const totalNumerator = factor * floor * span + (ceiling * factorDen - floor * factor) * above;
  return {
    totalCents: divRound(totalNumerator, factorDen * span),
    employeeCents: divRound(ceiling * above, span),
  };
}

function splitAdditional(bps: number): { employee: number; employer: number } {
  const employee = Math.floor(bps / 2);
  return { employee, employer: bps - employee };
}

export function estimateContributions(input: SocialInput): ContributionEstimate {
  if (!Number.isInteger(input.grossMonthlyCents) || input.grossMonthlyCents < 0) {
    throw new Error("Monthly gross must be whole cents.");
  }
  const warnings: string[] = [];
  const controlling = input.kind === "managing_director" && input.ownershipBps > 5000;
  if (input.svStatus === "exempt" || (input.svStatus === "automatic" && controlling)) {
    if (controlling && input.svStatus !== "exempt") {
      warnings.push(
        "Treated as not socially insured because this managing director holds more than half the shares. That is the usual outcome, not a Statusfeststellung.",
      );
    }
    warnings.push("Health and long-term care are arranged privately or as voluntary statutory cover, outside payroll.");
    const employee = emptySide();
    const employer = emptySide();
    return {
      regime: "exempt",
      grossCents: input.grossMonthlyCents,
      employee,
      employer,
      payoutCents: input.grossMonthlyCents,
      employerCashCents: input.grossMonthlyCents,
      warnings,
    };
  }

  if (input.kind === "managing_director" && input.ownershipBps <= 5000 && input.svStatus === "automatic") {
    warnings.push("A managing director with half the shares or less is often an employee for social insurance. Confirm a Statusfeststellung.");
  }

  let regime: PayRegime;
  if (input.kind === "apprentice") {
    regime = "regular";
    warnings.push("Apprentices stay on the normal contribution formula. The Midijob reduction does not apply.");
  } else if (input.grossMonthlyCents <= MINIJOB_LIMIT_CENTS) {
    regime = "minijob";
  } else if (input.grossMonthlyCents <= TRANSITION_UPPER_CENTS) {
    regime = "midijob";
  } else {
    regime = "regular";
  }

  if (input.kind === "minijob" && regime !== "minijob") {
    warnings.push("Pay is above the minijob ceiling, so this estimate leaves the flat minijob rates.");
  }
  if (input.kind === "midijob" && regime === "regular") {
    warnings.push("Pay is above the Übergangsbereich, so both sides pay the normal shares.");
  }
  if (regime === "regular" && input.grossMonthlyCents * 12 > JAEG_CENTS) {
    warnings.push("Annual pay is above the compulsory health-insurance threshold. Private cover may be possible. This estimate still uses the statutory formula.");
  }

  if (regime === "minijob") return minijobEstimate(input, warnings);
  if (regime === "midijob") return bandEstimate(input, warnings, true);
  return bandEstimate(input, warnings, false);
}

function bandEstimate(input: SocialInput, warnings: string[], midijob: boolean): ContributionEstimate {
  const kvCap = Math.min(input.grossMonthlyCents, KV_CEILING_CENTS);
  const rvCap = Math.min(input.grossMonthlyCents, RV_CEILING_CENTS);
  const additional = input.additionalKvBps > 0 ? input.additionalKvBps : ADDITIONAL_KV_AVERAGE_BPS;
  const additionalSplit = splitAdditional(additional);
  const saxony = input.stateCode === "SN";
  const careEmployeeRate = saxony ? PV_SAXONY_EMPLOYEE_BPS : PV_EMPLOYEE_BPS;
  const careEmployerRate = saxony ? PV_SAXONY_EMPLOYER_BPS : PV_EMPLOYER_BPS;
  const discountSteps = Math.min(4, Math.max(0, input.careDiscountSteps));
  const discountBps = discountSteps * PV_CHILD_DISCOUNT_BPS;

  const bases = midijob
    ? transitionBases(input.grossMonthlyCents)
    : { totalCents: input.grossMonthlyCents, employeeCents: input.grossMonthlyCents };
  const healthTotalBase = Math.min(bases.totalCents, KV_CEILING_CENTS);
  const healthEmployeeBase = Math.min(bases.employeeCents, KV_CEILING_CENTS);
  const pensionTotalBase = Math.min(bases.totalCents, RV_CEILING_CENTS);
  const pensionEmployeeBase = Math.min(bases.employeeCents, RV_CEILING_CENTS);

  const employee = emptySide();
  const employer = emptySide();

  if (midijob) {
    employee.healthCents = percentOf(healthEmployeeBase, KV_EMPLOYEE_BPS);
    employee.additionalHealthCents = percentOf(healthEmployeeBase, additionalSplit.employee);
    employer.healthCents = percentOf(healthTotalBase, KV_GENERAL_BPS) - employee.healthCents;
    employer.additionalHealthCents = percentOf(healthTotalBase, additional) - employee.additionalHealthCents;

    const careCore = percentOf(healthEmployeeBase, careEmployeeRate);
    const careDiscount = percentOf(healthEmployeeBase, discountBps);
    const childless = input.childlessSurcharge ? percentOf(healthTotalBase, PV_CHILDLESS_BPS) : 0;
    employer.careCents = percentOf(healthTotalBase, PV_BPS) - careCore;
    employee.careCents = Math.max(0, careCore - careDiscount) + childless;

    employee.pensionCents = percentOf(pensionEmployeeBase, RV_EMPLOYEE_BPS);
    employer.pensionCents = percentOf(pensionTotalBase, RV_BPS) - employee.pensionCents;
    employee.unemploymentCents = percentOf(pensionEmployeeBase, AV_EMPLOYEE_BPS);
    employer.unemploymentCents = percentOf(pensionTotalBase, AV_BPS) - employee.unemploymentCents;
  } else {
    employee.healthCents = percentOf(kvCap, KV_EMPLOYEE_BPS);
    employer.healthCents = percentOf(kvCap, KV_EMPLOYER_BPS);
    employee.additionalHealthCents = percentOf(kvCap, additionalSplit.employee);
    employer.additionalHealthCents = percentOf(kvCap, additionalSplit.employer);
    const childless = input.childlessSurcharge ? percentOf(kvCap, PV_CHILDLESS_BPS) : 0;
    const careDiscount = percentOf(kvCap, discountBps);
    employee.careCents = Math.max(0, percentOf(kvCap, careEmployeeRate) - careDiscount) + childless;
    employer.careCents = percentOf(kvCap, careEmployerRate);
    employee.pensionCents = percentOf(rvCap, RV_EMPLOYEE_BPS);
    employer.pensionCents = percentOf(rvCap, RV_EMPLOYER_BPS);
    employee.unemploymentCents = percentOf(rvCap, AV_EMPLOYEE_BPS);
    employer.unemploymentCents = percentOf(rvCap, AV_EMPLOYER_BPS);
  }

  employer.insolvencyCents = percentOf(rvCap, INSOLVENCY_BPS);
  const employeeSide = withTotal(employee);
  const employerSide = withTotal(employer);
  return {
    regime: midijob ? "midijob" : "regular",
    grossCents: input.grossMonthlyCents,
    employee: employeeSide,
    employer: employerSide,
    payoutCents: input.grossMonthlyCents - employeeSide.totalCents,
    employerCashCents: input.grossMonthlyCents + employerSide.totalCents,
    warnings,
  };
}

/**
 * Figures for one payroll journal. Flat tax stays out of employer social so it is not posted twice.
 * Minijob wage tax is the flat, so a typed wage-tax amount is ignored.
 * A socially exempt salary can still withhold wage tax.
 */
export function payrollAmounts(estimate: ContributionEstimate, wageTaxCents: number): {
  minijob: boolean;
  withheldCents: number;
  wageTaxCents: number;
  employerSocialCents: number;
  flatTaxCents: number;
} {
  if (!Number.isInteger(wageTaxCents) || wageTaxCents < 0) throw new Error("Wage tax must be whole cents.");
  const employerSocialCents = estimate.employer.totalCents - estimate.employer.flatTaxCents;
  if (estimate.regime === "minijob") {
    return {
      minijob: true,
      withheldCents: estimate.employee.totalCents,
      wageTaxCents: 0,
      employerSocialCents,
      flatTaxCents: estimate.employer.flatTaxCents,
    };
  }
  if (estimate.regime === "exempt") {
    return { minijob: false, withheldCents: 0, wageTaxCents, employerSocialCents: 0, flatTaxCents: 0 };
  }
  return {
    minijob: false,
    withheldCents: estimate.employee.totalCents,
    wageTaxCents,
    employerSocialCents,
    flatTaxCents: 0,
  };
}

function minijobEstimate(input: SocialInput, warnings: string[]): ContributionEstimate {
  const employee = emptySide();
  const employer = emptySide();
  employer.pensionCents = percentOf(input.grossMonthlyCents, MINIJOB_RV_EMPLOYER_BPS);
  if (input.minijobPublicHealth) employer.healthCents = percentOf(input.grossMonthlyCents, MINIJOB_KV_EMPLOYER_BPS);
  if (!input.pensionOptOut) employee.pensionCents = percentOf(input.grossMonthlyCents, MINIJOB_RV_EMPLOYEE_BPS);
  if (input.flatTax) employer.flatTaxCents = percentOf(input.grossMonthlyCents, MINIJOB_FLAT_TAX_BPS);
  if (input.pensionOptOut) {
    warnings.push("Pension opt-out is on. The employee pays no pension flat, and pension credit is only the employer flat.");
  }
  const employeeSide = withTotal(employee);
  const employerSide = withTotal(employer);
  return {
    regime: "minijob",
    grossCents: input.grossMonthlyCents,
    employee: employeeSide,
    employer: employerSide,
    payoutCents: input.grossMonthlyCents - employeeSide.totalCents,
    employerCashCents: input.grossMonthlyCents + employerSide.totalCents,
    warnings,
  };
}
