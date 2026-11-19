import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { customerView, customersView } from "@/server/views";

const repo = process.cwd();
let dir = "";

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-customers-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  getDb();
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("customer views on the sample company", () => {
  it("rolls projects, booked time, and invoices into the list", () => {
    const { customers } = customersView();
    const lichtfeld = customers.find((customer) => customer.name === "Lichtfeld GmbH");
    expect(lichtfeld).toBeTruthy();
    expect(lichtfeld!.projectCount).toBe(1);
    expect(lichtfeld!.minutes).toBeGreaterThan(0);
    expect(lichtfeld!.billableMinutes).toBeGreaterThan(0);
    expect(lichtfeld!.billableMinutes).toBeLessThan(lichtfeld!.minutes);
    expect(lichtfeld!.invoiceCount).toBe(2);
    expect(lichtfeld!.revenueCents).toBeGreaterThan(0);
    expect(lichtfeld!.openCents).toBe(0);
    expect(lichtfeld!.lastActivity).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("keeps unpaid invoices as open amounts", () => {
    const { customers } = customersView();
    const havel = customers.find((customer) => customer.name === "Havel & Sohn AG");
    expect(havel).toBeTruthy();
    expect(havel!.invoiceCount).toBe(1);
    expect(havel!.openCents).toBeGreaterThan(0);
  });

  it("returns projects, booked time, and invoices for one customer", () => {
    const listed = customersView().customers.find((customer) => customer.name === "Lichtfeld GmbH");
    expect(listed).toBeTruthy();
    const detail = customerView(listed!.id);
    expect(detail).toBeTruthy();
    expect(detail!.customer.name).toBe("Lichtfeld GmbH");
    expect(detail!.projects).toHaveLength(1);
    expect(detail!.projects[0]?.name).toBe("Markenauftritt Lichtfeld");
    expect(detail!.projects[0]?.minutes).toBe(detail!.totals.minutes);
    expect(detail!.entries.length).toBeGreaterThan(0);
    expect(detail!.entries.every((entry) => entry.projectId === detail!.projects[0]?.id)).toBe(true);
    expect(detail!.entries[0]?.projectName).toBe("Markenauftritt Lichtfeld");
    expect(detail!.invoices.some((invoice) => invoice.displayStatus === "draft")).toBe(true);
    expect(detail!.totals.lastActivity).not.toBeNull();
  });

  it("returns null for an unknown customer", () => {
    expect(customerView(999_999)).toBeNull();
  });
});