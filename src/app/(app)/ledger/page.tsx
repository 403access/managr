import { saveExpense, saveVatPayment } from "@/server/actions";
import { accountBalances, listJournal, loadCompany, signedAccount, vatPayableCents } from "@/server/queries";
import { CHART, signedBalance } from "@/domain/accounts";
import { fiscalYearContaining, formatDate, todayIso } from "@/domain/calendar";
import { formatEuro } from "@/domain/money";
import { balanceSheetTotals, summarizeProfit } from "@/domain/reporting";
import { estimateCorporateTax } from "@/domain/tax";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { JournalForm } from "@/components/journal-form";
import { Card, Check, Disclaimer, Field, PageHeader, Section, SelectInput, Stat, TextInput, textLinkClass } from "@/components/ui";

export const metadata = { title: "Ledger" };

export default async function LedgerPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const params = await searchParams;
  const company = loadCompany();
  const today = todayIso();
  const fy = fiscalYearContaining(today, company.fiscalYearStartMonth);
  const period = accountBalances(fy.start, today);
  const profit = summarizeProfit(period);
  const rows = accountBalances();
  const tax = estimateCorporateTax(profit.profitBeforeTaxCents, company.hebesatzPercent, company.lossCarryforwardCents);
  const sheet = balanceSheetTotals(rows);
  const allProfit = summarizeProfit(rows);
  const equation = sheet.assetsCents - sheet.liabilitiesCents - sheet.equityCents - allProfit.profitAfterTaxCents;
  const visible = params.all === "1" ? rows : rows.filter((row) => row.debitCents !== 0 || row.creditCents !== 0);
  const vat = vatPayableCents(rows);
  const expenses = CHART.filter((account) => account.type === "expense");

  return (
    <>
      <PageHeader title="Ledger" lede={`SKR03 working chart. Financial year ${fy.label} runs ${formatDate(fy.start)} to ${formatDate(fy.end)}.`} action={params.all === "1" ? <a className={textLinkClass} href="/ledger">Hide zero accounts</a> : <a className={textLinkClass} href="/ledger?all=1">Show every account</a>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue" value={formatEuro(profit.revenueCents)} />
        <Stat label="Expenses" value={formatEuro(profit.expenseCents)} />
        <Stat label="Profit before tax" value={formatEuro(profit.profitBeforeTaxCents)} />
        <Stat label={vat >= 0 ? "VAT payable" : "VAT refund"} value={formatEuro(Math.abs(vat))} hint="Output VAT minus input VAT minus prepayments" />
      </div>
      <Card className="mt-4">
        <h2 className="text-xl">Tax estimate</h2>
        <p className="mt-2 text-sm">Taxable base {formatEuro(tax.taxableCents)} · Körperschaftsteuer {formatEuro(tax.corporateCents)} · Solidaritätszuschlag {formatEuro(tax.soliCents)} · Gewerbesteuer {formatEuro(tax.tradeCents)} · together {formatEuro(tax.totalCents)}.</p>
        <p className="mt-2 text-sm text-muted">Hebesatz {company.hebesatzPercent}%. A UG has no Gewerbesteuer Freibetrag in this estimate, and trade tax is not deducted again inside corporation tax. Booked tax (accounts 2200, 2208, 4320) is outside profit before tax.</p>
        <div className="mt-3"><Disclaimer /></div>
      </Card>
      <p className="mt-4 text-sm">{equation === 0 ? "The books balance." : `The books differ by ${formatEuro(equation)}.`}</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-2 font-medium">Account</th>
              <th className="py-2 text-right font-medium">Debit</th>
              <th className="py-2 text-right font-medium">Credit</th>
              <th className="py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.code} className="border-b border-line">
                <td className="py-2">{row.code} {row.name}</td>
                <td className="py-2 text-right font-mono">{formatEuro(row.debitCents)}</td>
                <td className="py-2 text-right font-mono">{formatEuro(row.creditCents)}</td>
                <td className="py-2 text-right font-mono">{formatEuro(signedBalance(row.type, row.debitCents, row.creditCents))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Section title="Expense">
        <Card>
          {company.kleinunternehmer ? <p className="mb-3 text-sm text-muted">Input VAT usually cannot be deducted under §19. Leave the rate at 0 unless an adviser said otherwise.</p> : null}
          <ActionForm action={saveExpense}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date"><TextInput name="date" type="date" defaultValue={today} /></Field>
              <Field label="Description"><TextInput name="memo" /></Field>
              <Field label="Account">
                <SelectInput name="account" defaultValue="4900">
                  {expenses.map((account) => <option key={account.code} value={account.code}>{account.code} {account.name}</option>)}
                </SelectInput>
              </Field>
              <Field label="Net"><TextInput name="net" inputMode="decimal" /></Field>
              <Field label="VAT">
                <SelectInput name="vatBps" defaultValue={company.kleinunternehmer ? "0" : "1900"}>
                  <option value="0">0%</option>
                  <option value="700">7%</option>
                  <option value="1900">19%</option>
                </SelectInput>
              </Field>
            </div>
            <Check name="paidNow" label="Paid from the bank now" defaultChecked />
            <SubmitButton>Post expense</SubmitButton>
          </ActionForm>
        </Card>
      </Section>
      <Section title="VAT prepayment">
        <Card>
          <ActionForm action={saveVatPayment}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Date"><TextInput name="date" type="date" defaultValue={today} /></Field>
              <Field label="Amount"><TextInput name="amount" inputMode="decimal" /></Field>
              <Field label="Memo"><TextInput name="memo" placeholder="VAT prepayment" /></Field>
            </div>
            <SubmitButton>Post prepayment</SubmitButton>
          </ActionForm>
        </Card>
      </Section>
      <Section title="Manual entry">
        <Card>
          <JournalForm today={today} accounts={CHART.map((account) => ({ code: account.code, name: account.name }))} />
        </Card>
      </Section>
      <Section title="Recent entries">
        <div className="grid gap-2">
          {listJournal().map((entry) => (
            <details key={entry.id} className="rounded-2xl border border-line bg-card px-4 py-3">
              <summary className="min-h-11 cursor-pointer text-sm">{formatDate(entry.entryDate)} · {entry.memo}</summary>
              <ul className="mt-2 grid gap-1 text-sm">
                {entry.lines.map((line, index) => (
                  <li key={`${entry.id}-${index}`} className="flex justify-between gap-3">
                    <span>{line.code} {line.name}</span>
                    <span className="font-mono">{line.debitCents ? formatEuro(line.debitCents) : ""} {line.creditCents ? formatEuro(line.creditCents) : ""}</span>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </Section>
      <p className="mt-4 text-xs text-muted">Bank {formatEuro(signedAccount(rows, "1200"))}. Corrections are new reversing entries. Nothing here is deleted.</p>
    </>
  );
}
