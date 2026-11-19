import { describe, expect, it } from "vitest";
import { groupInvoicePositions, resolveInvoiceLineGrouping, sortInvoicePositions } from "@/domain/invoice";

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

describe("invoice position grouping", () => {
  it("leaves the positions in one list when grouping is off", () => {
    const groups = groupInvoicePositions(positions, "none");
    expect(groups).toHaveLength(1);
    expect(groups[0].positions.map((line) => line.id)).toEqual([1, 2, 3, 4]);
  });

  it("groups by day and keeps the sorted order inside the groups", () => {
    const groups = groupInvoicePositions(positions, "date");
    expect(groups.map((group) => group.entryDate)).toEqual(["2026-10-01", "2026-10-03", null, "2026-10-02"]);
    expect(groups.map((group) => group.positions.map((line) => line.id))).toEqual([[1], [2], [3], [4]]);
  });

  it("merges scattered lines of the same day and the undated group", () => {
    const scattered = [
      { id: 1, entryDate: "2026-10-01" },
      { id: 2, entryDate: null },
      { id: 3, entryDate: "2026-10-01" },
      { id: 4, entryDate: null },
    ];
    const groups = groupInvoicePositions(scattered, "date");
    expect(groups.map((group) => group.key)).toEqual(["2026-10-01", "none"]);
    expect(groups.map((group) => group.positions.map((line) => line.id))).toEqual([[1, 3], [2, 4]]);
  });

  it("lets the invoice override the global grouping", () => {
    expect(resolveInvoiceLineGrouping("date", "none")).toBe("date");
    expect(resolveInvoiceLineGrouping("none", "date")).toBe("none");
    expect(resolveInvoiceLineGrouping(null, "date")).toBe("date");
    expect(resolveInvoiceLineGrouping("week", "none")).toBe("none");
  });
});