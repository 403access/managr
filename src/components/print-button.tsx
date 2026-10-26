"use client";

import Link from "next/link";
import { useI18n } from "./locale-provider";
import { buttonClass } from "./ui";

export function PrintButton({ invoiceId }: { invoiceId: number }) {
  const { t } = useI18n();
  return (
    <>
      <button type="button" className={`${buttonClass()} no-print`} onClick={() => window.print()}>
        {t("common.print")}
      </button>
      <Link href={`/invoices/${invoiceId}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm no-print">
        {t("common.back")}
      </Link>
    </>
  );
}
