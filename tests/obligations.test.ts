import { describe, expect, it } from "vitest";
import { easterSunday, federalHolidays, fiscalYearContaining, nextDueDate, rollForwardBusinessDay, thirdLastBankingDay, toUtcDate } from "@/domain/calendar";
import { policyReminders, statutoryObligations } from "@/domain/obligations";

const calendarYear = { fiscalYearStartMonth: 1, vatPermanentExtension: false, usesTaxAdvisor: false };

describe("calendar", () => {
  it("knows Easter 2026 and rolls weekends and Unity Day forward", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(federalHolidays(2026)).toEqual(expect.arrayContaining(["2026-04-03", "2026-04-06", "2026-05-14", "2026-05-25", "2026-10-03"]));
    expect(toUtcDate("2026-01-01").getUTCDay()).toBe(4);
    expect(rollForwardBusinessDay("2026-08-01")).toBe("2026-08-03");
    expect(thirdLastBankingDay(2026, 8)).toBe("2026-08-27");
  });

  it("clamps month ends and labels a shifted financial year", () => {
    expect(nextDueDate("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextDueDate("2026-01-31", "none")).toBeNull();
    expect(fiscalYearContaining("2026-10-25", 1)).toMatchObject({ start: "2026-01-01", end: "2026-12-31", label: "2026" });
    expect(fiscalYearContaining("2026-03-01", 7)).toMatchObject({ start: "2025-07-01", end: "2026-06-30", label: "2025/26" });
  });
});

describe("statutory obligations", () => {
  const due2026 = statutoryObligations(2026, calendarYear);

  it("moves the September VAT return off the Saturday", () => {
    const vat = due2026.find((item) => item.key === "ustva-2026-09");
    expect(vat?.dueDate).toBe("2026-10-12");
  });

  it("uses 10 December for the last corporate-tax advance", () => {
    expect(due2026.find((item) => item.key === "kst-advance-2026-q4")?.dueDate).toBe("2026-12-10");
  });

  it("puts the 2025 return on 31 July and disclosure on 31 December when there is no adviser", () => {
    expect(due2026.find((item) => item.key === "kst-return-2025")?.dueDate).toBe("2026-07-31");
    expect(due2026.find((item) => item.key === "disclosure-2025")?.dueDate).toBe("2026-12-31");
    expect(due2026.find((item) => item.key === "bg-lohn-2025")?.dueDate).toBe("2026-02-16");
  });

  it("moves the adviser deadline to the end of the 14th month", () => {
    const advised = statutoryObligations(2027, { ...calendarYear, usesTaxAdvisor: true });
    expect(advised.find((item) => item.key === "kst-return-2025")?.dueDate).toBe("2027-03-01");
    expect(advised.find((item) => item.key === "kst-return-2026")).toBeUndefined();
  });

  it("shifts a permanently extended VAT return by one month", () => {
    const extended = statutoryObligations(2026, { ...calendarYear, vatPermanentExtension: true });
    expect(extended.find((item) => item.key === "ustva-2026-09")?.dueDate).toBe("2026-11-10");
  });

  it("reminds about a policy inside the horizon", () => {
    const reminders = policyReminders(
      [
        { id: 1, label: "Liability", renewalDate: "2026-11-01" },
        { id: 2, label: "Later", renewalDate: "2027-06-01" },
      ],
      "2026-10-25",
    );
    expect(reminders.map((item) => item.id)).toEqual([1]);
  });
});
