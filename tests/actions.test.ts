import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: vi.fn() }));

import { getDb } from "@/db/client";
import { companies } from "@/db/schema";
import { switchCompany } from "@/server/actions";
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