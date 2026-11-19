import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: vi.fn() }));

import { getDb } from "@/db/client";
import { appSettings } from "@/db/schema";
import { readUiSettings } from "@/server/queries";
import { saveSettings } from "@/server/actions";
import { initialState } from "@/server/form";
import { settingsView, shellView } from "@/server/views";

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

describe("display settings", () => {
  it("starts with the inline default and no page overrides", () => {
    expect(readUiSettings()).toEqual({ detailSidebarMode: "inline", detailSidebarOverrides: {}, invoiceLineOrder: "newestFirst", invoiceLineGrouping: "none" });
    expect(settingsView().settings.detailSidebarMode).toBe("inline");
    expect(shellView().settings.detailSidebarMode).toBe("inline");
  });

  it("saves a global mode and a page override", async () => {
    const form = new FormData();
    form.set("detailSidebarMode", "overlay");
    form.set("page.customers", "inline");

    expect(await saveSettings(initialState, form)).toEqual({ error: "", message: "Settings saved." });

    const stored = getDb().select().from(appSettings).get();
    expect(stored?.detailSidebarMode).toBe("overlay");
    expect(readUiSettings()).toEqual({
      detailSidebarMode: "overlay",
      detailSidebarOverrides: { customers: "inline" },
      invoiceLineOrder: "newestFirst",
      invoiceLineGrouping: "none",
    });
    expect(settingsView().settings.detailSidebarOverrides.customers).toBe("inline");
  });

  it("clears a page override when the page uses the global value", async () => {
    const form = new FormData();
    form.set("detailSidebarMode", "inline");
    form.set("page.customers", "");

    expect(await saveSettings(initialState, form)).toEqual({ error: "", message: "Settings saved." });
    expect(readUiSettings()).toEqual({ detailSidebarMode: "inline", detailSidebarOverrides: {}, invoiceLineOrder: "newestFirst", invoiceLineGrouping: "none" });
  });

  it("rejects an unknown mode", async () => {
    const form = new FormData();
    form.set("detailSidebarMode", "modal");
    const result = await saveSettings(initialState, form);
    expect(result.error).toBe("Choose a valid sidebar layout.");
    expect(readUiSettings().detailSidebarMode).toBe("inline");
  });

  it("switches the order of invoice lines and rejects an unknown value", async () => {
    const form = new FormData();
    form.set("detailSidebarMode", "inline");
    form.set("invoiceLineOrder", "oldestFirst");
    expect(await saveSettings(initialState, form)).toEqual({ error: "", message: "Settings saved." });
    expect(readUiSettings().invoiceLineOrder).toBe("oldestFirst");

    const invalid = new FormData();
    invalid.set("detailSidebarMode", "inline");
    invalid.set("invoiceLineOrder", "sideways");
    expect((await saveSettings(initialState, invalid)).error).toBe("Choose a valid order for invoice lines.");
    expect(readUiSettings().invoiceLineOrder).toBe("oldestFirst");
  });

  it("switches the grouping of invoice lines and rejects an unknown value", async () => {
    const form = new FormData();
    form.set("detailSidebarMode", "inline");
    form.set("invoiceLineGrouping", "date");
    expect(await saveSettings(initialState, form)).toEqual({ error: "", message: "Settings saved." });
    expect(readUiSettings().invoiceLineGrouping).toBe("date");

    const invalid = new FormData();
    invalid.set("detailSidebarMode", "inline");
    invalid.set("invoiceLineGrouping", "week");
    expect((await saveSettings(initialState, invalid)).error).toBe("Choose a valid grouping for invoice lines.");
    expect(readUiSettings().invoiceLineGrouping).toBe("date");
  });
});
