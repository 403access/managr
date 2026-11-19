import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { todayIso } from "@/domain/calendar";
import { commandView } from "@/server/views";

const repo = process.cwd();
let dir = "";

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-command-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  getDb();
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("command view on the sample desk", () => {
  const year = Number(todayIso().slice(0, 4));

  it("keeps every page and the records its screen lists in one index", () => {
    const { entries } = commandView();
    expect(entries.some((entry) => entry.page === "invoices" && entry.title.startsWith("RE-"))).toBe(true);
    expect(entries.some((entry) => entry.page === "customers" && entry.title === "Lichtfeld GmbH")).toBe(true);
    expect(entries.some((entry) => entry.page === "people" && entry.title.includes("Mara"))).toBe(true);
    expect(entries.some((entry) => entry.page === "projects" && entry.title === "Markenauftritt Lichtfeld")).toBe(true);
    expect(entries.some((entry) => entry.page === "projects" && entry.title === "Designsystem und Komponenten")).toBe(true);
    expect(entries.some((entry) => entry.page === "documents" && entry.title === "Gesellschafterliste (Beispiel)")).toBe(true);
    expect(entries.some((entry) => entry.page === "obligations")).toBe(true);
    expect(entries.some((entry) => entry.page === "milestones" && entry.title === "Drei feste Kunden mit Rahmenvertrag")).toBe(true);
    expect(entries.some((entry) => entry.page === "legal" && entry.title.length > 0)).toBe(true);
    expect(entries.some((entry) => entry.page === "company" && entry.title.length > 0)).toBe(true);
    expect(entries.some((entry) => entry.page === "ledger" && entry.title.startsWith("1200"))).toBe(true);
  });

  it("links a record to its detail route or to the section that holds it", () => {
    const { entries } = commandView();
    const invoice = entries.find((entry) => entry.page === "invoices" && entry.title.startsWith("RE-"));
    expect(invoice?.href).toMatch(/^\/invoices\/\d+$/);
    const customer = entries.find((entry) => entry.page === "customers" && entry.title === "Lichtfeld GmbH");
    expect(customer?.href).toMatch(/^\/customers#customer-\d+$/);
    const person = entries.find((entry) => entry.page === "people");
    expect(person?.href).toMatch(/^\/people\/\d+$/);
    const project = entries.find((entry) => entry.page === "projects" && entry.title === "Markenauftritt Lichtfeld");
    expect(project?.href).toMatch(/^\/projects#project-\d+$/);
    const milestone = entries.find((entry) => entry.page === "milestones");
    expect(milestone?.href).toMatch(/^\/milestones\?year=\d{4}#goals$/);
    expect(entries.find((entry) => entry.page === "ledger")?.href).toBe("/ledger#accounts");
    expect(entries.find((entry) => entry.page === "legal")?.href).toMatch(/^\/legal#/);
  });

  it("keeps one id per row and a non-empty search text", () => {
    const { entries } = commandView();
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    for (const entry of entries) {
      expect(entry.title.trim()).not.toBe("");
      expect(entry.keywords.trim()).not.toBe("");
      expect(entry.detail).not.toContain("undefined");
      expect(entry.keywords).not.toContain("undefined");
    }
    expect(entries.some((entry) => entry.title.includes(String(year)) || entry.detail.includes(String(year)))).toBe(true);
  });
});