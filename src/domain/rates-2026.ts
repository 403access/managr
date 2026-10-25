/**
 * Operative 2026 figures. Docs name these constants and do not restate them.
 * Social-security values follow the GKV-Spitzenverband Rechengrößen sheet for 1 January 2026.
 * The minijob ceiling is the statutory wage formula, not a second copied number.
 */

export const RATE_YEAR = 2026;

/** €13.90 per hour, in cents. */
export const MINIMUM_WAGE_CENTS = 1390;

/**
 * §8 Abs. 1a SGB IV: minimum wage × 130 / 3, rounded up to a whole euro.
 */
export function derivedMinijobLimitCents(minimumWageCents: number): number {
  const euros = Math.floor((minimumWageCents * 130 + 299) / 300);
  return euros * 100;
}

export const MINIJOB_LIMIT_CENTS = derivedMinijobLimitCents(MINIMUM_WAGE_CENTS);
export const TRANSITION_UPPER_CENTS = 200_000;

/** Published Faktor F. 6619 / 10000 = 0.6619. */
export const FAKTOR_F_NUMERATOR = 6619;
export const FAKTOR_F_DENOMINATOR = 10000;

export const KV_GENERAL_BPS = 1460;
export const KV_EMPLOYEE_BPS = 730;
export const KV_EMPLOYER_BPS = 730;
export const ADDITIONAL_KV_AVERAGE_BPS = 290;
export const PV_BPS = 360;
export const PV_EMPLOYEE_BPS = 180;
export const PV_EMPLOYER_BPS = 180;
export const PV_SAXONY_EMPLOYEE_BPS = 230;
export const PV_SAXONY_EMPLOYER_BPS = 130;
export const PV_CHILDLESS_BPS = 60;
export const PV_CHILD_DISCOUNT_BPS = 25;
export const RV_BPS = 1860;
export const RV_EMPLOYEE_BPS = 930;
export const RV_EMPLOYER_BPS = 930;
export const AV_BPS = 260;
export const AV_EMPLOYEE_BPS = 130;
export const AV_EMPLOYER_BPS = 130;
export const INSOLVENCY_BPS = 15;

/** Monthly contribution ceilings, in cents. */
export const KV_CEILING_CENTS = 581_250;
export const RV_CEILING_CENTS = 845_000;
/** Annual compulsory health-insurance threshold (JAEG). */
export const JAEG_CENTS = 7_740_000;

export const MINIJOB_RV_EMPLOYER_BPS = 1500;
export const MINIJOB_KV_EMPLOYER_BPS = 1300;
export const MINIJOB_RV_EMPLOYEE_BPS = 360;
export const MINIJOB_FLAT_TAX_BPS = 200;

export const KST_BPS = 1500;
export const SOLI_OF_KST_BPS = 550;
export const GEWST_MESSZAHL_BPS = 350;

export const GMBH_MINIMUM_CAPITAL_CENTS = 2_500_000;
export const RESERVE_NUMERATOR = 1;
export const RESERVE_DENOMINATOR = 4;

export const KLEIN_PRIOR_CENTS = 2_500_000;
export const KLEIN_CURRENT_CENTS = 10_000_000;
export const KLEIN_FOUNDING_CENTS = 2_500_000;

export const STANDARD_VAT_BPS = 1900;
export const REDUCED_VAT_BPS = 700;

/** Average total rate used to publish Faktor F: KV general + average Zusatzbeitrag + PV + RV + AV. */
export const AVERAGE_TOTAL_SV_BPS =
  KV_GENERAL_BPS + ADDITIONAL_KV_AVERAGE_BPS + PV_BPS + RV_BPS + AV_BPS;
