"use client";

import type { FilingCheck, FilingSeverity } from "@/domain/tax-filing";
import { useI18n } from "./locale-provider";
import { Card, Pill } from "./ui";

const TONE: Record<FilingSeverity, string> = { block: "stop", warn: "watch", info: "open" };

export function TaxCheckList({ checks, compact = false }: { checks: FilingCheck[]; compact?: boolean }) {
  const { tx, label } = useI18n();
  if (checks.length === 0) return null;
  return (
    <div className={compact ? "grid gap-1" : "grid gap-2"}>
      {checks.map((check) => (
        <Card key={`${check.code}-${check.message}`} className={compact ? "flex flex-wrap items-start gap-2 py-2" : ""}>
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={TONE[check.severity]}>{label(check.severity)}</Pill>
            <span className="text-xs text-muted">{check.code}</span>
          </span>
          <p className={compact ? "text-sm" : "mt-2 text-sm"}>{tx(check.message)}</p>
        </Card>
      ))}
    </div>
  );
}