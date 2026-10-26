export const LOCALES = ["de", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "managr-locale";

export function parseLocale(value: string | undefined | null): Locale {
  return value === "en" ? "en" : "de";
}
