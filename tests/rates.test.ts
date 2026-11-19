import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { customers, projects, timeEntries } from "@/db/schema";
import { todayIso } from "@/domain/calendar";
import { effectiveHourlyRate, timeValueCents } from "@/domain/rates";
import { timeView } from "@/server/views";
import { eq } from "drizzle-orm";

describe("hourly rate cascade", () => {
  it("lets the most specific level win", () => {
    expect(effectiveHourlyRate({ entryCents: 13_500, projectCents: 12_000, customerCents: 11_000, globalCents: 9_500 })).toEqual({
      cents: 13_500,
      source: "entry",
    });
    expect(effectiveHourlyRate({ projectCents: 12_000, customerCents: 11_000, globalCents: 9_500 })).toEqual({
      cents: 12_000,
      source: "project",
    });
    expect(effectiveHourlyRate({ customerCents: 11_000, globalCents: 9_500 })).toEqual({ cents: 11_000, source: "customer" });
    expect(effectiveHourlyRate({ globalCents: 9_500 })).toEqual({ cents: 9_500, source: "global" });
  });

  it("inherits past an empty level and treats zero as a stored rate", () => {
    expect(effectiveHourlyRate({ entryCents: null, projectCents: null, globalCents: 9_500 })).toEqual({ cents: 9_500, source: "global" });
    expect(effectiveHourlyRate({ entryCents: 0, globalCents: 9_500 })).toEqual({ cents: 0, source: "entry" });
    expect(effectiveHourlyRate({})).toBeNull();
  });

  it("values booked time at the rate, rounded to the cent", () => {
    expect(timeValueCents(60, 9_500)).toBe(9_500);
    expect(timeValueCents(90, 9_500)).toBe(14_250);
    expect(timeValueCents(10, 9_500)).toBe(1_583);
    expect(timeValueCents(0, 9_500)).toBe(0);
    expect(timeValueCents(-30, 9_500)).toBe(0);
  });
});

const repo = process.cwd();
let dir = "";

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-rates-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  getDb();
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("time view rates", () => {
  it("shows the inherited rate and the value of each entry", () => {
    const week = timeView(todayIso());
    const entry = week.entries.find((item) => item.projectId !== null && !item.error);
    expect(entry).toBeTruthy();
    expect(entry!.rate).not.toBeNull();
    expect(entry!.valueCents).toBe(timeValueCents(entry!.minutes, entry!.rate!.cents));
    expect(week.billableValueCents).toBeGreaterThanOrEqual(0);
  });

  it("uses an entry override and falls back to the next level when it is cleared", () => {
    const db = getDb();
    const week = timeView(todayIso());
    const candidate = week.entries.find((item) => item.projectId !== null && !item.error);
    expect(candidate).toBeTruthy();
    const id = candidate!.id;

    db.update(timeEntries).set({ hourlyRateCents: 20_000 }).where(eq(timeEntries.id, id)).run();
    const overridden = timeView(todayIso()).entries.find((item) => item.id === id);
    expect(overridden!.rate).toEqual({ cents: 20_000, source: "entry" });

    db.update(timeEntries).set({ hourlyRateCents: null }).where(eq(timeEntries.id, id)).run();
    const inherited = timeView(todayIso()).entries.find((item) => item.id === id);
    const project = inherited!.projectId === null ? null : db.select().from(projects).where(eq(projects.id, inherited!.projectId)).get();
    const customer = project?.customerId == null ? null : db.select().from(customers).where(eq(customers.id, project.customerId)).get();
    const expected = effectiveHourlyRate({
      projectCents: project?.hourlyRateCents ?? null,
      customerCents: customer?.hourlyRateCents ?? null,
      globalCents: 9_500,
    });
    expect(inherited!.rate).toEqual(expected);
  });
});