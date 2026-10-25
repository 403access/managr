import { addDays, parseIso, toUtcDate } from "./calendar";

export function parseClock(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Use a time like 09:30.");
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error("Use a time like 09:30.");
  return hours * 60 + minutes;
}

export function durationMinutes(start: string, end: string, breakMinutes: number): number {
  const span = parseClock(end) - parseClock(start);
  if (span <= 0) throw new Error("End time must be after the start time on the same day.");
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes >= span) {
    throw new Error("The break must be shorter than the recorded span.");
  }
  return span - breakMinutes;
}

export type TimeWarning = { level: "stop" | "watch"; message: string };

export function timeWarnings(netMinutes: number, breakMinutes: number): TimeWarning[] {
  const warnings: TimeWarning[] = [];
  if (netMinutes > 600) warnings.push({ level: "stop", message: "Net working time is over 10 hours (§3 ArbZG)." });
  else if (netMinutes > 480) warnings.push({ level: "watch", message: "Above 8 hours. The average has to come back to 8 (§3 ArbZG)." });
  if (netMinutes > 540 && breakMinutes < 45) warnings.push({ level: "watch", message: "A day over 9 hours needs a 45-minute break (§4 ArbZG)." });
  else if (netMinutes > 360 && breakMinutes < 30) warnings.push({ level: "watch", message: "A day over 6 hours needs a 30-minute break (§4 ArbZG)." });
  return warnings;
}

export function minimumVacationDays(workdaysPerWeek: number): number {
  const days = Math.min(6, Math.max(1, Math.round(workdaysPerWeek)));
  return Math.round((24 * days) / 6);
}

export function vacationShortfall(entitlement: number, workdaysPerWeek: number): string | null {
  const minimum = minimumVacationDays(workdaysPerWeek);
  if (entitlement < minimum) return `Statutory minimum is ${minimum} days on a ${workdaysPerWeek}-day week (BUrlG).`;
  return null;
}

/**
 * Counts the first N weekdays, Monday first. A 5-day week is Monday to Friday.
 * It does not know a person's individual weekday pattern.
 */
export function countWorkdays(startIso: string, endIso: string, workdaysPerWeek: number): number {
  if (endIso < startIso) return 0;
  const openDays = Math.min(6, Math.max(1, Math.round(workdaysPerWeek)));
  let count = 0;
  let cursor = startIso;
  for (let guard = 0; guard < 400 && cursor <= endIso; guard += 1) {
    const sundayBased = toUtcDate(cursor).getUTCDay();
    const mondayBased = sundayBased === 0 ? 6 : sundayBased - 1;
    if (mondayBased < openDays) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

export function weekStart(isoDate: string): string {
  parseIso(isoDate);
  const sundayBased = toUtcDate(isoDate).getUTCDay();
  const mondayOffset = sundayBased === 0 ? 6 : sundayBased - 1;
  return addDays(isoDate, -mondayOffset);
}
