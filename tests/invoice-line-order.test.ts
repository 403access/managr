import { describe, expect, it } from "vitest";
import { sortInvoicePositions } from "@/domain/invoice";

const positions = [
  { id: 1, entryDate: "2026-10-01" },
  { id: 2, entryDate: "2026-10-03" },
  { id: 3, entryDate: null },
  { id: 4, entryDate: "2026-10-02" },
];

describe("invoice position order", () => {
  it("puts the newest time first by default", () => {
    expect(sortInvoicePositions(positions, "newestFirst").map((line) => line.id)).toEqual([2, 4, 1, 3]);
  });

  it("puts the oldest time first when the setting asks for it", () => {
    expect(sortInvoicePositions(positions, "oldestFirst").map((line) => line.id)).toEqual([1, 4, 2, 3]);
  });

  it("keeps hand-typed lines in their order at the end", () => {
    const withTwoManual = [...positions, { id: 5, entryDate: null }];
    expect(sortInvoicePositions(withTwoManual, "newestFirst").map((line) => line.id)).toEqual([2, 4, 1, 3, 5]);
  });
});