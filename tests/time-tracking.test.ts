import { describe, expect, it } from "vitest";
import { TIME_TRACKING_DAYS, TIME_TRACKING_ENTRIES, TIME_TRACKING_TOTAL_MINUTES } from "@/demo/time-tracking-2026";
import { durationMinutes, parseClock, timeWarnings, weekStart } from "@/domain/time";

function entryMinutes(entry: (typeof TIME_TRACKING_ENTRIES)[number]): number {
  return durationMinutes(entry.start, entry.end, entry.breakMinutes);
}

describe("time tracking with the recorded October and November 2026 days", () => {
  it("records every entry and every net duration", () => {
    expect(TIME_TRACKING_DAYS).toHaveLength(9);
    expect(TIME_TRACKING_ENTRIES).toHaveLength(32);
    for (const entry of TIME_TRACKING_ENTRIES) {
      expect(parseClock(entry.start), `${entry.date} ${entry.start}`).toBeLessThan(parseClock(entry.end));
      expect(entryMinutes(entry), `${entry.date} ${entry.start}–${entry.end}`).toBe(entry.expectedMinutes);
    }
  });

  it("adds each day and the whole period", () => {
    for (const day of TIME_TRACKING_DAYS) {
      const total = day.entries.reduce((sum, entry) => sum + entryMinutes(entry), 0);
      expect(total, day.date).toBe(day.expectedMinutes);
    }
    const total = TIME_TRACKING_DAYS.reduce((sum, day) => sum + day.expectedMinutes, 0);
    expect(total).toBe(TIME_TRACKING_TOTAL_MINUTES);
    expect(TIME_TRACKING_TOTAL_MINUTES).toBe(3145);
  });

  it("groups the days into Monday-based weeks", () => {
    const weeks = new Map<string, number>();
    for (const entry of TIME_TRACKING_ENTRIES) {
      const key = weekStart(entry.date);
      weeks.set(key, (weeks.get(key) ?? 0) + entry.expectedMinutes);
    }
    expect(Object.fromEntries(weeks)).toEqual({
      "2026-10-19": 390,
      "2026-10-26": 720,
      "2026-11-02": 870,
      "2026-11-09": 1120,
      "2026-11-16": 45,
    });
  });

  it("flags only 13 November, and only as a watch", () => {
    const warnings = TIME_TRACKING_ENTRIES.flatMap((entry) =>
      timeWarnings(entryMinutes(entry), entry.breakMinutes).map((warning) => ({ entry, ...warning })),
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].entry.date).toBe("2026-11-13");
    expect(warnings[0].level).toBe("watch");
    expect(warnings[0].message).toMatch(/Above 8 hours/);
  });

  it("treats the recorded pauses as breakMinutes, not as working time", () => {
    const paused = TIME_TRACKING_ENTRIES.filter((entry) => entry.breakMinutes > 0);
    expect(paused.map((entry) => `${entry.date} ${entry.start}`)).toEqual([
      "2026-10-23 11:30",
      "2026-11-10 13:30",
      "2026-11-13 09:00",
    ]);
    for (const entry of paused) {
      expect(entry.breakMinutes).toBe(60);
      expect(entry.expectedMinutes).toBe(parseClock(entry.end) - parseClock(entry.start) - 60);
      expect(timeWarnings(entry.expectedMinutes, entry.breakMinutes).filter((warning) => /break/.test(warning.message))).toEqual([]);
    }
  });

  it("requires a 60-minute break after more than nine hours", () => {
    const warning = timeWarnings(541, 45).find((item) => item.message.includes("60-minute"));
    expect(warning).toBeTruthy();
    expect(timeWarnings(541, 60).filter((item) => item.message.includes("break"))).toEqual([]);
  });

  it("keeps the entries of a day in order without overlap", () => {
    for (const day of TIME_TRACKING_DAYS) {
      const ordered = [...day.entries].sort((a, b) => a.start.localeCompare(b.start));
      for (let index = 1; index < ordered.length; index += 1) {
        expect(parseClock(ordered[index].start), `${day.date} ${ordered[index].start}`).toBeGreaterThanOrEqual(
          parseClock(ordered[index - 1].end),
        );
      }
    }
  });
});