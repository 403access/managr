import { GMBH_MINIMUM_CAPITAL_CENTS, RESERVE_DENOMINATOR, RESERVE_NUMERATOR } from "./rates-2026";

export function reserveDutyActive(shareCapitalCents: number): boolean {
  return shareCapitalCents < GMBH_MINIMUM_CAPITAL_CENTS;
}

export function requiredReserveCents(input: {
  annualSurplusCents: number;
  lossCarryforwardCents: number;
  shareCapitalCents: number;
}): number {
  if (!reserveDutyActive(input.shareCapitalCents)) return 0;
  const base = input.annualSurplusCents - Math.max(0, input.lossCarryforwardCents);
  if (base <= 0) return 0;
  return Math.round((base * RESERVE_NUMERATOR) / RESERVE_DENOMINATOR);
}

export function conversionGap(shareCapitalCents: number, reserveCents: number): {
  targetCents: number;
  coveredCents: number;
  gapCents: number;
  dutyActive: boolean;
} {
  const coveredCents = shareCapitalCents + Math.max(0, reserveCents);
  return {
    targetCents: GMBH_MINIMUM_CAPITAL_CENTS,
    coveredCents,
    gapCents: Math.max(0, GMBH_MINIMUM_CAPITAL_CENTS - coveredCents),
    dutyActive: reserveDutyActive(shareCapitalCents),
  };
}
