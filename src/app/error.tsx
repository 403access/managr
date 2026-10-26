"use client";

import { useI18n } from "@/components/locale-provider";
import { buttonClass } from "@/components/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t, tx } = useI18n();
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-display text-3xl">{t("error.title")}</h1>
      <p className="mt-3 text-sm text-muted">{error.message ? tx(error.message) : t("error.body")}</p>
      <button type="button" className={`${buttonClass()} mt-6`} onClick={reset}>
        {t("error.tryAgain")}
      </button>
    </main>
  );
}
