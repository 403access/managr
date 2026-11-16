"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDate } from "@/domain/calendar";
import { durationMinutes, parseClock, timeWarnings, weekStart } from "@/domain/time";
import { TIME_TRACKING_DAYS, TIME_TRACKING_ENTRIES, TIME_TRACKING_TOTAL_MINUTES } from "@/demo/time-tracking-2026";
import { formatDuration } from "./amounts";
import { useI18n } from "./locale-provider";
import { buttonClass, Card } from "./ui";

type Analyzed = {
  index: number;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
  memo: string;
  minutes: number;
  expectedMinutes: number;
  warnings: { level: "stop" | "watch"; message: string }[];
};

function analyze(): Analyzed[] {
  return TIME_TRACKING_ENTRIES.map((entry, index) => ({
    ...entry,
    index,
    minutes: durationMinutes(entry.start, entry.end, entry.breakMinutes),
    warnings: timeWarnings(durationMinutes(entry.start, entry.end, entry.breakMinutes), entry.breakMinutes),
  }));
}

function weekdayOf(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { weekday: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

export function TimePlayback() {
  const { t, tx, locale } = useI18n();
  const entries = useMemo(analyze, []);
  const days = useMemo(
    () => TIME_TRACKING_DAYS.map((day) => ({ ...day, entries: entries.filter((entry) => entry.date === day.date) })),
    [entries],
  );
  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);
  const done = revealed >= entries.length;

  useEffect(() => {
    if (revealed > 0) return;
    const timer = setTimeout(() => setPlaying(true), 600);
    return () => clearTimeout(timer);
  }, [revealed]);

  useEffect(() => {
    if (!playing) return;
    if (revealed >= entries.length) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setRevealed((value) => value + 1), Math.max(90, 650 / speed));
    return () => clearTimeout(timer);
  }, [playing, revealed, speed, entries.length]);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(`[data-entry="${revealed - 1}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [revealed]);

  const shown = entries.slice(0, revealed);
  const currentDate = shown.at(-1)?.date ?? null;
  const currentWeek = currentDate ? weekStart(currentDate) : null;
  const dayMinutes = currentDate ? shown.filter((entry) => entry.date === currentDate).reduce((sum, entry) => sum + entry.minutes, 0) : 0;
  const weekMinutes = currentWeek ? shown.filter((entry) => weekStart(entry.date) === currentWeek).reduce((sum, entry) => sum + entry.minutes, 0) : 0;
  const totalMinutes = shown.reduce((sum, entry) => sum + entry.minutes, 0);

  const checks = useMemo(() => {
    const durationsOk = entries.every((entry) => entry.minutes === entry.expectedMinutes);
    const daysOk = days.every((day) => day.entries.reduce((sum, entry) => sum + entry.minutes, 0) === day.expectedMinutes);
    const expectedWeeks = new Map<string, number>();
    for (const day of TIME_TRACKING_DAYS) expectedWeeks.set(weekStart(day.date), (expectedWeeks.get(weekStart(day.date)) ?? 0) + day.expectedMinutes);
    const actualWeeks = new Map<string, number>();
    for (const entry of entries) actualWeeks.set(weekStart(entry.date), (actualWeeks.get(weekStart(entry.date)) ?? 0) + entry.minutes);
    const weeksOk = [...expectedWeeks.entries()].every(([week, minutes]) => actualWeeks.get(week) === minutes) && actualWeeks.size === expectedWeeks.size;
    const paused = entries.filter((entry) => entry.breakMinutes > 0);
    const breaksOk = paused.every((entry) => entry.minutes === parseClock(entry.end) - parseClock(entry.start) - entry.breakMinutes);
    const warnings = entries.flatMap((entry) => entry.warnings.map((warning) => ({ date: entry.date, ...warning })));
    const arbzgOk = warnings.length === 1 && warnings[0].date === "2026-11-13" && warnings[0].level === "watch";
    const totalOk = entries.reduce((sum, entry) => sum + entry.minutes, 0) === TIME_TRACKING_TOTAL_MINUTES;
    return [
      { key: "durations", label: t("time.playbackCheckDurations"), detail: `${entries.length}`, ok: durationsOk },
      { key: "days", label: t("time.playbackCheckDays"), detail: `${days.length}`, ok: daysOk },
      { key: "weeks", label: t("time.playbackCheckWeeks"), detail: `${expectedWeeks.size}`, ok: weeksOk },
      { key: "breaks", label: t("time.playbackCheckBreaks"), detail: `${paused.length}`, ok: breaksOk },
      { key: "arbzg", label: t("time.playbackCheckArbzg"), detail: warnings[0]?.message ?? "", ok: arbzgOk },
      { key: "total", label: t("time.playbackCheckTotal", { duration: formatDuration(TIME_TRACKING_TOTAL_MINUTES) }), detail: `${TIME_TRACKING_TOTAL_MINUTES} min`, ok: totalOk },
    ];
  }, [entries, days, t]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid content-start gap-3">
        <Card className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={buttonClass()} onClick={() => setPlaying((value) => !value)} disabled={done && !playing}>
              {playing ? t("time.playbackPause") : t("time.playbackPlay")}
            </button>
            <button
              type="button"
              className={buttonClass("quiet")}
              onClick={() => {
                setRevealed(0);
                setPlaying(true);
              }}
            >
              {t("time.playbackRestart")}
            </button>
            <div className="ml-auto flex items-center gap-1" role="group" aria-label={t("time.playbackSpeed")}>
              {[1, 4, 16].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={speed === value}
                  className={`min-h-11 rounded-full px-3 text-sm font-medium ${speed === value ? "bg-pine text-paper" : "border border-line bg-card text-ink"}`}
                  onClick={() => setSpeed(value)}
                >
                  {value}×
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div className="h-2 rounded-full bg-pine transition-all duration-300" style={{ width: `${(revealed / entries.length) * 100}%` }} />
            </div>
            <p className="mt-1 font-mono text-xs text-muted">{t("time.playbackProgress", { done: revealed, total: entries.length })}</p>
          </div>
        </Card>

        <div ref={listRef} className="grid max-h-[64dvh] gap-3 overflow-y-auto pr-1">
          {days.map((day) => {
            const visible = day.entries.filter((entry) => entry.index < revealed);
            if (visible.length === 0) return null;
            const minutes = visible.reduce((sum, entry) => sum + entry.minutes, 0);
            return (
              <Card key={day.date} className="overflow-hidden p-0">
                <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-card px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{formatDate(day.date)}</p>
                    <p className="text-xs text-muted">{weekdayOf(day.date, locale)}</p>
                  </div>
                  <p className="font-mono text-xs">{formatDuration(minutes)} / {formatDuration(day.expectedMinutes)}</p>
                </div>
                <ul>
                  {visible.map((entry) => (
                    <li
                      key={entry.index}
                      data-entry={entry.index}
                      className={`border-b border-line px-3 py-2 last:border-0 ${entry.index === revealed - 1 ? "border-l-2 border-l-pine bg-pine/5" : ""}`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-mono text-xs">{entry.start}–{entry.end}</span>
                        <span className="font-mono text-xs">{formatDuration(entry.minutes)}</span>
                      </div>
                      <p className="text-sm leading-snug">{entry.memo}</p>
                      {entry.breakMinutes > 0 ? <p className="text-xs text-muted">{t("time.playbackBreak", { minutes: entry.breakMinutes })}</p> : null}
                      {entry.warnings.map((warning) => (
                        <p key={warning.message} className="text-xs text-amber">{tx(warning.message)}</p>
                      ))}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </div>

      <aside className="grid content-start gap-3">
        <Card>
          <h2 className="text-lg">{t("time.playbackTotals")}</h2>
          <p className="mt-0.5 text-xs text-muted">{currentDate ? formatDate(currentDate) : "—"}</p>
          <dl className="mt-2 grid gap-1 text-sm">
            <div className="flex justify-between gap-2"><dt>{t("time.playbackToday")}</dt><dd className="font-mono">{formatDuration(dayMinutes)}</dd></div>
            <div className="flex justify-between gap-2"><dt>{t("time.playbackWeek")}</dt><dd className="font-mono">{formatDuration(weekMinutes)}</dd></div>
            <div className="flex justify-between gap-2 font-medium"><dt>{t("time.playbackTotal")}</dt><dd className="font-mono">{formatDuration(totalMinutes)}</dd></div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-lg">{t("time.playbackChecks")}</h2>
          <ul className="mt-2 grid gap-1.5 text-sm">
            {checks.map((check) => (
              <li key={check.key} className="flex gap-2">
                <span className={done ? (check.ok ? "text-moss" : "text-clay") : "text-muted"} aria-hidden="true">
                  {done ? (check.ok ? "✓" : "✕") : "○"}
                </span>
                <span>
                  {check.label}
                  <span className="block font-mono text-[11px] text-muted">{check.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          {done ? null : <p className="mt-2 text-xs text-muted">{t("time.playbackChecksPending")}</p>}
        </Card>

        {done ? (
          <Card className="border-moss/40 bg-moss/10">
            <p className="text-sm font-medium">{t("time.playbackDone")}</p>
            <p className="mt-1 text-sm">{formatDuration(TIME_TRACKING_TOTAL_MINUTES)}</p>
          </Card>
        ) : null}

        <p className="text-xs leading-relaxed text-muted">{t("time.playbackReadOnly")}</p>
        <Link href="/time" className={buttonClass("quiet")}>{t("time.playbackBack")}</Link>
      </aside>
    </div>
  );
}