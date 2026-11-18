import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: vi.fn() }));

import { getDb } from "@/db/client";
import { companies } from "@/db/schema";
import { todayIso } from "@/domain/calendar";
import { initialState } from "@/server/form";
import { saveMilestone } from "@/server/actions";
import { milestonesView } from "@/server/views";

const repo = process.cwd();
let dir = "";

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-milestones-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  getDb();
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("milestones view on the sample desk", () => {
  const year = Number(todayIso().slice(0, 4));

  it("lists the sample goals, including one for the whole group", () => {
    const view = milestonesView(year);
    expect(view.milestones.length).toBeGreaterThanOrEqual(4);
    expect(view.milestones.some((milestone) => milestone.companyNames.length === 0)).toBe(true);
    expect(view.milestones.some((milestone) => milestone.companyNames.length > 0)).toBe(true);
    expect(view.analysis.total).toBe(view.milestones.length);
    expect(view.companyRows.some((row) => row.id === null)).toBe(true);
    expect(view.years).toContain(year);
  });

  it("links one goal to several companies and counts it in each company", async () => {
    const db = getDb();
    const first = db.select().from(companies).all().find((company) => company.isActive)!;
    const secondId = Number(
      db
        .insert(companies)
        .values({ legalName: "Zweite Beispiel UG", legalForm: "ug", shareCapitalCents: 100, foundingDate: `${year}-01-01`, isActive: false })
        .run().lastInsertRowid,
    );
    const form = new FormData();
    form.set("title", "Gemeinsames Ziel über zwei Gesellschaften");
    form.set("category", "growth");
    form.set("status", "active");
    form.set("targetDate", `${year}-12-31`);
    form.set("progress", "25");
    form.set("companyIds", String(first.id));
    form.append("companyIds", String(secondId));

    const result = await saveMilestone(initialState, form);

    expect(result.error).toBe("");
    const view = milestonesView(year);
    const saved = view.milestones.find((milestone) => milestone.title === "Gemeinsames Ziel über zwei Gesellschaften");
    expect(saved?.companyIds).toEqual([first.id, secondId].sort((left, right) => left - right));
    expect(saved?.effectiveProgress).toBe(25);
    expect(view.companyRows.find((row) => row.id === first.id)?.total).toBeGreaterThan(0);
    expect(view.companyRows.find((row) => row.id === secondId)?.total).toBe(1);
  });
});