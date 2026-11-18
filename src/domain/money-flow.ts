/**
 * The value chain behind the money-flow page.
 *
 * The figures come from the journal of one calendar year. Revenue and output
 * VAT are the gross amount that customers owe. Personnel expense is split into
 * the net pay, the wage tax, and the social-insurance liability. Input VAT is
 * part of the gross purchases but is reclaimed against output VAT, so only the
 * net VAT leaves for the tax office.
 *
 * The slices add up to the source by construction. Normally that source is the
 * gross revenue. A VAT credit or a loss adds funding, so the shares still add
 * up to 100 % instead of hiding a negative band:
 *
 *   gross = net revenue + output VAT
 *         = purchases (net + input VAT)
 *         + net pay + wage tax + social insurance
 *         + (output VAT - input VAT)
 *         + corporate tax + solidarity surcharge + trade tax
 *         + profit after tax
 */

export type MoneyFlowSliceKey =
  | "purchases"
  | "netWages"
  | "wageTax"
  | "social"
  | "vat"
  | "corporate"
  | "soli"
  | "trade"
  | "profit";

export type MoneyFlowSlice = {
  key: MoneyFlowSliceKey;
  amountCents: number;
};

export type TaxFlow = {
  corporateCents: number;
  soliCents: number;
  tradeCents: number;
};

export type MoneyFlowInput = {
  /** Net revenue from the profit and loss accounts. */
  revenueCents: number;
  /** Output VAT on sales invoices. */
  outputVatCents: number;
  /** Operating expense before tax, including personnel expense. */
  expenseCents: number;
  /** Deductible input VAT from purchases. */
  inputVatCents: number;
  /** Gross wages, employer social contributions, and flat tax on minijobs. */
  personnelExpenseCents: number;
  /** Wage tax withheld, including the flat tax on minijobs. */
  wageTaxCents: number;
  /** Employee and employer social-insurance liability together. */
  socialCents: number;
  /** VAT prepayments already sent to the tax office. */
  vatPrepaidCents: number;
  /** Planning estimate for the annual corporate, solidarity, and trade tax. */
  taxCents: TaxFlow;
};

export type MoneyFlow = {
  grossRevenueCents: number;
  purchasesNetCents: number;
  purchasesGrossCents: number;
  netWagesCents: number;
  wageTaxCents: number;
  socialCents: number;
  vatPayableCents: number;
  vatPrepaidCents: number;
  vatOpenCents: number;
  corporateCents: number;
  soliCents: number;
  tradeCents: number;
  taxTotalCents: number;
  profitBeforeTaxCents: number;
  profitAfterTaxCents: number;
  /** What the year's activity owes the tax office, before prepayments. */
  taxOfficeDueCents: number;
  /** What is still open after the VAT prepayments. */
  taxOfficeOpenCents: number;
  /** Sum of the slices that carry a positive amount. */
  sliceTotalCents: number;
  /** Gross revenue plus a VAT credit or loss funding, so the slices add up. */
  sourceTotalCents: number;
  /** How much of the source is not gross revenue. */
  fundingCents: number;
  vatCreditCents: number;
  lossFundingCents: number;
  slices: MoneyFlowSlice[];
  balanced: boolean;
};

function positive(value: number): number {
  return Math.max(0, Math.round(value));
}

export function moneyFlow(input: MoneyFlowInput): MoneyFlow {
  const grossRevenueCents = positive(input.revenueCents + input.outputVatCents);
  const purchasesNetCents = positive(input.expenseCents - input.personnelExpenseCents);
  const purchasesGrossCents = positive(purchasesNetCents + input.inputVatCents);
  const netWagesCents = positive(input.personnelExpenseCents - input.wageTaxCents - input.socialCents);
  const vatPayableCents = input.outputVatCents - input.inputVatCents;
  const vatOpenCents = vatPayableCents - input.vatPrepaidCents;
  const taxTotalCents = positive(input.taxCents.corporateCents + input.taxCents.soliCents + input.taxCents.tradeCents);
  const profitBeforeTaxCents = input.revenueCents - input.expenseCents;
  const profitAfterTaxCents = profitBeforeTaxCents - taxTotalCents;

  const slices: MoneyFlowSlice[] = ([
    { key: "purchases", amountCents: purchasesGrossCents },
    { key: "netWages", amountCents: netWagesCents },
    { key: "wageTax", amountCents: positive(input.wageTaxCents) },
    { key: "social", amountCents: positive(input.socialCents) },
    { key: "vat", amountCents: positive(vatPayableCents) },
    { key: "corporate", amountCents: positive(input.taxCents.corporateCents) },
    { key: "soli", amountCents: positive(input.taxCents.soliCents) },
    { key: "trade", amountCents: positive(input.taxCents.tradeCents) },
    { key: "profit", amountCents: positive(profitAfterTaxCents) },
  ] satisfies MoneyFlowSlice[]).filter((slice) => slice.amountCents > 0);

  const sliceTotalCents = slices.reduce((sum, slice) => sum + slice.amountCents, 0);
  const vatCreditCents = positive(-vatPayableCents);
  const lossFundingCents = positive(-profitAfterTaxCents);
  const fundingCents = sliceTotalCents - grossRevenueCents;

  return {
    grossRevenueCents,
    purchasesNetCents,
    purchasesGrossCents,
    netWagesCents,
    wageTaxCents: input.wageTaxCents,
    socialCents: input.socialCents,
    vatPayableCents,
    vatPrepaidCents: input.vatPrepaidCents,
    vatOpenCents,
    corporateCents: input.taxCents.corporateCents,
    soliCents: input.taxCents.soliCents,
    tradeCents: input.taxCents.tradeCents,
    taxTotalCents,
    profitBeforeTaxCents,
    profitAfterTaxCents,
    taxOfficeDueCents: vatPayableCents + input.wageTaxCents + taxTotalCents,
    taxOfficeOpenCents: vatOpenCents + input.wageTaxCents + taxTotalCents,
    sliceTotalCents,
    sourceTotalCents: sliceTotalCents,
    fundingCents,
    vatCreditCents,
    lossFundingCents,
    slices,
    balanced: fundingCents === 0,
  };
}

export function flowShareBps(partCents: number, totalCents: number): number {
  if (totalCents <= 0) return 0;
  return Math.round((partCents * 10_000) / totalCents);
}