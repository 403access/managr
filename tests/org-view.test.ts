import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: vi.fn() }));

import { getDb } from "@/db/client";
import { orgView, peoplePageView, personView } from "@/server/views";

const repo = process.cwd();
let dir = "";

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "managr-org-"));
  fs.cpSync(path.join(repo, "src/db/migrations"), path.join(dir, "src/db/migrations"), { recursive: true });
  process.chdir(dir);
  getDb();
});

afterAll(() => {
  process.chdir(repo);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("org chart on the sample desk", () => {
  it("draws the sample reporting lines from the managing director", () => {
    const view = orgView();
    expect(view.total).toBe(3);
    expect(view.depth).toBe(2);
    expect(view.roots).toHaveLength(1);
    expect(view.roots[0]!.firstName).toBe("Mara");
    expect(view.roots[0]!.children).toHaveLength(2);
    expect(view.former).toHaveLength(0);
  });

  it("serves the org chart alongside the people list on the People page", () => {
    const view = peoplePageView();
    expect(view.people).toHaveLength(3);
    expect(view.org.roots[0]!.firstName).toBe("Mara");
  });

  it("offers the colleagues of a person without offering that person", () => {
    const root = orgView().roots[0]!;
    const view = personView(root.id)!;
    expect(view.colleagues).toHaveLength(2);
    expect(view.colleagues.some((colleague) => colleague.id === root.id)).toBe(false);
  });
});