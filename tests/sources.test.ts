import { describe, expect, it } from "vitest";
import { domainOf, filterSourceGroups, guides, sourceById, sourceGroups, sources } from "@/content/sources";

describe("source register", () => {
  it("derives a parent domain for every source", () => {
    for (const source of sources) {
      expect(source.domain, source.id).toBe(domainOf(source.url));
      expect(source.domain, source.id).not.toContain("www.");
      expect(source.url.startsWith("https://"), source.id).toBe(true);
    }
  });

  it("resolves every source a guide references", () => {
    for (const guide of guides) {
      expect(guide.sourceIds.length, guide.id).toBeGreaterThan(0);
      for (const id of guide.sourceIds) {
        expect(sourceById.get(id), `${guide.id} → ${id}`).toBeTruthy();
      }
    }
  });

  it("uses every registered source in at least one guide", () => {
    for (const source of sources) {
      expect(
        guides.some((guide) => guide.sourceIds.includes(source.id)),
        source.id,
      ).toBe(true);
    }
  });

  it("groups every source under exactly one domain", () => {
    const groups = sourceGroups("de");
    expect(groups.reduce((sum, group) => sum + group.sources.length, 0)).toBe(sources.length);
    expect(new Set(groups.map((group) => group.domain)).size).toBe(groups.length);
    expect(groups.map((group) => group.domain)).toEqual([...groups.map((group) => group.domain)].sort((a, b) => a.localeCompare(b)));
  });

  it("returns every source when no filter is set", () => {
    const groups = filterSourceGroups("de", { query: "", domain: "", topic: "" });
    expect(groups.reduce((sum, group) => sum + group.sources.length, 0)).toBe(sources.length);
  });

  it("filters by free text, ignoring case and umlauts", () => {
    const groups = filterSourceGroups("de", { query: "bundesagentur fur arbeit", domain: "", topic: "" });
    const ids = groups.flatMap((group) => group.sources.map((source) => source.id));
    expect(ids).toContain("arbeitsagentur");
  });

  it("filters by domain", () => {
    const groups = filterSourceGroups("de", { query: "", domain: "aok.de", topic: "" });
    expect(groups).toHaveLength(1);
    expect(groups[0]?.domain).toBe("aok.de");
    expect(groups[0]?.sources.every((source) => source.domain === "aok.de")).toBe(true);
  });

  it("filters by topic and matches the guide's sources", () => {
    const guide = guides.find((entry) => entry.id === "invoice");
    expect(guide).toBeTruthy();
    const groups = filterSourceGroups("de", { query: "", domain: "", topic: "invoice" });
    const ids = groups.flatMap((group) => group.sources.map((source) => source.id)).sort();
    expect(ids).toEqual([...(guide?.sourceIds ?? [])].sort());
  });

  it("combines filters and returns no groups when nothing matches", () => {
    const groups = filterSourceGroups("de", { query: "mindestlohn", domain: "aok.de", topic: "" });
    expect(groups).toEqual([]);
  });
});
