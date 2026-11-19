"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
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

const LANGUAGE_CODES = ["de", "en"] as const;

const LANGUAGE_LABEL_KEYS = { de: "lang.de", en: "lang.en" } as const;

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t: translate } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(code: (typeof LANGUAGE_CODES)[number]) {
    setOpen(false);
    setLocale(code);
  }

  if (!compact) {
    return (
      <div className="flex gap-1" role="group" aria-label={translate("lang.label")}>
        {LANGUAGE_CODES.map((code) => (
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

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={translate("lang.label")}
        title={translate("lang.label")}
        className={`inline-flex size-11 items-center justify-center rounded-full border text-sm font-medium ${
          open ? "border-pine/40 bg-white text-ink shadow-sm" : "border-line bg-card text-ink hover:border-ink"
        }`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {locale === "de" ? "DE" : "EN"}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={translate("lang.label")}
          className="absolute bottom-0 left-full z-50 ml-2 w-40 overflow-hidden rounded-2xl border border-line bg-card p-1.5 shadow-xl shadow-ink/10"
        >
          {LANGUAGE_CODES.map((code) => {
            const current = locale === code;
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={current}
                onClick={() => choose(code)}
                className={`flex min-h-9 w-full items-center gap-2 rounded-xl px-2.5 text-left text-sm transition ${
                  current ? "bg-pine/10 font-medium" : "hover:bg-white"
                }`}
              >
                <span
                  className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                    current ? "bg-pine text-paper" : "bg-ink/5 text-ink"
                  }`}
                >
                  {code === "de" ? "DE" : "EN"}
                </span>
                <span className="min-w-0 flex-1 truncate">{translate(LANGUAGE_LABEL_KEYS[code])}</span>
                {current ? (
                  <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-pine" aria-hidden="true">
                    <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
