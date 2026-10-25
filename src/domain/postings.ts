import { ACCOUNTS, type DraftLine, journalImbalance } from "./accounts";
import type { VatBreakdown } from "./vat";
import { percentOf } from "./money";
import { REDUCED_VAT_BPS, STANDARD_VAT_BPS } from "./rates-2026";

function line(accountCode: string, debitCents: number, creditCents: number): DraftLine {
  return { accountCode, debitCents, creditCents };
}

function dropEmpty(lines: DraftLine[]): DraftLine[] {
  return lines.filter((entry) => entry.debitCents > 0 || entry.creditCents > 0);
}

function checked(lines: DraftLine[]): DraftLine[] {
  const problem = journalImbalance(lines);
  if (problem) throw new Error(problem);
  return lines;
}

function revenueAccount(vatBps: number, kleinunternehmer: boolean): string {
  if (kleinunternehmer) return ACCOUNTS.revenueKlein;
  if (vatBps === STANDARD_VAT_BPS) return ACCOUNTS.revenue19;
  if (vatBps === REDUCED_VAT_BPS) return ACCOUNTS.revenue7;
  if (vatBps === 0) return ACCOUNTS.revenueExempt;
  throw new Error("Unsupported VAT rate.");
}

function outputVatAccount(vatBps: number): string | null {
  if (vatBps === STANDARD_VAT_BPS) return ACCOUNTS.vat19;
  if (vatBps === REDUCED_VAT_BPS) return ACCOUNTS.vat7;
  return null;
}

function inputVatAccount(vatBps: number): string | null {
  if (vatBps === STANDARD_VAT_BPS) return ACCOUNTS.inputVat19;
  if (vatBps === REDUCED_VAT_BPS) return ACCOUNTS.inputVat7;
  return null;
}

export function buildSalesInvoice(input: { kleinunternehmer: boolean; byRate: VatBreakdown[] }): DraftLine[] {
  const credits: DraftLine[] = [];
  let gross = 0;
  for (const rate of input.byRate) {
    if (input.kleinunternehmer && rate.vatCents !== 0) throw new Error("Kleinunternehmer invoices cannot post VAT.");
    gross += rate.netCents + rate.vatCents;
    if (rate.netCents > 0) credits.push(line(revenueAccount(rate.vatBps, input.kleinunternehmer), 0, rate.netCents));
    if (rate.vatCents > 0) {
      const account = outputVatAccount(rate.vatBps);
      if (!account) throw new Error("VAT has no output account.");
      credits.push(line(account, 0, rate.vatCents));
    }
  }
  if (gross <= 0) throw new Error("Invoice total must be positive.");
  return checked([line(ACCOUNTS.receivables, gross, 0), ...credits]);
}

export function buildCustomerPayment(amountCents: number): DraftLine[] {
  if (amountCents <= 0) throw new Error("Payment must be positive.");
  return checked([line(ACCOUNTS.bank, amountCents, 0), line(ACCOUNTS.receivables, 0, amountCents)]);
}

export function buildExpense(input: { expenseAccount: string; netCents: number; vatBps: number; paidNow: boolean }): DraftLine[] {
  if (input.netCents <= 0) throw new Error("Expense must be positive.");
  const vatCents = percentOf(input.netCents, input.vatBps);
  const gross = input.netCents + vatCents;
  const lines = [line(input.expenseAccount, input.netCents, 0)];
  const vatAccount = inputVatAccount(input.vatBps);
  if (vatCents > 0) {
    if (!vatAccount) throw new Error("This VAT rate has no input-VAT account.");
    lines.push(line(vatAccount, vatCents, 0));
  }
  lines.push(line(input.paidNow ? ACCOUNTS.bank : ACCOUNTS.payables, 0, gross));
  return checked(lines);
}

export function buildVatPrepayment(amountCents: number): DraftLine[] {
  if (amountCents <= 0) throw new Error("Prepayment must be positive.");
  return checked([line(ACCOUNTS.vatPrepayments, amountCents, 0), line(ACCOUNTS.bank, 0, amountCents)]);
}

export function buildReserveAllocation(amountCents: number): DraftLine[] {
  if (amountCents <= 0) throw new Error("Allocation must be positive.");
  return checked([line(ACCOUNTS.retained, amountCents, 0), line(ACCOUNTS.reserve, 0, amountCents)]);
}

export function buildReserveLossOffset(amountCents: number): DraftLine[] {
  if (amountCents <= 0) throw new Error("Offset must be positive.");
  return checked([line(ACCOUNTS.reserve, amountCents, 0), line(ACCOUNTS.lossCarry, 0, amountCents)]);
}

export function buildPayroll(input: {
  minijob: boolean;
  grossCents: number;
  withheldCents: number;
  wageTaxCents: number;
  employerSocialCents: number;
  flatTaxCents: number;
  payNow: boolean;
}): DraftLine[] {
  const net = input.grossCents - input.withheldCents - input.wageTaxCents;
  if (net <= 0) throw new Error("Net pay must stay positive. Check the wage tax and the withheld contributions.");
  const wageAccount = input.minijob ? ACCOUNTS.minijobWages : ACCOUNTS.salaries;
  const socialExpense = input.minijob ? ACCOUNTS.minijobSocial : ACCOUNTS.socialExpense;
  const creditPay = input.payNow ? ACCOUNTS.bank : ACCOUNTS.wagesPayable;
  const lines = dropEmpty([
    line(wageAccount, input.grossCents, 0),
    line(creditPay, 0, net),
    line(ACCOUNTS.wageTaxPayable, 0, input.wageTaxCents),
    line(ACCOUNTS.socialPayable, 0, input.withheldCents),
    line(socialExpense, input.employerSocialCents, 0),
    line(ACCOUNTS.socialPayable, 0, input.employerSocialCents),
    line(ACCOUNTS.minijobFlatTax, input.flatTaxCents, 0),
    line(ACCOUNTS.wageTaxPayable, 0, input.flatTaxCents),
  ]);
  return checked(lines);
}

export function reverseLines(lines: DraftLine[]): DraftLine[] {
  return checked(lines.map((entry) => line(entry.accountCode, entry.creditCents, entry.debitCents)));
}
