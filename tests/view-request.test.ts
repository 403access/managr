import { describe, expect, it } from "vitest";
import { parseViewName, parseViewQuery, viewIsReady } from "@/server/view-request";

describe("view requests", () => {
  it("accepts only known view names", () => {
    expect(parseViewName("desk")).toBe("desk");
    expect(parseViewName("command")).toBe("command");
    expect(parseViewName("invoice-edit")).toBe("invoice-edit");
    expect(parseViewName("analytics")).toBe("analytics");
    expect(parseViewName("bank")).toBe("bank");
    expect(parseViewName("settings")).toBe("settings");
    expect(parseViewName("payroll")).toBeNull();
  });

  it("keeps a valid id, year, and week, and falls back otherwise", () => {
    const params = new URLSearchParams("id=4&year=2024&week=2026-10-19&all=1&customer=7");
    expect(parseViewQuery(params, "2026-10-25")).toEqual({
      id: 4,
      year: 2024,
      week: "2026-10-19",
      from: null,
      to: null,
      all: true,
      customer: 7,
    });
    const fallback = parseViewQuery(new URLSearchParams("id=0&year=1999&week=Monday&customer=0"), "2026-10-25");
    expect(fallback).toEqual({ id: null, year: 2026, week: "2026-10-25", from: null, to: null, all: false, customer: null });
  });

  it("accepts an explicit time range only as two real dates", () => {
    const range = parseViewQuery(new URLSearchParams("from=2026-11-01&to=2026-11-30"), "2026-10-25");
    expect({ from: range.from, to: range.to }).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    const broken = parseViewQuery(new URLSearchParams("from=2026-02-30&to=nope"), "2026-10-25");
    expect({ from: broken.from, to: broken.to }).toEqual({ from: null, to: null });
  });

  it("requires an id for a single record", () => {
    expect(viewIsReady("invoice", { id: null })).toBe(false);
    expect(viewIsReady("invoice", { id: 3 })).toBe(true);
    expect(viewIsReady("person", { id: null })).toBe(false);
    expect(viewIsReady("customer", { id: null })).toBe(false);
    expect(viewIsReady("customer", { id: 2 })).toBe(true);
    expect(viewIsReady("desk", { id: null })).toBe(true);
    expect(viewIsReady("command", { id: null })).toBe(true);
  });
});
