import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
import { getDb } from "@/db/client";
import { initialState } from "@/server/form";
import { readUiSettings } from "@/server/queries";
import { saveSettings } from "@/server/actions";

const repo = process.cwd();
let dir = "";

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-settings-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  getDb();
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("saving display settings", () => {
  it("persists the global mode", async () => {
    const form = new FormData();
    form.set("detailSidebarMode", "overlay");
    const saved = await saveSettings(initialState, form);
    expect(saved.error).toBe("");
    expect(readUiSettings().detailSidebarMode).toBe("overlay");

    const inline = new FormData();
    inline.set("detailSidebarMode", "inline");
    await saveSettings(initialState, inline);
    expect(readUiSettings().detailSidebarMode).toBe("inline");
  });

  it("keeps page overrides and clears them with an empty choice", async () => {
    const form = new FormData();
    form.set("detailSidebarMode", "inline");
    form.set("page.customers", "overlay");
    form.set("page.time", "");
    await saveSettings(initialState, form);
    expect(readUiSettings().detailSidebarOverrides).toEqual({ customers: "overlay" });

    const cleared = new FormData();
    cleared.set("detailSidebarMode", "inline");
    await saveSettings(initialState, cleared);
    expect(readUiSettings().detailSidebarOverrides).toEqual({});
  });
});