import { parseQuantityMilli } from "@/domain/money";

export function euroInput(cents: number): string {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

export function quantityInput(milli: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(milli / 1000);
}

/** Decimal hours as whole hours and minutes for the two-field entry. */
export function quantityParts(quantity: string): { hours: string; minutes: string } {
  const milli = parseQuantityMilli(quantity);
  if (milli === null) return { hours: "", minutes: "" };
  const totalMinutes = Math.round((milli * 60) / 1000);
  return { hours: String(Math.floor(totalMinutes / 60)), minutes: String(totalMinutes % 60) };
}

/** Combines hours and minutes into the decimal quantity the invoice stores. */
export function quantityFromParts(hours: string, minutes: string): string {
  if (!hours.trim() && !minutes.trim()) return "";
  const hoursValue = hours.trim() ? Number(hours) : 0;
  const minutesValue = minutes.trim() ? Number(minutes) : 0;
  if (!Number.isFinite(hoursValue) || !Number.isFinite(minutesValue) || hoursValue < 0 || minutesValue < 0) return "";
  return quantityInput(Math.round(((hoursValue * 60 + minutesValue) * 1000) / 60));
}

export function percentInput(bps: number): string {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(bps / 100);
}

export function hoursInput(minutes: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(minutes / 60);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}
