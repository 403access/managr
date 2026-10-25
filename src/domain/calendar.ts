export function parseIso(isoDate: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) throw new Error(`Bad date ${isoDate}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    throw new Error(`Bad date ${isoDate}`);
  }
  return { y, m, d };
}

export function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function toUtcDate(isoDate: string): Date {
  const { y, m, d } = parseIso(isoDate);
  return new Date(Date.UTC(y, m - 1, d));
}

export function fromUtc(date: Date): string {
  return iso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function todayIso(now = new Date()): string {
  return iso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addDays(isoDate: string, days: number): string {
  const date = toUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

export function addMonths(isoDate: string, months: number): string {
  const { y, m, d } = parseIso(isoDate);
  const index = m - 1 + months;
  const year = y + Math.floor(index / 12);
  const monthIndex = ((index % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return iso(year, monthIndex + 1, Math.min(d, last));
}

/** Last day of the month that is `months` after the month of `isoDate`. */
export function endOfLaterMonth(isoDate: string, months: number): string {
  const { y, m } = parseIso(isoDate);
  const index = m - 1 + months;
  const year = y + Math.floor(index / 12);
  const monthIndex = ((index % 12) + 12) % 12;
  const last = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return iso(year, monthIndex + 1, last);
}

export function isWeekend(isoDate: string): boolean {
  const day = toUtcDate(isoDate).getUTCDay();
  return day === 0 || day === 6;
}

export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

/** Nationwide holidays. State-only holidays are intentionally absent. */
export function federalHolidays(year: number): string[] {
  const easter = easterSunday(year);
  return [
    iso(year, 1, 1),
    addDays(easter, -2),
    addDays(easter, 1),
    iso(year, 5, 1),
    addDays(easter, 39),
    addDays(easter, 50),
    iso(year, 10, 3),
    iso(year, 12, 25),
    iso(year, 12, 26),
  ];
}

export function rollForwardBusinessDay(isoDate: string): string {
  let cursor = isoDate;
  for (let guard = 0; guard < 14; guard += 1) {
    const year = parseIso(cursor).y;
    const closed = new Set([...federalHolidays(year), ...federalHolidays(year + 1)]);
    if (!isWeekend(cursor) && !closed.has(cursor)) return cursor;
    cursor = addDays(cursor, 1);
  }
  throw new Error(`Could not roll ${isoDate} onto a business day.`);
}

export function thirdLastBankingDay(year: number, month: number): string {
  let cursor = iso(year, month, new Date(Date.UTC(year, month, 0)).getUTCDate());
  let seen = 0;
  for (let guard = 0; guard < 31; guard += 1) {
    const closed = new Set(federalHolidays(parseIso(cursor).y));
    if (!isWeekend(cursor) && !closed.has(cursor)) {
      seen += 1;
      if (seen === 3) return cursor;
    }
    cursor = addDays(cursor, -1);
  }
  throw new Error(`No banking day in ${year}-${month}`);
}

export function formatDate(isoDate: string): string {
  const { y, m, d } = parseIso(isoDate);
  return new Intl.DateTimeFormat("de-DE", { timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export type Recurrence = "none" | "monthly" | "quarterly" | "yearly";

export function nextDueDate(isoDate: string, recurrence: Recurrence): string | null {
  if (recurrence === "none") return null;
  const months = recurrence === "monthly" ? 1 : recurrence === "quarterly" ? 3 : 12;
  return addMonths(isoDate, months);
}

export function fiscalYearContaining(isoDate: string, startMonth: number): { start: string; end: string; label: string } {
  if (startMonth < 1 || startMonth > 12) throw new Error("Financial year must start in months 1 to 12.");
  const { y, m } = parseIso(isoDate);
  const startYear = m >= startMonth ? y : y - 1;
  const start = iso(startYear, startMonth, 1);
  const end = addDays(addMonths(start, 12), -1);
  const label = startMonth === 1 ? String(startYear) : `${startYear}/${String(startYear + 1).slice(2)}`;
  return { start, end, label };
}
