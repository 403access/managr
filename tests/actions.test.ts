import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: vi.fn() }));

import { getDb } from "@/db/client";
import { companies, customers, projects, tasks, timeEntries } from "@/db/schema";
import { deleteProject, saveProject, saveTask, saveTime, switchCompany } from "@/server/actions";
import { initialState } from "@/server/form";

const repo = process.cwd();
let dir = "";

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-actions-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
});

afterEach(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("company switching", () => {
  it("reads the companyId field that the sidebar switcher and the company screen send", async () => {
    const db = getDb();
    const secondId = Number(
      db
        .insert(companies)
        .values({ legalName: "Neue UG (haftungsbeschränkt)", legalForm: "ug", shareCapitalCents: 100, foundingDate: "2026-01-01", isActive: false })
        .run().lastInsertRowid,
    );
    const formData = new FormData();
    formData.set("companyId", String(secondId));

    const result = await switchCompany(initialState, formData);

    expect(result).toEqual({ error: "", message: "Company switched." });
    const rows = db.select().from(companies).all();
    expect(rows.find((row) => row.id === secondId)?.isActive).toBe(true);
    expect(rows.filter((row) => row.isActive)).toHaveLength(1);
  });
});

describe("project time", () => {
  it("saves a project, a typed task, and a time entry on it", async () => {
    const db = getDb();
    const active = db.select().from(companies).all().find((row) => row.isActive)!;
    const customer = { id: Number(db.insert(customers).values({ companyId: active.id, name: "Testkunde" }).run().lastInsertRowid) };
    const projectForm = new FormData();
    projectForm.set("name", "Testprojekt");
    projectForm.set("status", "active");
    projectForm.set("startedOn", "2026-02-01");
    projectForm.set("customerId", String(customer.id));
    expect(await saveProject(initialState, projectForm)).toEqual({ error: "", message: "Project added." });
    const project = db.select().from(projects).all().find((row) => row.name === "Testprojekt");
    expect(project?.customerId).toBe(customer.id);

    const taskForm = new FormData();
    taskForm.set("title", "Komponenten bauen");
    taskForm.set("projectId", String(project!.id));
    taskForm.set("taskType", "development");
    taskForm.set("status", "open");
    taskForm.set("deliverable", "on");
    expect(await saveTask(initialState, taskForm)).toEqual({ error: "", message: "Task added." });
    const task = db.select().from(tasks).all().find((row) => row.title === "Komponenten bauen");
    expect(task?.projectId).toBe(project!.id);
    expect(task?.taskType).toBe("development");
    expect(task?.deliverable).toBe(true);

    const timeForm = new FormData();
    timeForm.set("entryDate", "2026-02-03");
    timeForm.set("startedAt", "09:00");
    timeForm.set("endedAt", "17:00");
    timeForm.set("breakMinutes", "60");
    timeForm.set("taskId", String(task!.id));
    timeForm.set("taskType", "");
    timeForm.set("billable", "on");
    expect(await saveTime(initialState, timeForm)).toEqual({ error: "", message: "Time saved." });
    const entered = db.select().from(timeEntries).all().find((row) => row.entryDate === "2026-02-03");
    expect(entered?.projectId).toBe(project!.id);
    expect(entered?.taskType).toBe("development");
    expect(entered?.billable).toBe(true);

    const deleteForm = new FormData();
    deleteForm.set("id", String(project!.id));
    expect(await deleteProject(initialState, deleteForm)).toEqual({ error: "", message: "Project removed. Recorded time stays and is shown without a project." });
    expect(db.select().from(timeEntries).all().find((row) => row.id === entered!.id)?.projectId).toBeNull();
  });
});