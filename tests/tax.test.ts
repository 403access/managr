import { describe, expect, it } from "vitest";
import { CHART, ACCOUNTS, journalImbalance } from "@/domain/accounts";
import { AVERAGE_TOTAL_SV_BPS, FAKTOR_F_NUMERATOR, GMBH_MINIMUM_CAPITAL_CENTS, KLEIN_CURRENT_CENTS, KLEIN_FOUNDING_CENTS, KLEIN_PRIOR_CENTS, MINIJOB_LIMIT_CENTS, derivedMinijobLimitCents } from "@/domain/rates-2026";
import { conversionGap, requiredReserveCents } from "@/domain/reserve";
import { estimateCorporateTax, kleinunternehmerAssessment } from "@/domain/tax";
import { lineNetCents, summarizeVat } from "@/domain/vat";
import { balanceSheetTotals, summarizeProfit } from "@/domain/reporting";

describe("rates", () => {
  it("derives the 2026 minijob ceiling from the minimum wage", () => {
    expect(derivedMinijobLimitCents(1390)).toBe(60_300);
    expect(MINIJOB_LIMIT_CENTS).toBe(60_300);
  });

  it("locks the published Faktor F against the average total rate", () => {
    expect(AVERAGE_TOTAL_SV_BPS).toBe(4230);
    expect(Math.round((2_800 * 10_000) / AVERAGE_TOTAL_SV_BPS)).toBe(FAKTOR_F_NUMERATOR);
  });

  it("keeps chart codes unique and addressable", () => {
    const codes = CHART.map((account) => account.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of Object.values(ACCOUNTS)) expect(codes).toContain(code);
  });
});

describe("VAT", () => {
  it("rounds once per rate on the summed net", () => {
    const result = summarizeVat(
      [
        { netCents: 1, vatBps: 1900 },
        { netCents: 1, vatBps: 1900 },
        { netCents: 1, vatBps: 1900 },
      ],
      false,
    );
    expect(result.vatCents).toBe(1);
    expect(result.grossCents).toBe(4);
  });

  it("splits two rates and prices a quantity", () => {
    expect(lineNetCents(1500, 2000)).toBe(3000);
    const result = summarizeVat(
      [
        { netCents: 10_000, vatBps: 1900 },
        { netCents: 5_000, vatBps: 700 },
      ],
      false,
    );
    expect(result).toMatchObject({ netCents: 15_000, vatCents: 1_900 + 350, grossCents: 17_250 });
  });

  it("refuses VAT on a Kleinunternehmer line", () => {
    expect(() => summarizeVat([{ netCents: 100, vatBps: 1900 }], true)).toThrow(/Kleinunternehmer/);
  });
});

describe("corporate tax and the small-business exemption", () => {
  it("estimates tax on a UG without a trade-tax allowance", () => {
    const estimate = estimateCorporateTax(4_000_000, 410, 0);
    expect(estimate).toEqual({
      taxableCents: 4_000_000,
      corporateCents: 600_000,
      soliCents: 33_000,
      tradeCents: 574_000,
      totalCents: 1_207_000,
    });
    expect(estimateCorporateTax(1_000_000, 410, 0).tradeCents).toBe(143_500);
  });

  it("uses a loss carryforward and ignores a loss", () => {
    expect(estimateCorporateTax(1_000_000, 410, 400_000).taxableCents).toBe(600_000);
    expect(estimateCorporateTax(-50, 410, 0).totalCents).toBe(0);
  });

  it("applies the §19 ceilings, including equality and the founding year", () => {
    const base = {
      foundingDate: "2024-03-15",
      calendarYear: 2026,
      priorYearTurnoverCents: 2_500_000,
      currentYearTurnoverCents: 10_000_000,
      claimsExemption: false,
    };
    expect(kleinunternehmerAssessment(base).eligible).toBe(true);
    expect(kleinunternehmerAssessment(base).currentLimitCents).toBe(KLEIN_CURRENT_CENTS);
    expect(kleinunternehmerAssessment(base).priorLimitCents).toBe(KLEIN_PRIOR_CENTS);
    expect(kleinunternehmerAssessment({ ...base, priorYearTurnoverCents: 2_500_001 }).eligible).toBe(false);
    expect(kleinunternehmerAssessment({ ...base, currentYearTurnoverCents: 10_000_001 }).eligible).toBe(false);
    const founding = kleinunternehmerAssessment({
      foundingDate: "2026-11-02",
      calendarYear: 2026,
      priorYearTurnoverCents: 0,
      currentYearTurnoverCents: 2_500_000,
      claimsExemption: true,
    });
    expect(founding.foundingYear).toBe(true);
    expect(founding.currentLimitCents).toBe(KLEIN_FOUNDING_CENTS);
    expect(founding.eligible).toBe(true);
    expect(
      kleinunternehmerAssessment({
        foundingDate: "2026-11-02",
        calendarYear: 2026,
        priorYearTurnoverCents: 0,
        currentYearTurnoverCents: KLEIN_FOUNDING_CENTS + 1,
        claimsExemption: true,
      }).eligible,
    ).toBe(false);
  });
});

describe("statutory reserve", () => {
  it("allocates a quarter after the loss carryforward", () => {
    expect(requiredReserveCents({ annualSurplusCents: 1_200_000, lossCarryforwardCents: 200_000, shareCapitalCents: 250_000 })).toBe(250_000);
  });

  it("allocates nothing on a loss or once capital has reached the GmbH minimum", () => {
    expect(requiredReserveCents({ annualSurplusCents: -1, lossCarryforwardCents: 0, shareCapitalCents: 100 })).toBe(0);
    expect(requiredReserveCents({ annualSurplusCents: 1_000_000, lossCarryforwardCents: 0, shareCapitalCents: GMBH_MINIMUM_CAPITAL_CENTS })).toBe(0);
    expect(requiredReserveCents({ annualSurplusCents: 1_000_000, lossCarryforwardCents: 0, shareCapitalCents: GMBH_MINIMUM_CAPITAL_CENTS - 1 })).toBe(250_000);
  });

  it("shows the conversion gap without ending the duty early", () => {
    const gap = conversionGap(250_000, 1_600_000);
    expect(gap.gapCents).toBe(GMBH_MINIMUM_CAPITAL_CENTS - 1_850_000);
    expect(gap.dutyActive).toBe(true);
  });
});

describe("journal balance and profit", () => {
  it("rejects an unbalanced entry", () => {
    expect(journalImbalance([{ accountCode: "1200", debitCents: 100, creditCents: 0 }, { accountCode: "8400", debitCents: 0, creditCents: 90 }])).toMatch(/out of balance/);
    expect(journalImbalance([{ accountCode: "1200", debitCents: 100, creditCents: 0 }, { accountCode: "8400", debitCents: 0, creditCents: 100 }])).toBeNull();
  });

  it("keeps tax expense out of profit before tax", () => {
    const profit = summarizeProfit([
      { pnl: "revenue", debitCents: 0, creditCents: 10_000 },
      { pnl: "expense", debitCents: 4_000, creditCents: 0 },
      { pnl: "tax", debitCents: 1_000, creditCents: 0 },
    ]);
    expect(profit.profitBeforeTaxCents).toBe(6_000);
    expect(profit.profitAfterTaxCents).toBe(5_000);
  });

  it("keeps the balance sheet identity with the open result", () => {
    const balance = balanceSheetTotals([
      { type: "asset", debitCents: 11_900, creditCents: 0 },
      { type: "liability", debitCents: 0, creditCents: 1_900 },
      { type: "equity", debitCents: 0, creditCents: 0 },
    ]);
    const profit = summarizeProfit([{ pnl: "revenue", debitCents: 0, creditCents: 10_000 }]);
    expect(balance.assetsCents).toBe(balance.liabilitiesCents + balance.equityCents + profit.profitBeforeTaxCents);
  });
});
