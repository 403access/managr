import Link from "next/link";
import type { ReactNode } from "react";
import { formatDuration } from "@/components/amounts";

export type TimeBarRow = {
  key: string;
  label: string;
  minutes: number;
  productiveMinutes?: number;
  secondary?: string;
  href?: string;
};

export function TimeBarChart({ rows, empty, ariaLabel }: { rows: TimeBarRow[]; empty: string; ariaLabel: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  const max = Math.max(1, ...rows.map((row) => row.minutes));
  return (
    <div className="grid gap-3" role="group" aria-label={ariaLabel}>
      {rows.map((row) => {
        const productive = row.productiveMinutes ?? row.minutes;
        const rest = Math.max(0, row.minutes - productive);
        const label = (
          <>
            <span className="font-medium">{row.label}</span>
            <span className="font-mono text-muted tabular-nums">{formatDuration(row.minutes)}</span>
          </>
        );
        return (
          <div key={row.key} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              {row.href ? (
                <Link href={row.href} className="hover:text-pine">
                  {label}
                </Link>
              ) : (
                <span>{label}</span>
              )}
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-line/60">
              <span className="block bg-pine" style={{ width: `${(productive / max) * 100}%` }} />
              <span className="block bg-amber" style={{ width: `${(rest / max) * 100}%` }} />
            </div>
            {row.secondary ? <p className="text-xs text-muted">{row.secondary}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

export type MonthBar = {
  key: string;
  label: string;
  minutes: number;
  productiveMinutes: number;
  unproductiveMinutes: number;
};

export function MonthBarChart({ months, ariaLabel }: { months: MonthBar[]; ariaLabel: string }) {
  const max = Math.max(1, ...months.map((month) => month.minutes));
  return (
    <div role="img" aria-label={ariaLabel} className="overflow-x-auto">
      <div className="flex min-w-[32rem] items-end gap-1.5 pb-1">
        {months.map((month) => (
          <div key={month.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-36 w-full flex-col justify-end">
              <span className="w-full bg-amber" style={{ height: `${(month.unproductiveMinutes / max) * 100}%` }} title={formatDuration(month.unproductiveMinutes)} />
              <span className="w-full bg-pine" style={{ height: `${(month.productiveMinutes / max) * 100}%` }} title={formatDuration(month.productiveMinutes)} />
            </div>
            <span className="text-[11px] leading-none text-muted">{month.label}</span>
            <span className="font-mono text-[10px] leading-none text-muted tabular-nums">{month.minutes > 0 ? formatDuration(month.minutes) : "–"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export type StatusPart = { key: string; label: string; value: number; tone: "pine" | "moss" | "amber" | "muted" };

export function StatusBar({ parts, total }: { parts: StatusPart[]; total: number }) {
  const colors = { pine: "bg-pine", moss: "bg-moss", amber: "bg-amber", muted: "bg-ink/30" } as const;
  return (
    <div className="grid gap-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-line/60">
        {parts.map((part) => (
          <span
            key={part.key}
            className={colors[part.tone]}
            style={{ width: total > 0 ? `${(part.value / total) * 100}%` : "0%" }}
            title={`${part.label}: ${part.value}`}
          />
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {parts.map((part) => (
          <div key={part.key}>
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              <span className={`size-2 rounded-full ${colors[part.tone]}`} />
              {part.label}
            </dt>
            <dd className="font-mono text-lg tabular-nums">{part.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Legend({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-muted">{children}</p>;
}