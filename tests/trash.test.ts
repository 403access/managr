import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: vi.fn() }));

import { getDb } from "@/db/client";
import { companies, employees, projects, timeEntries } from "@/db/schema";
import { deleteProject, deleteSalaryPeriod, deleteTime, restoreDeletedRecord, saveProject, saveSalaryPeriod } from "@/server/actions";
import { listProjects, listSalaryPeriods, listTime } from "@/server/queries";
import { restoreDeleted, trashView } from "@/server/trash";

const repo = process.cwd();
let dir = "";

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-trash-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  getDb();
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

const state = { error: "", message: "" };

describe("soft delete and trash", () => {
  it("hides a deleted project but keeps its time, then restores it", async () => {
    const db = getDb();
    const company = db.select().from(companies).all().find((row) => row.isActive)!;
    const form = new FormData();
    form.set("name", "Papierkorb-Projekt");
    form.set("status", "active");
    form.set("startedOn", "2026-02-01");
    expect(await saveProject(state, form)).toEqual({ error: "", message: "Project added." });
    const project = db.select().from(projects).all().find((row) => row.name === "Papierkorb-Projekt")!;

    db.insert(timeEntries)
      .values({
        companyId: company.id,
        entryDate: "2026-02-03",
        startedAt: "09:00",
        endedAt: "10:00",
        projectId: project.id,
        taskType: "other",
      })
      .run();

    const remove = new FormData();
    remove.set("id", String(project.id));
    expect(await deleteProject(state, remove)).toEqual({
      error: "",
      message: "Project removed. Recorded time stays and is shown without a project.",
    });

    expect(listProjects().some((row) => row.id === project.id)).toBe(false);
    const time = listTime("2026-02-03").entries.find((row) => row.projectId === project.id);
    expect(time).toBeTruthy();
    const trashed = trashView().find((entry) => entry.kind === "project" && entry.id === project.id);
    expect(trashed?.label).toBe("Papierkorb-Projekt");

    expect(await restoreDeletedRecord("project", project.id)).toEqual({ ok: true });
    expect(listProjects().some((row) => row.id === project.id)).toBe(true);
  });

  it("keeps a deleted time entry in the trash and restores it", async () => {
    const db = getDb();
    const company = db.select().from(companies).all().find((row) => row.isActive)!;
    const created = db
      .insert(timeEntries)
      .values({
        companyId: company.id,
        entryDate: "2026-02-04",
        startedAt: "11:00",
        endedAt: "12:00",
        memo: "Papierkorb-Zeit",
        taskType: "other",
      })
      .run();
    const id = Number(created.lastInsertRowid);

    const remove = new FormData();
    remove.set("id", String(id));
    expect(await deleteTime(state, remove)).toEqual({ error: "", message: "Time entry removed." });
    expect(listTime("2026-02-04").entries.some((row) => row.id === id)).toBe(false);
    expect(trashView().some((entry) => entry.kind === "time" && entry.id === id)).toBe(true);

    expect(restoreDeleted("time", id)).toEqual({ ok: true });
    expect(listTime("2026-02-04").entries.some((row) => row.id === id)).toBe(true);
  });

  it("revives a deleted salary change instead of hitting the unique date", async () => {
    const db = getDb();
    const employee = db.select().from(employees).all().find((row) => row.kind === "managing_director") ?? db.select().from(employees).all()[0];
    const add = new FormData();
    add.set("employeeId", String(employee.id));
    add.set("validFrom", "2027-01-01");
    add.set("gross", "3.500,00");
    expect(await saveSalaryPeriod(state, add)).toEqual({ error: "", message: "Salary change saved." });
    const period = listSalaryPeriods(employee.id).find((row) => row.validFrom === "2027-01-01")!;

    const remove = new FormData();
    remove.set("employeeId", String(employee.id));
    remove.set("id", String(period.id));
    expect(await deleteSalaryPeriod(state, remove)).toEqual({ error: "", message: "Salary change removed." });
    expect(listSalaryPeriods(employee.id).some((row) => row.id === period.id)).toBe(false);

    const again = new FormData();
    again.set("employeeId", String(employee.id));
    again.set("validFrom", "2027-01-01");
    again.set("gross", "3.800,00");
    expect(await saveSalaryPeriod(state, again)).toEqual({ error: "", message: "Salary change saved." });
    const revived = listSalaryPeriods(employee.id).find((row) => row.validFrom === "2027-01-01");
    expect(revived?.id).toBe(period.id);
    expect(revived?.grossMonthlyCents).toBe(380_000);
  });

  it("refuses an unknown trash kind", async () => {
    expect(await restoreDeletedRecord("unknown", 1)).toEqual({ ok: false, error: "That entry was not found." });
  });
});