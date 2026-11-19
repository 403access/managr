import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, gt } from "drizzle-orm";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: vi.fn() }));

import { getDb } from "@/db/client";
import { companies, customers, projects, timeEntries } from "@/db/schema";
import { saveCustomer, saveProject, saveSettings, saveTime, saveTimeRate } from "@/server/actions";
import { initialState } from "@/server/form";

const repo = process.cwd();
let dir = "";

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-rate-actions-"));
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

describe("hourly rate forms", () => {
  it("stores and clears the company default", async () => {
    await saveSettings(initialState, form({ detailSidebarMode: "inline", hourlyRate: "95,00" }));
    expect(getDb().select().from(companies).where(eq(companies.isActive, true)).get()?.hourlyRateCents).toBe(9_500);

    await saveSettings(initialState, form({ detailSidebarMode: "inline", hourlyRate: "" }));
    expect(getDb().select().from(companies).where(eq(companies.isActive, true)).get()?.hourlyRateCents).toBeNull();
  });

  it("stores customer and project rates", async () => {
    const customer = await saveCustomer(initialState, form({ name: "Satz Kunde", hourlyRate: "110,00" }));
    expect(customer.error).toBe("");
    const customerRow = getDb().select().from(customers).where(eq(customers.name, "Satz Kunde")).get();
    expect(customerRow?.hourlyRateCents).toBe(11_000);

    const project = await saveProject(
      initialState,
      form({ name: "Satz Projekt", status: "active", startedOn: "2026-01-05", customerId: String(customerRow!.id), hourlyRate: "120,00" }),
    );
    expect(project.error).toBe("");
    expect(getDb().select().from(projects).where(eq(projects.name, "Satz Projekt")).get()?.hourlyRateCents).toBe(12_000);
  });

  it("stores an entry override and clears it back to inheritance", async () => {
    const project = getDb().select().from(projects).get();
    const lastId = getDb().select().from(timeEntries).orderBy(timeEntries.id).all().at(-1)?.id ?? 0;
    const saved = await saveTime(
      initialState,
      form({
        entryDate: "2026-03-02",
        startedAt: "09:00",
        endedAt: "11:00",
        breakMinutes: "0",
        projectId: String(project!.id),
        billable: "on",
        hourlyRate: "130,00",
      }),
    );
    expect(saved.error).toBe("");
    const entry = getDb().select().from(timeEntries).where(gt(timeEntries.id, lastId)).get();
    expect(entry?.hourlyRateCents).toBe(13_000);

    await saveTimeRate(initialState, form({ id: String(entry!.id), hourlyRate: "" }));
    expect(getDb().select().from(timeEntries).where(eq(timeEntries.id, entry!.id)).get()?.hourlyRateCents).toBeNull();

    await saveTimeRate(initialState, form({ id: String(entry!.id), hourlyRate: "140,00" }));
    expect(getDb().select().from(timeEntries).where(eq(timeEntries.id, entry!.id)).get()?.hourlyRateCents).toBe(14_000);
  });

  it("refuses a rate that is not an amount", async () => {
    const result = await saveCustomer(initialState, form({ name: "Satz Kunde", hourlyRate: "viel" }));
    expect(result.error).toBeTruthy();
    expect(getDb().select().from(customers).where(eq(customers.name, "Satz Kunde")).get()).toBeUndefined();
  });
});