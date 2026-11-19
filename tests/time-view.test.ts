import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { addDays, todayIso } from "@/domain/calendar";
import { daySpan } from "@/domain/time";
import { timeRangeView, timeView } from "@/server/views";

const repo = process.cwd();
let dir = "";

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-time-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  getDb();
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("time view ranges", () => {
  it("keeps the week view and its neighbour links", () => {
    const today = todayIso();
    const week = timeView(today);
    expect(week.entries.length).toBeGreaterThan(0);
    expect(week.entries.every((entry) => entry.entryDate >= week.start && entry.entryDate <= week.end)).toBe(true);
    expect(daySpan(week.start, week.end)).toBe(7);
    expect(week.previous).toBe(addDays(week.start, -7));
    expect(week.next).toBe(addDays(week.end, 1));
  });

  it("loads an explicit range and can still show the current day", () => {
    const today = todayIso();
    const range = timeRangeView(addDays(today, -14), addDays(today, 14));
    expect(range.start).toBe(addDays(today, -14));
    expect(range.end).toBe(addDays(today, 14));
    expect(range.entries.length).toBeGreaterThan(0);
    expect(range.entries.every((entry) => entry.entryDate >= range.start && entry.entryDate <= range.end)).toBe(true);
    expect(range.total).toBeGreaterThan(0);
    expect(range.anchor).toBe(today);

    const single = timeRangeView(today, today);
    expect(single.entries.every((entry) => entry.entryDate === today)).toBe(true);
    expect(single.total).toBeLessThanOrEqual(range.total);
  });

  it("orders a reversed range and moves the neighbours by its own length", () => {
    const today = todayIso();
    const range = timeRangeView(addDays(today, 5), addDays(today, -5));
    expect(range.start).toBe(addDays(today, -5));
    expect(range.end).toBe(addDays(today, 5));
    expect(range.previous).toBe(addDays(range.start, -daySpan(range.start, range.end)));
    expect(range.next).toBe(addDays(range.end, 1));
  });
});