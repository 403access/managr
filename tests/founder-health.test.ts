import { describe, expect, it } from "vitest";
import { reviewFounderHealth, type FounderHealthReviewInput } from "@/domain/founder-health";

const cover = {
  kind: "private",
  provider: "Nordstern",
  monthlyPremiumCents: 48_600,
  startsOn: "2024-03-15",
  statusProcedure: "not_required",
  statusOn: null,
  statusOutcome: "not_socially_insured",
  notes: "Private cover",
};

const base: FounderHealthReviewInput = {
  kind: "managing_director",
  ownershipBps: 10_000,
  cover,
  startDate: "2024-03-15",
  today: "2026-11-18",
};

function warnings(patch: Partial<FounderHealthReviewInput>): string[] {
  return reviewFounderHealth({ ...base, ...patch }).warnings;
}

describe("founder health cover review", () => {
  it("accepts private cover for a controlling director without a status procedure", () => {
    expect(warnings({})).toEqual([]);
  });

  it("asks for cover and a premium", () => {
    expect(warnings({ cover: null }).join(" ")).toMatch(/No health cover/);
    expect(warnings({ cover: { ...cover, monthlyPremiumCents: 0 } }).join(" ")).toMatch(/no monthly premium/);
  });

  it("keeps an open status procedure visible", () => {
    expect(warnings({ cover: { ...cover, statusProcedure: "requested", statusOutcome: "open" } }).join(" ")).toMatch(/still open/);
    expect(warnings({ cover: { ...cover, statusProcedure: "completed", statusOn: null } }).join(" ")).toMatch(/no date/);
  });

  it("asks for a status procedure when the director has half the shares or less", () => {
    expect(warnings({ ownershipBps: 5_000 }).join(" ")).toMatch(/Statusfeststellungsverfahren/);
  });

  it("does not review anybody who is not a managing director", () => {
    expect(reviewFounderHealth({ ...base, kind: "regular", cover: null }).warnings).toEqual([]);
  });
});