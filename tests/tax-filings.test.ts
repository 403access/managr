import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { obligationStates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { todayIso } from "@/domain/calendar";
import type { VatFigures } from "@/domain/elster-format";
import { taxFilingView, taxView } from "@/server/views";
import {
  calculateTaxFiling,
  checkTaxFiling,
  createCorrection,
  createTaxFiling,
  deleteTaxFiling,
  listFilingTransmissions,
  listTaxFilings,
  loadTaxFiling,
  parseChecks,
  parseFigures,
  releaseTaxFiling,
  submitTaxFilingManually,
  taxFilingExport,
} from "@/server/tax-filings";
import { restoreDeleted, trashView } from "@/server/trash";

const repo = process.cwd();
let dir = "";
const year = Number(todayIso().slice(0, 4));

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-tax-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  getDb();
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("tax filings on the sample company", () => {
  it("creates a draft with a statutory date and refuses a duplicate", () => {
    const filing = createTaxFiling({ kind: "ustva", year, periodKey: `${year}-01` });
    expect(filing.status).toBe("draft");
    expect(filing.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filing.formatVersion).toBe(`UStVA-${year}`);
    expect(() => createTaxFiling({ kind: "ustva", year, periodKey: `${year}-01` })).toThrow(/already exists/i);
  });

  it("calculates figures from the journal and freezes a hash", () => {
    const filing = listTaxFilings(year).find((row) => row.kind === "ustva" && row.periodKey === `${year}-01`)!;
    const calculated = calculateTaxFiling(filing.id);
    expect(calculated.status).toBe("calculated");
    expect(calculated.figuresHash).toHaveLength(64);
    const figures = parseFigures(calculated.figuresJson) as VatFigures;
    expect(figures.kind).toBe("ustva");
    expect(figures.payableCents).toBe(
      figures.outputVat19Cents + figures.outputVat7Cents - figures.inputVat19Cents - figures.inputVat7Cents - figures.prepaymentsCents,
    );
  });

  it("checks, requires confirmation for warnings, and releases", () => {
    const filing = listTaxFilings(year).find((row) => row.kind === "ustva" && row.periodKey === `${year}-01`)!;
    const checked = checkTaxFiling(filing.id);
    expect(checked.checks.length).toBeGreaterThan(0);
    expect(checked.checks.some((check) => check.code === "manual-path")).toBe(true);
    const warnings = checked.checks.filter((check) => check.severity === "warn");
    if (warnings.length > 0) {
      expect(() => releaseTaxFiling(filing.id, false)).toThrow(/Confirm the warnings/i);
    }
    const released = releaseTaxFiling(filing.id, true);
    expect(released.status).toBe("ready");
  });

  it("records a manual filing, its ticket, and the obligation", async () => {
    const filing = listTaxFilings(year).find((row) => row.kind === "ustva" && row.periodKey === `${year}-01`)!;
    const submitted = await submitTaxFilingManually(filing.id, {
      ticket: "TEST-123",
      submittedOn: todayIso(),
      confirmed: true,
      protocol: null,
    });
    expect(submitted.status).toBe("submitted_manually");
    expect(submitted.submittedAt?.slice(0, 10)).toBe(todayIso());
    const transmissions = listFilingTransmissions(filing.id);
    expect(transmissions[0]?.transport).toBe("manual");
    expect(transmissions[0]?.ticket).toBe("TEST-123");
    const state = getDb()
      .select()
      .from(obligationStates)
      .where(eq(obligationStates.key, `ustva-${year}-01`))
      .get();
    expect(state?.status).toBe("done");
    const view = taxFilingView(filing.id);
    expect(view?.filing.status).toBe("submitted_manually");
    expect(view?.transmissions[0]?.ticket).toBe("TEST-123");
  });

  it("refuses a manual filing before the release", async () => {
    const kst = createTaxFiling({ kind: "kst", year, periodKey: String(year) });
    await expect(
      submitTaxFilingManually(kst.id, { ticket: "X", submittedOn: todayIso(), confirmed: true, protocol: null }),
    ).rejects.toThrow(/Release the return/i);
  });

  it("exports a UStVA upload file and a data package", () => {
    const filing = listTaxFilings(year).find((row) => row.kind === "ustva" && row.periodKey === `${year}-01`)!;
    const xml = taxFilingExport(filing.id, "xml");
    expect(xml.filename).toMatch(/\.xml$/);
    expect(xml.body).toContain("<Anmeldungssteuern");
    expect(xml.body).toContain("<Kz81>");
    const json = taxFilingExport(filing.id, "json");
    expect(JSON.parse(json.body).schema).toBe("managr.tax-filing/1");
    const csv = taxFilingExport(filing.id, "csv");
    expect(csv.body).toContain('"83"');
  });

  it("creates a correction and keeps the original", () => {
    const filing = listTaxFilings(year).find((row) => row.kind === "ustva" && row.periodKey === `${year}-01`)!;
    const correction = createCorrection(filing.id);
    expect(correction.status).toBe("draft");
    expect(correction.replacesId).toBe(filing.id);
    expect(loadTaxFiling(filing.id)?.status).toBe("submitted_manually");
    deleteTaxFiling(correction.id);
    expect(loadTaxFiling(correction.id)).toBeNull();
    expect(trashView().some((entry) => entry.kind === "tax-filing" && entry.id === correction.id)).toBe(true);
    expect(restoreDeleted("tax-filing", correction.id)).toEqual({ ok: true });
    expect(loadTaxFiling(correction.id)?.status).toBe("draft");
  });

  it("keeps the list and the detail view scoped to the active company", () => {
    const filings = listTaxFilings(year);
    expect(filings.length).toBeGreaterThan(0);
    const view = taxView(year);
    expect(view.filings.length).toBe(filings.length);
    expect(view.filings.every((row) => row.year === year)).toBe(true);
    expect(taxFilingView(999_999)).toBeNull();
  });

  it("stores parsed checks with severities", () => {
    const filing = listTaxFilings(year).find((row) => row.kind === "ustva" && row.periodKey === `${year}-01`)!;
    const checks = parseChecks(filing.checksJson);
    expect(checks.every((check) => ["block", "warn", "info"].includes(check.severity))).toBe(true);
  });
});