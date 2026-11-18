import { describe, expect, it } from "vitest";
import { flowShareBps, moneyFlow } from "@/domain/money-flow";

const base = {
  revenueCents: 1_000_000,
  outputVatCents: 190_000,
  expenseCents: 400_000,
  inputVatCents: 50_000,
  personnelExpenseCents: 300_000,
  wageTaxCents: 40_000,
  socialCents: 60_000,
  vatPrepaidCents: 20_000,
  taxCents: { corporateCents: 30_000, soliCents: 1_650, tradeCents: 28_700 },
};

describe("money flow", () => {
  it("splits gross revenue across purchases, people, the tax office, and profit", () => {
    const flow = moneyFlow(base);
    expect(flow.grossRevenueCents).toBe(1_190_000);
    expect(flow.purchasesNetCents).toBe(100_000);
    expect(flow.purchasesGrossCents).toBe(150_000);
    expect(flow.netWagesCents).toBe(200_000);
    expect(flow.vatPayableCents).toBe(140_000);
    expect(flow.vatOpenCents).toBe(120_000);
    expect(flow.profitBeforeTaxCents).toBe(600_000);
    expect(flow.profitAfterTaxCents).toBe(539_650);
    expect(flow.taxOfficeDueCents).toBe(240_350);
    expect(flow.taxOfficeOpenCents).toBe(220_350);
    expect(flow.balanced).toBe(true);
    expect(flow.sliceTotalCents).toBe(flow.sourceTotalCents);
    expect(flow.slices.reduce((sum, slice) => sum + slice.amountCents, 0)).toBe(1_190_000);
  });

  it("adds a VAT credit and a loss as funding so the slices still add up", () => {
    const flow = moneyFlow({
      ...base,
      revenueCents: 100_000,
      outputVatCents: 19_000,
      expenseCents: 120_000,
      inputVatCents: 30_000,
      personnelExpenseCents: 80_000,
      wageTaxCents: 10_000,
      socialCents: 15_000,
      vatPrepaidCents: 0,
      taxCents: { corporateCents: 0, soliCents: 0, tradeCents: 0 },
    });
    expect(flow.vatPayableCents).toBe(-11_000);
    expect(flow.profitAfterTaxCents).toBe(-20_000);
    expect(flow.vatCreditCents).toBe(11_000);
    expect(flow.lossFundingCents).toBe(20_000);
    expect(flow.fundingCents).toBe(31_000);
    expect(flow.balanced).toBe(false);
    expect(flow.sourceTotalCents).toBe(flow.sliceTotalCents);
    expect(flow.slices.reduce((sum, slice) => sum + slice.amountCents, 0)).toBe(150_000);
  });

  it("computes shares in basis points", () => {
    expect(flowShareBps(25, 100)).toBe(2_500);
    expect(flowShareBps(1, 0)).toBe(0);
  });
});