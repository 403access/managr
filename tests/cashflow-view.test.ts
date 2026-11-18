import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { todayIso } from "@/domain/calendar";
import { cashflowView } from "@/server/views";

const repo = process.cwd();
let dir = "";

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-cashflow-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  getDb();
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("money-flow view on the sample company", () => {
  const year = Number(todayIso().slice(0, 4));

  it("reads the year's invoices and splits them into paid and open", () => {
    const data = cashflowView(year);
    expect(data.billing.count).toBeGreaterThan(0);
    expect(data.billing.grossCents).toBeGreaterThan(0);
    expect(data.billing.paidCents + data.billing.openCents).toBe(data.billing.grossCents);
    expect(data.billing.netCents + data.billing.vatCents).toBe(data.billing.grossCents);
  });

  it("lets the flow slices add up to the source", () => {
    const data = cashflowView(year);
    expect(data.flow.sourceTotalCents).toBe(data.flow.sliceTotalCents);
    expect(data.flow.balanced).toBe(true);
    expect(data.flow.slices.reduce((sum, slice) => sum + slice.amountCents, 0)).toBe(data.flow.sliceTotalCents);
    expect(data.flow.slices.some((slice) => slice.key === "purchases")).toBe(true);
    expect(data.flow.slices.some((slice) => slice.key === "netWages")).toBe(true);
    expect(data.flow.slices.some((slice) => slice.key === "vat")).toBe(true);
  });

  it("keeps the VAT chain consistent", () => {
    const data = cashflowView(year);
    expect(data.vat.outputCents).toBe(data.vat.output19Cents + data.vat.output7Cents);
    expect(data.vat.inputCents).toBe(data.vat.input19Cents + data.vat.input7Cents);
    expect(data.vat.payableCents).toBe(data.vat.outputCents - data.vat.inputCents);
    expect(data.vat.openCents).toBe(data.vat.payableCents - data.vat.prepaidCents);
    expect(data.flow.taxOfficeOpenCents).toBe(data.vat.openCents + data.payroll.wageTaxCents + data.tax.totalCents);
  });

  it("reconciles the bank opening balance with the grouped movements", () => {
    const data = cashflowView(year);
    expect(data.cash.closingCents - data.cash.openingCents).toBe(data.cash.inflowCents - data.cash.outflowCents);
    expect(data.cash.categories.length).toBeGreaterThan(0);
    expect(data.cash.categories.some((row) => row.key === "customer")).toBe(true);
    expect(data.cash.categories.some((row) => row.key === "expense")).toBe(true);
  });
});