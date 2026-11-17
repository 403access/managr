"use client";

import Link from "next/link";
import { useI18n } from "./locale-provider";
import { buttonClass } from "./ui";

export function PrintReportButton({ backHref, year }: { backHref: string; year: number }) {
  const { t } = useI18n();
  return (
    <div className="no-print mb-6 flex flex-wrap gap-2">
      <button type="button" className={buttonClass()} onClick={() => window.print()}>
        {t("analytics.reportPrintable")}
      </button>
      <Link href={backHref} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm">
        {t("analytics.reportBack")}
      </Link>
      <span className="inline-flex min-h-11 items-center text-xs text-muted">{t("analytics.reportScope", { year })}</span>
    </div>
  );
}