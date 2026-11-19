/**
 * Hourly rates cascade from the most specific record to the widest:
 * a time entry overrides its project, a project overrides its customer, and a
 * customer overrides the company default. A `null` or missing value inherits.
 */
export const RATE_SOURCES = ["entry", "project", "customer", "global"] as const;

export type RateSource = (typeof RATE_SOURCES)[number];

export type RateLevels = {
  entryCents?: number | null;
  projectCents?: number | null;
  customerCents?: number | null;
  globalCents?: number | null;
};

export type EffectiveRate = {
  /** Euro cents per hour. */
  cents: number;
  /** The level the rate came from. */
  source: RateSource;
};

function isRate(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** The rate that applies, or `null` when no level stores one. */
export function effectiveHourlyRate(levels: RateLevels): EffectiveRate | null {
  if (isRate(levels.entryCents)) return { cents: levels.entryCents, source: "entry" };
  if (isRate(levels.projectCents)) return { cents: levels.projectCents, source: "project" };
  if (isRate(levels.customerCents)) return { cents: levels.customerCents, source: "customer" };
  if (isRate(levels.globalCents)) return { cents: levels.globalCents, source: "global" };
  return null;
}

/**
 * The value of booked time at an hourly rate, rounded to the cent.
 * Fractional minutes are accepted; invalid or negative input is worth zero.
 */
export function timeValueCents(minutes: number, hourlyRateCents: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0 || !isRate(hourlyRateCents)) return 0;
  return Math.round((minutes * hourlyRateCents) / 60);
}