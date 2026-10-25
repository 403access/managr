"use client";

import { useState } from "react";
import { formatEuro, parseEuroToCents } from "@/domain/money";
import { requiredReserveCents, reserveDutyActive } from "@/domain/reserve";
import { inputClass } from "./ui";

export function ReserveHint({ shareCapitalCents }: { shareCapitalCents: number }) {
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
      <p className="text-sm leading-relaxed text-muted">
        {duty
          ? "The quarter below is a planning figure from the annual surplus. Post the amount that the adopted accounts actually use."
          : "Share capital in this record is already at the GmbH minimum, so the §5a allocation comes out at zero. Recording that number here is not the registration of a capital increase."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Annual surplus</span>
          <input className={inputClass} inputMode="decimal" value={surplus} onChange={(event) => setSurplus(event.target.value)} placeholder="6.400,00" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Loss carryforward</span>
          <input className={inputClass} inputMode="decimal" value={loss} onChange={(event) => setLoss(event.target.value)} placeholder="0,00" />
        </label>
      </div>
      {surplus.trim() && surplusCents === null ? <p className="text-sm text-clay">Enter the surplus in euros.</p> : null}
      {loss.trim() && lossCents === null ? <p className="text-sm text-clay">Enter the loss carryforward in euros.</p> : null}
      {required !== null ? <p className="text-sm">Statutory quarter: <span className="font-mono">{formatEuro(required)}</span></p> : null}
    </div>
  );
}
