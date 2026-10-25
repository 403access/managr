import { parseIso } from "./calendar";
import { percentOf } from "./money";
import {
  GEWST_MESSZAHL_BPS,
  KLEIN_CURRENT_CENTS,
  KLEIN_FOUNDING_CENTS,
  KLEIN_PRIOR_CENTS,
  KST_BPS,
  SOLI_OF_KST_BPS,
} from "./rates-2026";

export type TaxEstimate = {
  taxableCents: number;
  corporateCents: number;
  soliCents: number;
  tradeCents: number;
  totalCents: number;
};

/**
 * Planning estimate. Profit before tax stands in for taxable income.
 * Gewerbesteuer is not deducted again inside Körperschaftsteuer, and a UG gets no Freibetrag.
 */
export function estimateCorporateTax(profitBeforeTaxCents: number, hebesatzPercent: number, lossCarryforwardCents: number): TaxEstimate {
  if (!Number.isInteger(hebesatzPercent) || hebesatzPercent < 0) throw new Error("Hebesatz must be a non-negative percent.");
  const taxableCents = Math.max(0, profitBeforeTaxCents - Math.max(0, lossCarryforwardCents));
  if (taxableCents === 0) {
    return { taxableCents: 0, corporateCents: 0, soliCents: 0, tradeCents: 0, totalCents: 0 };
  }
  const corporateCents = percentOf(taxableCents, KST_BPS);
  const soliCents = percentOf(corporateCents, SOLI_OF_KST_BPS);
  const messCents = percentOf(taxableCents, GEWST_MESSZAHL_BPS);
  const tradeCents = Math.round((messCents * hebesatzPercent) / 100);
  return {
    taxableCents,
    corporateCents,
    soliCents,
    tradeCents,
    totalCents: corporateCents + soliCents + tradeCents,
  };
}

export function kleinunternehmerAssessment(input: {
  foundingDate: string;
  calendarYear: number;
  priorYearTurnoverCents: number;
  currentYearTurnoverCents: number;
  claimsExemption: boolean;
}): { eligible: boolean; notes: string[] } {
  const foundingYear = parseIso(input.foundingDate).y;
  const foundingYearNow = foundingYear === input.calendarYear;
  const runningLimit = foundingYearNow ? KLEIN_FOUNDING_CENTS : KLEIN_CURRENT_CENTS;
  const notes: string[] = [];
  if (foundingYearNow) {
    notes.push("In the founding year this check uses the lower current-year ceiling.");
  }
  const priorOk = foundingYearNow || input.priorYearTurnoverCents <= KLEIN_PRIOR_CENTS;
  if (!priorOk) notes.push("Prior-year turnover is above the §19 ceiling, so the exemption does not apply this year.");
  const currentOk = input.currentYearTurnoverCents <= runningLimit;
  if (!currentOk) notes.push("Turnover has passed this year's ceiling. The exemption ends on the supply that crosses it.");
  const eligible = priorOk && currentOk;
  if (input.claimsExemption && !eligible) {
    notes.push("The company is marked as Kleinunternehmer, but these figures say the exemption does not apply.");
  }
  if (!input.claimsExemption && eligible) {
    notes.push("These figures would allow the §19 exemption. Charging VAT is a waiver. Confirm the binding period before switching.");
  }
  return { eligible, notes };
}
