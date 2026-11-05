"use client";

import { useState, useTransition } from "react";
import { checkInvoiceXRechnung } from "@/server/xrechnung-check";
import type { CheckResult } from "@/server/validator-report";
import { useI18n } from "./locale-provider";
import { buttonClass, Pill } from "./ui";

export function XRechnungCheck({ invoiceId }: { invoiceId: number }) {
  const { t, tx } = useI18n();
  const [result, setResult] = useState<CheckResult | null>(null);
  const [pending, startTransition] = useTransition();

  const check = () => {
    startTransition(async () => {
      try {
        setResult(await checkInvoiceXRechnung(invoiceId));
      } catch {
        setResult({ state: "unavailable" });
      }
    });
  };

  const checked = result?.state === "checked" ? result : null;
  const conformant = checked ? checked.valid && checked.accepted : false;
  const errors = checked?.messages.filter((message) => message.level === "error").length ?? 0;
  const warnings = checked?.messages.filter((message) => message.level === "warning").length ?? 0;
  const details = checked?.messages.filter((message) => message.level !== "information") ?? [];

  return (
    <>
      <button type="button" onClick={check} disabled={pending} className={buttonClass("quiet")}>
        {pending ? t("invoices.checking") : t("invoices.checkXrechnung")}
      </button>
      {result ? (
        <div className="grid basis-full gap-2 text-sm" aria-live="polite">
          {result.state === "blocked" ? (
            <ul className="grid gap-1 text-amber">
              {result.blockers.map((blocker) => (
                <li key={blocker}>{tx(blocker)}</li>
              ))}
            </ul>
          ) : result.state === "unavailable" ? (
            <p className="text-clay">{t("invoices.checkUnavailable")}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={conformant ? "paid" : "void"}>
                  {conformant ? t("invoices.checkValid") : t("invoices.checkInvalid")}
                </Pill>
                <span className="text-muted">{t("invoices.checkSummary", { errors, warnings })}</span>
              </div>
              {details.length > 0 ? (
                <ul className="grid gap-1">
                  {details.map((message, index) => (
                    <li key={`${message.code}-${index}`} className="leading-relaxed">
                      {message.code ? <span className="font-mono text-xs text-muted">{message.code} </span> : null}
                      <span className={message.level === "error" ? "text-clay" : undefined}>{message.text}</span>
                    </li>
                  ))}
                </ul>
              ) : !conformant ? (
                <p className="text-muted">{t("invoices.checkNoDetails")}</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
