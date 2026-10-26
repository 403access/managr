"use client";

import { useState } from "react";
import { formatEuro, parseEuroToCents } from "@/domain/money";
import { requiredReserveCents, reserveDutyActive } from "@/domain/reserve";
import { useI18n } from "./locale-provider";
import { inputClass } from "./ui";

export function ReserveHint({ shareCapitalCents }: { shareCapitalCents: number }) {
  const { t } = useI18n();
  const [surplus, setSurplus] = useState("");
  const [loss, setLoss] = useState("");
  const surplusCents = parseEuroToCents(surplus);
  const lossCents = loss.trim() ? parseEuroToCents(loss) : 0;
  const ready = surplusCents !== null && lossCents !== null;
  const required = ready
    ? requiredReserveCents({ annualSurplusCents: surplusCents, lossCarryforwardCents: lossCents, shareCapitalCents })
    : null;
  const duty = reserveDutyActive(shareCapitalCents);

  return (
    <div className="grid gap-3">
      <p className="text-sm leading-relaxed text-muted">{duty ? t("reserve.on") : t("reserve.off")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{t("reserve.surplus")}</span>
          <input className={inputClass} inputMode="decimal" value={surplus} onChange={(event) => setSurplus(event.target.value)} placeholder="6.400,00" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">{t("reserve.loss")}</span>
          <input className={inputClass} inputMode="decimal" value={loss} onChange={(event) => setLoss(event.target.value)} placeholder="0,00" />
        </label>
      </div>
      {surplus.trim() && surplusCents === null ? <p className="text-sm text-clay">{t("reserve.surplusInvalid")}</p> : null}
      {loss.trim() && lossCents === null ? <p className="text-sm text-clay">{t("reserve.lossInvalid")}</p> : null}
      {required !== null ? <p className="text-sm">{t("reserve.quarter", { amount: formatEuro(required) })}</p> : null}
    </div>
  );
}
