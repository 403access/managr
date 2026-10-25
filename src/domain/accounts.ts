export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type PnlGroup = "revenue" | "expense" | "tax" | "none";

export type AccountSeed = {
  code: string;
  name: string;
  type: AccountType;
  pnl: PnlGroup;
};

export const ACCOUNTS = {
  capital: "0800",
  reserve: "0840",
  retained: "0860",
  lossCarry: "0868",
  cash: "1000",
  bank: "1200",
  receivables: "1400",
  vatReceivable: "1545",
  inputVat7: "1571",
  inputVat19: "1576",
  payables: "1600",
  wagesPayable: "1740",
  wageTaxPayable: "1741",
  socialPayable: "1742",
  vat7: "1771",
  vat19: "1776",
  vatPrepayments: "1780",
  vatSpecialPrepayment: "1781",
  corporateTax: "2200",
  solidarity: "2208",
  salaries: "4120",
  socialExpense: "4130",
  bgContributions: "4138",
  minijobSocial: "4144",
  minijobFlatTax: "4194",
  minijobWages: "4195",
  rent: "4210",
  utilities: "4240",
  tradeTax: "4320",
  insurance: "4360",
  dues: "4380",
  advertising: "4600",
  entertainment: "4650",
  otherExpense: "4900",
  phone: "4920",
  office: "4930",
  advisory: "4950",
  bookkeeping: "4955",
  bankCharges: "4970",
  revenueExempt: "8100",
  revenueKlein: "8192",
  revenue7: "8300",
  revenue19: "8400",
  otherIncome: "8603",
} as const;

export const CHART: AccountSeed[] = [
  { code: ACCOUNTS.capital, name: "Gezeichnetes Kapital", type: "equity", pnl: "none" },
  { code: ACCOUNTS.reserve, name: "Gesetzliche Rücklage", type: "equity", pnl: "none" },
  { code: ACCOUNTS.retained, name: "Gewinnvortrag vor Verwendung", type: "equity", pnl: "none" },
  { code: ACCOUNTS.lossCarry, name: "Verlustvortrag vor Verwendung", type: "equity", pnl: "none" },
  { code: ACCOUNTS.cash, name: "Kasse", type: "asset", pnl: "none" },
  { code: ACCOUNTS.bank, name: "Bank", type: "asset", pnl: "none" },
  { code: ACCOUNTS.receivables, name: "Forderungen aus Lieferungen und Leistungen", type: "asset", pnl: "none" },
  { code: ACCOUNTS.vatReceivable, name: "Forderungen aus Umsatzsteuer", type: "asset", pnl: "none" },
  { code: ACCOUNTS.inputVat7, name: "Abziehbare Vorsteuer 7 %", type: "asset", pnl: "none" },
  { code: ACCOUNTS.inputVat19, name: "Abziehbare Vorsteuer 19 %", type: "asset", pnl: "none" },
  { code: ACCOUNTS.payables, name: "Verbindlichkeiten aus Lieferungen und Leistungen", type: "liability", pnl: "none" },
  { code: ACCOUNTS.wagesPayable, name: "Verbindlichkeiten aus Lohn und Gehalt", type: "liability", pnl: "none" },
  { code: ACCOUNTS.wageTaxPayable, name: "Verbindlichkeiten aus Lohn- und Kirchensteuer", type: "liability", pnl: "none" },
  { code: ACCOUNTS.socialPayable, name: "Verbindlichkeiten im Rahmen der sozialen Sicherheit", type: "liability", pnl: "none" },
  { code: ACCOUNTS.vat7, name: "Umsatzsteuer 7 %", type: "liability", pnl: "none" },
  { code: ACCOUNTS.vat19, name: "Umsatzsteuer 19 %", type: "liability", pnl: "none" },
  { code: ACCOUNTS.vatPrepayments, name: "Umsatzsteuer-Vorauszahlungen", type: "asset", pnl: "none" },
  { code: ACCOUNTS.vatSpecialPrepayment, name: "Umsatzsteuer-Sondervorauszahlung", type: "asset", pnl: "none" },
  { code: ACCOUNTS.corporateTax, name: "Körperschaftsteuer", type: "expense", pnl: "tax" },
  { code: ACCOUNTS.solidarity, name: "Solidaritätszuschlag", type: "expense", pnl: "tax" },
  { code: ACCOUNTS.salaries, name: "Gehälter", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.socialExpense, name: "Gesetzliche soziale Aufwendungen", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.minijobSocial, name: "Soziale Abgaben für Minijobber", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.bgContributions, name: "Beiträge zur Berufsgenossenschaft", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.minijobFlatTax, name: "Pauschale Lohnsteuer für Minijobber", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.minijobWages, name: "Löhne für Minijobs", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.rent, name: "Miete", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.utilities, name: "Gas, Strom, Wasser", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.tradeTax, name: "Gewerbesteuer", type: "expense", pnl: "tax" },
  { code: ACCOUNTS.insurance, name: "Versicherungen", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.dues, name: "Beiträge", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.advertising, name: "Werbekosten", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.entertainment, name: "Bewirtungskosten", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.otherExpense, name: "Sonstige betriebliche Aufwendungen", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.phone, name: "Telefon", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.office, name: "Bürobedarf", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.advisory, name: "Rechts- und Beratungskosten", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.bookkeeping, name: "Buchführungskosten", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.bankCharges, name: "Nebenkosten des Geldverkehrs", type: "expense", pnl: "expense" },
  { code: ACCOUNTS.revenueExempt, name: "Steuerfreie Umsätze § 4 UStG", type: "income", pnl: "revenue" },
  { code: ACCOUNTS.revenueKlein, name: "Steuerfreie Erlöse Kleinunternehmer § 19 UStG", type: "income", pnl: "revenue" },
  { code: ACCOUNTS.revenue7, name: "Erlöse 7 % USt", type: "income", pnl: "revenue" },
  { code: ACCOUNTS.revenue19, name: "Erlöse 19 % USt", type: "income", pnl: "revenue" },
  { code: ACCOUNTS.otherIncome, name: "Sonstige betriebliche Erträge", type: "income", pnl: "revenue" },
];

export function normalSide(type: AccountType): "debit" | "credit" {
  return type === "asset" || type === "expense" ? "debit" : "credit";
}

export function signedBalance(type: AccountType, debitCents: number, creditCents: number): number {
  return normalSide(type) === "debit" ? debitCents - creditCents : creditCents - debitCents;
}

export type DraftLine = {
  accountCode: string;
  debitCents: number;
  creditCents: number;
};

export function journalImbalance(lines: DraftLine[]): string | null {
  if (lines.length < 2) return "An entry needs at least two lines.";
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.debitCents) || !Number.isInteger(line.creditCents)) return "Amounts must be whole cents.";
    if (line.debitCents < 0 || line.creditCents < 0) return "Amounts cannot be negative.";
    if (line.debitCents > 0 && line.creditCents > 0) return "A line is either a debit or a credit.";
    if (line.debitCents === 0 && line.creditCents === 0) return "A line cannot be zero.";
    debit += line.debitCents;
    credit += line.creditCents;
  }
  if (debit !== credit) return `Entry is out of balance by ${Math.abs(debit - credit)} cents.`;
  if (debit === 0) return "Entry is empty.";
  return null;
}
