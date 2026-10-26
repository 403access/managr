"use client";

import { LOCALE_COOKIE, parseLocale, t } from "@/i18n";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  const locale = parseLocale(typeof document === "undefined" ? null : document.cookie.split("; ").find((part) => part.startsWith(`${LOCALE_COOKIE}=`))?.split("=")[1]);
  return (
    <html lang={locale}>
      <body style={{ fontFamily: "sans-serif", padding: 24 }}>
        <h1>{t(locale, "error.globalTitle")}</h1>
        <button type="button" onClick={reset}>{t(locale, "error.tryAgain")}</button>
      </body>
    </html>
  );
}
