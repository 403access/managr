import "server-only";

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { t, type MessageKey } from "@/i18n";
import { LOCALE_COOKIE, parseLocale, type Locale } from "@/i18n/locale";

export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  return parseLocale(jar.get(LOCALE_COOKIE)?.value);
}

export async function titled(key: MessageKey): Promise<Metadata> {
  return { title: t(await getLocale(), key) };
}
