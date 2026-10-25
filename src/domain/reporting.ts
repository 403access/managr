import type { AccountType, PnlGroup } from "./accounts";
import { signedBalance } from "./accounts";

export type ProfitSummary = {
  revenueCents: number;
  expenseCents: number;
  taxExpenseCents: number;
  profitBeforeTaxCents: number;
  profitAfterTaxCents: number;
};

export function summarizeProfit(rows: { pnl: PnlGroup; debitCents: number; creditCents: number }[]): ProfitSummary {
  let revenueCents = 0;
  let expenseCents = 0;
  let taxExpenseCents = 0;
  for (const row of rows) {
    if (row.pnl === "revenue") revenueCents += row.creditCents - row.debitCents;
    if (row.pnl === "expense") expenseCents += row.debitCents - row.creditCents;
    if (row.pnl === "tax") taxExpenseCents += row.debitCents - row.creditCents;
  }
  return {
    revenueCents,
    expenseCents,
    taxExpenseCents,
    profitBeforeTaxCents: revenueCents - expenseCents,
    profitAfterTaxCents: revenueCents - expenseCents - taxExpenseCents,
  };
}

export function balanceSheetTotals(rows: { type: AccountType; debitCents: number; creditCents: number }[]): {
  assetsCents: number;
  liabilitiesCents: number;
  equityCents: number;
} {
  let assetsCents = 0;
  let liabilitiesCents = 0;
  let equityCents = 0;
  for (const row of rows) {
    const balance = signedBalance(row.type, row.debitCents, row.creditCents);
    if (row.type === "asset") assetsCents += balance;
    if (row.type === "liability") liabilitiesCents += balance;
    if (row.type === "equity") equityCents += balance;
  }
  return { assetsCents, liabilitiesCents, equityCents };
}
