import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: vi.fn() }));

import { getDb } from "@/db/client";
import {
  companies,
  customers,
  directorContracts,
  employees,
  founderHealth,
  projects,
  shareholderLoanMovements,
  shareholderLoans,
  shareholders,
  tasks,
  timeEntries,
} from "@/db/schema";
import {
  addShareholderLoan,
  addShareholderLoanMovement,
  deleteProject,
  saveDirectorContract,
  saveFounderHealth,
  saveProject,
  saveTask,
  saveTime,
  switchCompany,
} from "@/server/actions";
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

/** The first test switches the active company; the founder records live in the sample company. */
function activateSampleCompany() {
  const db = getDb();
  const sample = db.select().from(companies).all().find((row) => row.legalName.includes("Atelier")) ?? db.select().from(companies).all()[0]!;
  db.update(companies).set({ isActive: false }).run();
  db.update(companies).set({ isActive: true }).where(eq(companies.id, sample.id)).run();
  return db;
}

describe("founder pay forms", () => {
  it("saves a director contract and the founder's health cover from the person form fields", async () => {
    const db = activateSampleCompany();
    const director = db.select().from(employees).all().find((person) => person.kind === "managing_director")!;

    const contract = new FormData();
    contract.set("employeeId", String(director.id));
    contract.set("signedOn", "2027-01-01");
    contract.set("validFrom", "2027-01-01");
    contract.set("gross", "3300,00");
    contract.set("notes", "Testvertrag");
    expect(await saveDirectorContract(initialState, contract)).toEqual({ error: "", message: "Managing-director service contract saved." });
    expect(db.select().from(directorContracts).all().some((row) => row.employeeId === director.id && row.grossMonthlyCents === 330_000)).toBe(true);

    const health = new FormData();
    health.set("employeeId", String(director.id));
    health.set("kind", "voluntary_statutory");
    health.set("provider", "Testkasse");
    health.set("premium", "520,00");
    health.set("startsOn", "2024-03-15");
    health.set("statusProcedure", "completed");
    health.set("statusOn", "2024-04-01");
    health.set("statusOutcome", "not_socially_insured");
    expect(await saveFounderHealth(initialState, health)).toEqual({ error: "", message: "Founder health cover saved." });
    const cover = db.select().from(founderHealth).all().find((row) => row.employeeId === director.id);
    expect(cover?.kind).toBe("voluntary_statutory");
    expect(cover?.monthlyPremiumCents).toBe(52_000);
  });

  it("posts a shareholder loan and a repayment from the company form fields", async () => {
    const db = activateSampleCompany();
    const holder = db.select().from(shareholders).all()[0]!;

    const loanForm = new FormData();
    loanForm.set("shareholderId", String(holder.id));
    loanForm.set("label", "Testdarlehen");
    loanForm.set("amount", "1000,00");
    loanForm.set("openedOn", "2027-01-01");
    loanForm.set("interest", "2,00");
    expect(await addShareholderLoan(initialState, loanForm)).toEqual({
      error: "",
      message: "Shareholder loan recorded. The drawdown is a liability to the shareholder, not income.",
    });
    const loan = db.select().from(shareholderLoans).all().find((row) => row.shareholderId === holder.id && row.label === "Testdarlehen");
    expect(loan?.principalCents).toBe(100_000);
    const drawdown = db.select().from(shareholderLoanMovements).all().find((row) => row.loanId === loan!.id && row.kind === "drawdown");
    expect(drawdown?.amountCents).toBe(100_000);
    expect(drawdown?.journalEntryId).toBeTruthy();

    const repayment = new FormData();
    repayment.set("loanId", String(loan!.id));
    repayment.set("kind", "repayment");
    repayment.set("amount", "400,00");
    repayment.set("movedOn", "2027-02-01");
    expect(await addShareholderLoanMovement(initialState, repayment)).toEqual({
      error: "",
      message: "Loan repayment posted. It reduces the liability to the shareholder.",
    });
    expect(db.select().from(shareholderLoanMovements).all().some((row) => row.loanId === loan!.id && row.kind === "repayment" && row.amountCents === 40_000)).toBe(true);
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