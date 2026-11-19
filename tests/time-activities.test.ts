import { describe, expect, it } from "vitest";
import { MAX_TIME_ACTIVITIES, parseTimeActivities, timeActivitiesProblem } from "@/domain/time";

describe("time activities", () => {
  it("keeps one activity per line and drops blank lines", () => {
    expect(parseTimeActivities("  Konzept  \n\nUmsetzung\r\n  Tests  \n")).toEqual(["Konzept", "Umsetzung", "Tests"]);
  });

  it("keeps a comma inside one activity", () => {
    expect(parseTimeActivities("Einrichtung, Tests und Übergabe")).toEqual(["Einrichtung, Tests und Übergabe"]);
  });

  it("refuses too many or too long activities", () => {
    expect(timeActivitiesProblem(Array.from({ length: MAX_TIME_ACTIVITIES }, (_, index) => `A${index}`))).toBeNull();
    expect(timeActivitiesProblem(Array.from({ length: MAX_TIME_ACTIVITIES + 1 }, (_, index) => `A${index}`))).toContain("at most");
    expect(timeActivitiesProblem(["x".repeat(401)])).toContain("400");
  });
});