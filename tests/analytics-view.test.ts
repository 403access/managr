import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { todayIso } from "@/domain/calendar";
import { analyticsView, projectsView } from "@/server/views";

const repo = process.cwd();
let dir = "";

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-analytics-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  getDb();
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("analysis view on the sample company", () => {
  const year = Number(todayIso().slice(0, 4));

  it("groups the sample time by project, task type, person, and customer", () => {
    const data = analyticsView(year);
    expect(data.totals.minutes).toBeGreaterThan(0);
    expect(data.projectRows.some((row) => row.name === "Markenauftritt Lichtfeld")).toBe(true);
    expect(data.projectRows.some((row) => row.name === "Pitchfilm Havel")).toBe(true);
    expect(data.peopleRows.some((row) => row.lastName === "Elling")).toBe(true);
    expect(data.customerRows.some((row) => row.name === "Lichtfeld GmbH")).toBe(true);
    expect(data.projectCounts.started).toBeGreaterThan(0);
    expect(data.projectCounts.completed).toBeGreaterThan(0);
    expect(data.productiveShare).toBeGreaterThan(0);
  });

  it("shows productive and unproductive task types with their minutes", () => {
    const data = analyticsView(year);
    const development = data.typeRows.find((row) => row.taskType === "development");
    const meeting = data.typeRows.find((row) => row.taskType === "meeting");
    expect(development?.productive).toBe(true);
    expect(development?.minutes).toBeGreaterThan(0);
    expect(meeting?.productive).toBe(false);
    expect(meeting?.minutes).toBeGreaterThan(0);
  });

  it("keeps deliverables and filters a customer report", () => {
    const all = analyticsView(year);
    expect(all.deliverables.some((item) => item.title === "Schnitt und Dramaturgie planen")).toBe(true);
    const customer = all.customerRows.find((row) => row.name === "Lichtfeld GmbH");
    expect(customer).toBeTruthy();
    const report = analyticsView(year, customer!.customerId);
    expect(report.customer?.name).toBe("Lichtfeld GmbH");
    expect(report.projectRows.every((row) => row.customerName === "Lichtfeld GmbH")).toBe(true);
    expect(report.customerRows).toHaveLength(1);
  });

  it("lists projects with the time booked to them", () => {
    const data = projectsView();
    expect(data.projects).toHaveLength(4);
    const lichtfeld = data.projects.find((project) => project.name === "Markenauftritt Lichtfeld");
    expect(lichtfeld?.minutes).toBeGreaterThan(0);
    expect(lichtfeld?.openDeliverables).toBeGreaterThan(0);
    const havel = data.projects.find((project) => project.name === "Pitchfilm Havel");
    expect(havel?.deliverables).toBeGreaterThan(0);
  });
});