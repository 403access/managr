import { describe, expect, it } from "vitest";
import { parseViewName, parseViewQuery, viewIsReady } from "@/server/view-request";

describe("view requests", () => {
  it("accepts only known view names", () => {
    expect(parseViewName("desk")).toBe("desk");
    expect(parseViewName("invoice-edit")).toBe("invoice-edit");
    expect(parseViewName("payroll")).toBeNull();
  });

  it("keeps a valid id, year, and week, and falls back otherwise", () => {
    const params = new URLSearchParams("id=4&year=2024&week=2026-10-19&all=1");
    expect(parseViewQuery(params, "2026-10-25")).toEqual({ id: 4, year: 2024, week: "2026-10-19", all: true });
    const fallback = parseViewQuery(new URLSearchParams("id=0&year=1999&week=Monday"), "2026-10-25");
    expect(fallback).toEqual({ id: null, year: 2026, week: "2026-10-25", all: false });
  });

  it("requires an id for a single record", () => {
    expect(viewIsReady("invoice", { id: null })).toBe(false);
    expect(viewIsReady("invoice", { id: 3 })).toBe(true);
    expect(viewIsReady("person", { id: null })).toBe(false);
    expect(viewIsReady("desk", { id: null })).toBe(true);
  });
});
