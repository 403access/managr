import { describe, expect, it } from "vitest";
import { formatDate } from "@/domain/calendar";
import { formatEuro, parseEuroToCents, parseQuantityMilli, percentOf } from "@/domain/money";

describe("money", () => {
  it("rounds half up", () => {
    expect(percentOf(10, 1900)).toBe(2);
    expect(percentOf(3, 1900)).toBe(1);
  });

  it("parses German and plain euro amounts", () => {
    expect(parseEuroToCents("1234")).toBe(123400);
    expect(parseEuroToCents("1.234,56")).toBe(123456);
    expect(parseEuroToCents("1,234.56")).toBe(123456);
    expect(parseEuroToCents("49.90")).toBe(4990);
    expect(parseEuroToCents("49,9")).toBe(4990);
    expect(parseEuroToCents("1.000")).toBe(100000);
    expect(parseEuroToCents("0,5")).toBe(50);
    expect(parseEuroToCents("")).toBeNull();
    expect(parseEuroToCents("12,345")).toBeNull();
    expect(parseEuroToCents("abc")).toBeNull();
  });

  it("parses quantities to thousandths", () => {
    expect(parseQuantityMilli("1,5")).toBe(1500);
    expect(parseQuantityMilli("2")).toBe(2000);
    expect(parseQuantityMilli("0.25")).toBe(250);
  });

  it("formats euros and dates in German", () => {
    expect(formatEuro(123456).replace(/\s/g, " ")).toBe("1.234,56 €");
    expect(formatDate("2026-10-25")).toBe("25.10.2026");
  });
});
