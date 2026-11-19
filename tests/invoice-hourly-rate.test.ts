import { describe, expect, it } from "vitest";
import { sharedHourlyRateCents } from "@/domain/invoice";

describe("shared invoice hourly rate", () => {
  it("finds the rate when every position comes from time at the same price", () => {
    expect(sharedHourlyRateCents([
      { unitNetCents: 3_000, entryDate: "2026-10-01" },
      { unitNetCents: 3_000, entryDate: "2026-10-02" },
    ])).toBe(3_000);
  });

  it("returns nothing when the rates differ", () => {
    expect(sharedHourlyRateCents([
      { unitNetCents: 3_000, entryDate: "2026-10-01" },
      { unitNetCents: 3_500, entryDate: "2026-10-02" },
    ])).toBeNull();
  });

  it("returns nothing when a hand-typed position has no day", () => {
    expect(sharedHourlyRateCents([
      { unitNetCents: 3_000, entryDate: "2026-10-01" },
      { unitNetCents: 3_000, entryDate: null },
    ])).toBeNull();
  });

  it("returns nothing for an empty invoice or a zero rate", () => {
    expect(sharedHourlyRateCents([])).toBeNull();
    expect(sharedHourlyRateCents([{ unitNetCents: 0, entryDate: "2026-10-01" }])).toBeNull();
  });
});