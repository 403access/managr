import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companies, customers, invoiceLines, invoices, projects, timeEntries, timeEntryActivities } from "@/db/schema";
import { invoiceEditView, invoiceNewView } from "@/server/views";

const repo = process.cwd();
let dir = "";
let customerId = 0;
let entryId = 0;
let firstActivityId = 0;
let secondActivityId = 0;
let draftId = 0;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-invoice-time-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  const db = getDb();
  const company = db.select().from(companies).where(eq(companies.isActive, true)).get()!;
  const customer = db.select().from(customers).where(eq(customers.companyId, company.id)).get()!;
  customerId = customer.id;
  db.update(customers).set({ hourlyRateCents: 3_000 }).where(eq(customers.id, customer.id)).run();
  const projectId = Number(
    db.insert(projects).values({ companyId: company.id, customerId, name: "Projekt", startedOn: "2026-10-01" }).run().lastInsertRowid,
  );
  entryId = Number(
    db
      .insert(timeEntries)
      .values({ companyId: company.id, entryDate: "2026-10-01", startedAt: "09:00", endedAt: "10:00", breakMinutes: 0, projectId, billable: true, taskType: "development" })
      .run().lastInsertRowid,
  );
  firstActivityId = Number(
    db.insert(timeEntryActivities).values({ timeEntryId: entryId, position: 0, description: "Konzept" }).run().lastInsertRowid,
  );
  secondActivityId = Number(
    db.insert(timeEntryActivities).values({ timeEntryId: entryId, position: 1, description: "Umsetzung" }).run().lastInsertRowid,
  );
  db.insert(timeEntries)
    .values({ companyId: company.id, entryDate: "2026-10-02", startedAt: "09:00", endedAt: "10:00", breakMinutes: 0, projectId, billable: false, taskType: "admin" })
    .run();
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("invoice time picker", () => {
  it("offers billable activities with split quantities and the effective rate", () => {
    const view = invoiceNewView();
    const mine = view.timeActivities.filter((activity) => activity.timeEntryId === entryId);
    expect(mine.map((activity) => activity.description)).toEqual(["Konzept", "Umsetzung"]);
    expect(mine.map((activity) => activity.quantity)).toEqual(["0,5", "0,5"]);
    expect(mine.every((activity) => activity.unitNet === "30,00")).toBe(true);
    expect(mine.every((activity) => activity.customerId === customerId)).toBe(true);
    expect(mine[0]?.lineDescription).toBe("Projekt: Konzept");
  });

  it("leaves out an activity that a draft already carries, and shows it again on that draft", () => {
    const db = getDb();
    draftId = Number(
      db
        .insert(invoices)
        .values({
          companyId: db.select().from(companies).where(eq(companies.isActive, true)).get()!.id,
          customerId,
          number: null,
          status: "draft",
          issueDate: "2026-10-31",
          serviceDate: "2026-10-31",
          dueDate: "2026-11-14",
        })
        .run().lastInsertRowid,
    );
    db.insert(invoiceLines)
      .values({
        invoiceId: draftId,
        position: 1,
        description: "Projekt: Konzept",
        quantityMilli: 500,
        unitNetCents: 3_000,
        vatBps: 1_900,
        timeEntryId: entryId,
        timeActivityId: firstActivityId,
      })
      .run();

    const fresh = invoiceNewView();
    expect(fresh.timeActivities.some((activity) => activity.id === firstActivityId)).toBe(false);
    expect(fresh.timeActivities.some((activity) => activity.id === secondActivityId)).toBe(true);

    const edit = invoiceEditView(draftId);
    expect(edit.kind).toBe("draft");
    if (edit.kind === "draft") {
      expect(edit.timeActivities.some((activity) => activity.id === firstActivityId)).toBe(true);
      expect(edit.draft.lines[0]?.timeActivityId).toBe(firstActivityId);
    }
  });
});