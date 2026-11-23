import { describe, expect, it } from "vitest";
import { quantityFromParts, quantityParts } from "@/components/amounts";

describe("hours and minutes quantity entry", () => {
  it("splits a decimal quantity into whole hours and minutes", () => {
    expect(quantityParts("2,5")).toEqual({ hours: "2", minutes: "30" });
    expect(quantityParts("0,417")).toEqual({ hours: "0", minutes: "25" });
    expect(quantityParts("3")).toEqual({ hours: "3", minutes: "0" });
    expect(quantityParts("")).toEqual({ hours: "", minutes: "" });
  });

  it("combines hours and minutes back into the stored decimal quantity", () => {
    expect(quantityFromParts("2", "30")).toBe("2,5");
    expect(quantityFromParts("3", "0")).toBe("3");
    expect(quantityFromParts("0", "1")).toBe("0,017");
    expect(quantityFromParts("", "45")).toBe("0,75");
    expect(quantityFromParts("", "")).toBe("");
  });

  it("round-trips a quantity without changing its thousandths", () => {
    for (const value of ["0,017", "0,25", "1,5", "2,75", "12"]) {
      const parts = quantityParts(value);
      expect(quantityFromParts(parts.hours, parts.minutes)).toBe(value);
    }
  });
});
