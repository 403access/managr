"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, addMonths, formatDate, iso, parseIso, toUtcDate } from "@/domain/calendar";
import { weekStart } from "@/domain/time";
import { useI18n } from "@/components/locale-provider";

type Props = {
  from: string;
  to: string;
  today: string;
  onSelect: (from: string, to: string) => void;
};

/** A month grid that sets an inclusive range with two clicks. */
export function DateRangeCalendar({ from, to, today, onSelect }: Props) {
  const { t, locale, monthName } = useI18n();
  const [month, setMonth] = useState(() => from.slice(0, 7));
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    setMonth(from.slice(0, 7));
    setPending(null);
  }, [from, to]);

  const { y, m } = parseIso(`${month}-01`);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (toUtcDate(iso(y, m, 1)).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => iso(y, m, index + 1)),
  ];

  const weekdays = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { weekday: "short", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, index) => format.format(new Date(Date.UTC(2024, 0, 1 + index))));
  }, [locale]);

  const thisWeek = weekStart(today);
  const lastWeek = addDays(thisWeek, -7);
  const todayMonth = parseIso(today);
  const lastOfMonth = new Date(Date.UTC(todayMonth.y, todayMonth.m, 0)).getUTCDate();
  const presets = [
    { key: "today", label: t("time.presetToday"), from: today, to: today },
    { key: "thisWeek", label: t("time.presetThisWeek"), from: thisWeek, to: addDays(thisWeek, 6) },
    { key: "lastWeek", label: t("time.presetLastWeek"), from: lastWeek, to: addDays(lastWeek, 6) },
    {
      key: "thisMonth",
      label: t("time.presetThisMonth"),
      from: iso(todayMonth.y, todayMonth.m, 1),
      to: iso(todayMonth.y, todayMonth.m, lastOfMonth),
    },
  ];

  function shiftMonth(delta: number) {
    setMonth(addMonths(iso(y, m, 1), delta).slice(0, 7));
  }

  function pick(day: string) {
    if (pending === null) {
      setPending(day);
      return;
    }
    onSelect(pending <= day ? pending : day, pending <= day ? day : pending);
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("time.presetLabel")}>
        {presets.map((preset) => {
          const on = preset.from === from && preset.to === to;
          return (
            <button
              key={preset.key}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(preset.from, preset.to)}
              className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium ${
                on ? "border-pine bg-pine text-paper" : "border-line bg-white text-ink hover:border-ink"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={t("time.calendarPreviousMonth")}
          onClick={() => shiftMonth(-1)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-white text-lg text-ink hover:border-ink"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <p className="text-sm font-medium" aria-live="polite">{monthName(m)} {y}</p>
        <button
          type="button"
          aria-label={t("time.calendarNextMonth")}
          onClick={() => shiftMonth(1)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line bg-white text-lg text-ink hover:border-ink"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
      <div role="group" aria-label={monthName(m) + " " + y} className="mt-2 grid grid-cols-7 gap-1">
        {weekdays.map((weekday) => (
          <span key={weekday} className="pb-1 text-center text-[11px] font-medium tracking-wide text-muted uppercase">
            {weekday}
          </span>
        ))}
        {cells.map((day, index) => {
          if (day === null) return <span key={`empty-${index}`} aria-hidden="true" />;
          const selected = day >= from && day <= to;
          const endpoint = day === from || day === to;
          const ring = day === pending ? "ring-2 ring-amber" : day === today ? "ring-1 ring-ink/30" : "";
          return (
            <button
              key={day}
              type="button"
              aria-label={formatDate(day)}
              aria-pressed={selected}
              aria-current={day === today ? "date" : undefined}
              onClick={() => pick(day)}
              className={`flex h-10 items-center justify-center rounded-lg text-sm tabular-nums transition ${ring} ${
                endpoint
                  ? "bg-pine font-medium text-paper"
                  : selected
                    ? "bg-pine/10 text-pine"
                    : "text-ink hover:bg-ink/5"
              }`}
            >
              {Number(day.slice(8, 10))}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted" aria-live="polite">
        {pending
          ? t("time.rangePickEnd")
          : t("time.rangeSelected", { from: formatDate(from), to: formatDate(to) })}
      </p>
    </div>
  );
}