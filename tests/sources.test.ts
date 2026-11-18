import { describe, expect, it } from "vitest";
import { domainOf, guides, sourceById, sourceGroups, sources } from "@/content/sources";

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
});
