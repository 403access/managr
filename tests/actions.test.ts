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
  invoiceLines,
  projects,
  shareholderLoanMovements,
  shareholderLoans,
  shareholders,
  tasks,
  timeEntries,
  timeEntryActivities,
} from "@/db/schema";
import {
  addShareholderLoan,
  addShareholderLoanMovement,
  deleteProject,
  saveCustomer,
  saveDirectorContract,
  saveFounderHealth,
  saveInvoice,
  saveProject,
  saveTask,
  saveTime,
  saveTimeDetails,
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

describe("customer type and buyer reference", () => {
  function customerForm(values: Record<string, string>) {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    return form;
  }

  it("stores the customer type and checks the Leitweg-ID for a public customer", async () => {
    const valid = await saveCustomer(
      initialState,
      customerForm({ name: "Stadt Berlin", kind: "public", buyerReference: "04011000-1234512345-06" }),
    );
    expect(valid).toEqual({ error: "", message: "Customer added." });
    const stored = getDb().select().from(customers).all().find((row) => row.name === "Stadt Berlin");
    expect(stored?.kind).toBe("public");

    const wrongCheck = await saveCustomer(
      initialState,
      customerForm({ name: "Stadt Potsdam", kind: "public", buyerReference: "04011000-1234512345-05" }),
    );
    expect(wrongCheck.error).toContain("check digit");

    const business = await saveCustomer(initialState, customerForm({ name: "Ohne Referenz GmbH", kind: "business" }));
    expect(business).toEqual({ error: "", message: "Customer added." });
    const privateCustomer = await saveCustomer(initialState, customerForm({ name: "Privatperson", kind: "private" }));
    expect(privateCustomer).toEqual({ error: "", message: "Customer added." });
    const unknownKind = await saveCustomer(initialState, customerForm({ name: "Unbekannt", kind: "authority" }));
    expect(unknownKind.error).toBe("Choose a customer type.");
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
    timeForm.append("activities", "  Komponenten gebaut  ");
    timeForm.append("activities", "");
    timeForm.append("activities", "Abstimmung mit dem Kunden");
    timeForm.set("memo", "Nur intern: Rückfrage offen");
    timeForm.set("billable", "on");
    expect(await saveTime(initialState, timeForm)).toEqual({ error: "", message: "Time saved." });
    const entered = db.select().from(timeEntries).all().find((row) => row.entryDate === "2026-02-03");
    expect(entered?.projectId).toBe(project!.id);
    expect(entered?.taskType).toBe("development");
    expect(entered?.billable).toBe(true);
    expect(entered?.memo).toBe("Nur intern: Rückfrage offen");
    expect(
      db.select().from(timeEntryActivities).all().filter((row) => row.timeEntryId === entered!.id).map((row) => row.description),
    ).toEqual(["Komponenten gebaut", "Abstimmung mit dem Kunden"]);

    const detailsForm = new FormData();
    detailsForm.set("id", String(entered!.id));
    detailsForm.set("activities", "Nur eine Tätigkeit");
    detailsForm.set("memo", "");
    expect(await saveTimeDetails(initialState, detailsForm)).toEqual({ error: "", message: "Time entry saved." });
    expect(
      db.select().from(timeEntryActivities).all().filter((row) => row.timeEntryId === entered!.id).map((row) => row.description),
    ).toEqual(["Nur eine Tätigkeit"]);
    expect(db.select().from(timeEntries).all().find((row) => row.id === entered!.id)?.memo).toBe("");

    const deleteForm = new FormData();
    deleteForm.set("id", String(project!.id));
    expect(await deleteProject(initialState, deleteForm)).toEqual({ error: "", message: "Project removed. Recorded time stays and is shown without a project." });
    const deletedProject = db.select().from(projects).all().find((row) => row.id === project!.id);
    expect(deletedProject?.deletedAt).toBeTruthy();
    expect(db.select().from(timeEntries).all().find((row) => row.id === entered!.id)?.projectId).toBe(project!.id);
  });
});

describe("invoice lines from time activities", () => {
  function draftWithActivity(customerId: number, timeEntryId: number, timeActivityId: number) {
    const form = new FormData();
    form.set(
      "payload",
      JSON.stringify({
        invoiceId: null,
        customerMode: "existing",
        customerId,
        newCustomer: { name: "", street: "", postalCode: "", city: "", country: "Deutschland", email: "", vatId: "" },
        issueDate: "2026-10-31",
        serviceDate: "2026-10-31",
        dueDate: "2026-11-14",
        notes: "",
        buyerReference: "",
        amountDisplay: "net",
        lines: [
          {
            description: "Projekt: Konzept",
            quantity: "1",
            unitNet: "30,00",
            vatBps: 1900,
            timeEntryId,
            timeActivityId,
          },
        ],
      }),
    );
    form.set("intent", "draft");
    return form;
  }

  it("stores the activity link and refuses to bill the same activity twice", async () => {
    const db = activateSampleCompany();
    const company = db.select().from(companies).all().find((row) => row.isActive)!;
    const customerId = Number(db.insert(customers).values({ companyId: company.id, name: "Zeitkunde", hourlyRateCents: 3_000 }).run().lastInsertRowid);
    const projectId = Number(
      db.insert(projects).values({ companyId: company.id, customerId, name: "Projekt", startedOn: "2026-10-01" }).run().lastInsertRowid,
    );
    const entryId = Number(
      db
        .insert(timeEntries)
        .values({ companyId: company.id, entryDate: "2026-10-01", startedAt: "09:00", endedAt: "10:00", breakMinutes: 0, projectId, billable: true, taskType: "development" })
        .run().lastInsertRowid,
    );
    const activityId = Number(
      db.insert(timeEntryActivities).values({ timeEntryId: entryId, position: 0, description: "Konzept" }).run().lastInsertRowid,
    );

    await saveInvoice(initialState, draftWithActivity(customerId, entryId, activityId));

    const line = db.select().from(invoiceLines).all().find((row) => row.timeActivityId === activityId);
    expect(line?.timeEntryId).toBe(entryId);
    expect(line?.description).toBe("Projekt: Konzept");

    const second = await saveInvoice(initialState, draftWithActivity(customerId, entryId, activityId));
    expect(second?.error).toContain("already on another invoice");
  });
});
