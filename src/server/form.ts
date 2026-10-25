import { parseEuroToCents, parseQuantityMilli } from "@/domain/money";

export type ActionState = { error: string; message: string };

export const initialState: ActionState = { error: "", message: "" };

export function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export function euros(formData: FormData, name: string): number | null {
  return parseEuroToCents(text(formData, name));
}

export function checked(formData: FormData, name: string): boolean {
  const value = formData.get(name);
  return value === "on" || value === "true" || value === "1";
}

/** Percent fields reuse the two-decimal parser: "2,90" is 290 basis points and "100" is 10000. */
export function basisPoints(formData: FormData, name: string): number | null {
  return euros(formData, name);
}

export function wholeNumber(formData: FormData, name: string): number | null {
  const raw = text(formData, name);
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

export function hoursToMinutes(raw: string): number | null {
  const milli = parseQuantityMilli(raw);
  if (milli === null) return null;
  return Math.round((milli * 60) / 1000);
}

export function requireDate(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} needs a date.`);
  return value;
}
