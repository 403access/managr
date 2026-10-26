import type { Locale } from "./locale";
import { de, en, type MessageKey } from "./messages";
import { translatePhrase } from "./phrases";

export type { Locale, MessageKey };
export { parseLocale, LOCALES, LOCALE_COOKIE } from "./locale";
export { label, monthName } from "./labels";

const catalogs = { de, en };

export function fill(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

export function t(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  return fill(catalogs[locale][key], vars);
}

export function tx(locale: Locale, text: string): string {
  return translatePhrase(locale, text);
}
