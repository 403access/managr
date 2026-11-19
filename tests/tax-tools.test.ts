import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { todayIso } from "@/domain/calendar";
import { findTool, runTool } from "@/server/tools";

const repo = process.cwd();
let dir = "";
const year = Number(todayIso().slice(0, 4));

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-tax-tools-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  getDb();
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

function data<T = Record<string, unknown>>(result: Awaited<ReturnType<typeof runTool>>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data as T;
}

describe("tax tools", () => {
  it("prepares, calculates, checks, and annotates without a release or transmission", async () => {
    const prepared = data<{ id: number; status: string }>(
      await runTool("prepare_tax_filing", { kind: "ustva", year, periodKey: `${year}-01` }),
    );
    expect(prepared.status).toBe("draft");

    const calculated = data<{ status: string; figuresHash: string }>(
      await runTool("calculate_tax_filing", { taxFilingId: prepared.id }),
    );
    expect(calculated.status).toBe("calculated");
    expect(calculated.figuresHash).toHaveLength(64);

    const checked = data<{ status: string; checks: { severity: string }[] }>(
      await runTool("run_tax_checks", { taxFilingId: prepared.id }),
    );
    expect(checked.checks.length).toBeGreaterThan(0);
    expect(checked.checks.every((check) => ["block", "warn", "info"].includes(check.severity))).toBe(true);

    const noted = data<{ saved: boolean }>(await runTool("save_tax_note", { taxFilingId: prepared.id, note: "Checked with the adviser." }));
    expect(noted.saved).toBe(true);

    const detail = data<{ filing: { notes: string }; events: { type: string; actor: string }[] }>(
      await runTool("read_tax_filing", { taxFilingId: prepared.id }),
    );
    expect(detail.filing.notes).toBe("Checked with the adviser.");
    expect(detail.events.some((event) => event.type === "note" && event.actor === "assistant")).toBe(true);

    const list = data<{ filings: { id: number }[] }>(await runTool("read_tax_filings", { year }));
    expect(list.filings.some((filing) => filing.id === prepared.id)).toBe(true);
  });

  it("has no tool that releases or transmits a return", () => {
    expect(findTool("release_tax_filing")).toBeUndefined();
    expect(findTool("submit_tax_filing")).toBeUndefined();
    expect(findTool("transmit_tax_filing")).toBeUndefined();
  });
});