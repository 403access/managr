"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { label, monthName, t, tx, type Locale, type MessageKey, LOCALE_COOKIE } from "@/i18n";

type I18n = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  tx: (text: string) => string;
  label: (code: string) => string;
  monthName: (month: number) => string;
};

const LocaleContext = createContext<I18n | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const [current, setCurrent] = useState(locale);
  useEffect(() => {
    setCurrent(locale);
  }, [locale]);

  const value: I18n = {
    locale: current,
    setLocale: (next) => {
      if (next === current) return;
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=34560000; samesite=lax`;
      setCurrent(next);
      router.refresh();
    },
    t: (key, vars) => t(current, key, vars),
    tx: (text) => tx(current, text),
    label: (code) => label(current, code),
    monthName: (month) => monthName(current, month),
  };

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("LocaleProvider is missing.");
  return value;
}

export function LanguageSwitch() {
  const { locale, setLocale, t: translate } = useI18n();
  return (
    <div className="flex gap-1" role="group" aria-label={translate("lang.label")}>
      {(["de", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={locale === code}
          className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm font-medium ${locale === code ? "bg-pine text-paper" : "border border-line bg-card text-ink"}`}
          onClick={() => setLocale(code)}
        >
          {code === "de" ? "DE" : "EN"}
        </button>
      ))}
    </div>
  );
}
