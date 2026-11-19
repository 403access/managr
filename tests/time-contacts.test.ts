import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: vi.fn() }));

import { getDb } from "@/db/client";
import { contacts, customers, employees, timeEntries } from "@/db/schema";
import { filterTimeEntries, formatTimePersonRef, parseTimePersonRef } from "@/domain/time";
import { saveContact, saveTime, saveTimePerson } from "@/server/actions";
import { initialState } from "@/server/form";
import { customerView, timeRangeView } from "@/server/views";

const repo = process.cwd();
let dir = "";

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-contacts-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  delete (globalThis as { managrDb?: unknown }).managrDb;
});

afterEach(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("external contact people", () => {
  it("parses the time-entry person reference", () => {
    expect(parseTimePersonRef(formatTimePersonRef("employee", 4))).toEqual({ kind: "employee", id: 4 });
    expect(parseTimePersonRef(formatTimePersonRef("contact", 9))).toEqual({ kind: "contact", id: 9 });
    expect(parseTimePersonRef("")).toBeNull();
    expect(parseTimePersonRef("contact:0")).toBeNull();
  });

  it("creates a contact without an employee record", async () => {
    const customer = getDb().select().from(customers).get();
    const employeesBefore = getDb().select().from(employees).all().length;
    const result = await saveContact(
      initialState,
      form({ customerId: String(customer!.id), firstName: "Alen", lastName: "Zukic", role: "IT Works", email: "alen@example.test" }),
    );
    expect(result.error).toBe("");
    expect(getDb().select().from(employees).all()).toHaveLength(employeesBefore);
    const contact = getDb().select().from(contacts).get();
    expect(contact?.firstName).toBe("Alen");
    expect(contact?.customerId).toBe(customer!.id);
  });

  it("records time for a contact and reads the name back", async () => {
    const customer = getDb().select().from(customers).get();
    await saveContact(initialState, form({ customerId: String(customer!.id), firstName: "Sebastian", lastName: "Herrmann" }));
    const contact = getDb().select().from(contacts).get();

    const saved = await saveTime(
      initialState,
      form({
        entryDate: "2026-11-10",
        startedAt: "10:00",
        endedAt: "11:00",
        breakMinutes: "0",
        personRef: formatTimePersonRef("contact", contact!.id),
        memo: "",
      }),
    );
    expect(saved.error).toBe("");
    const entry = getDb().select().from(timeEntries).where(eq(timeEntries.entryDate, "2026-11-10")).get();
    expect(entry?.contactId).toBe(contact!.id);
    expect(entry?.employeeId).toBeNull();

    const view = timeRangeView("2026-11-10", "2026-11-10");
    expect(view.entries[0].personName).toBe("Sebastian Herrmann");
    expect(view.entries[0].contactCustomerName).toBe(customer!.name);
    expect(view.contacts.map((row) => row.id)).toContain(contact!.id);

    const filtered = filterTimeEntries(view.entries, {
      query: "",
      person: `contact:${contact!.id}`,
      project: null,
      customer: null,
      taskType: "",
      billable: "",
    });
    expect(filtered.map((row) => row.id)).toEqual([entry!.id]);

    const customerData = customerView(customer!.id);
    expect(customerData?.contacts.map((row) => row.firstName)).toContain("Sebastian");
  });

  it("changes the person on an existing entry instead of recreating it", async () => {
    const customer = getDb().select().from(customers).get();
    await saveContact(initialState, form({ customerId: String(customer!.id), firstName: "Alen", lastName: "Zukic" }));
    const contact = getDb().select().from(contacts).get();
    await saveContact(initialState, form({ customerId: String(customer!.id), firstName: "Oliver", lastName: "Molnar" }));
    const other = getDb().select().from(contacts).where(eq(contacts.firstName, "Oliver")).get();

    await saveTime(
      initialState,
      form({
        entryDate: "2026-11-03",
        startedAt: "09:00",
        endedAt: "10:00",
        breakMinutes: "0",
        personRef: formatTimePersonRef("contact", contact!.id),
      }),
    );
    const entry = getDb().select().from(timeEntries).where(eq(timeEntries.entryDate, "2026-11-03")).get();

    expect(
      await saveTimePerson(initialState, form({ id: String(entry!.id), personRef: formatTimePersonRef("contact", other!.id) })),
    ).toEqual({ error: "", message: "Person saved." });
    expect(getDb().select().from(timeEntries).where(eq(timeEntries.id, entry!.id)).get()?.contactId).toBe(other!.id);

    expect(await saveTimePerson(initialState, form({ id: String(entry!.id), personRef: "" }))).toEqual({
      error: "",
      message: "Person removed.",
    });
    const cleared = getDb().select().from(timeEntries).where(eq(timeEntries.id, entry!.id)).get();
    expect(cleared?.contactId).toBeNull();
    expect(cleared?.employeeId).toBeNull();
  });
});