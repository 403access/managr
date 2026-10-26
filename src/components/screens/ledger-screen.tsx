"use client";

import { saveExpense, saveVatPayment } from "@/server/actions";
import type { ledgerView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { formatEuro } from "@/domain/money";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { JournalForm } from "@/components/journal-form";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { Tab, Tabs } from "@/components/tabs";
import { Card, Check, Disclaimer, Field, PageHeader, SelectInput, Stat, TextInput, textLinkClass } from "@/components/ui";

type Ledger = ReturnType<typeof ledgerView>;

export function LedgerScreen({ all }: { all: boolean }) {
  const query = useView<Ledger>(queryKeys.ledger(all), viewPath.ledger(all));
  const { t } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader
            title={t("ledger.title")}
            lede={t("ledger.lede", { label: data.fy.label, start: formatDate(data.fy.start), end: formatDate(data.fy.end) })}
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t("ledger.revenue")} value={formatEuro(data.profit.revenueCents)} />
            <Stat label={t("ledger.expenses")} value={formatEuro(data.profit.expenseCents)} />
            <Stat label={t("desk.profit")} value={formatEuro(data.profit.profitBeforeTaxCents)} />
            <Stat label={data.vat >= 0 ? t("ledger.vatPayable") : t("ledger.vatRefund")} value={formatEuro(Math.abs(data.vat))} hint={t("ledger.vatHint")} />
          </div>
          <Card className="mt-4">
            <h2 className="text-xl">{t("ledger.estimate")}</h2>
            <p className="mt-2 text-sm">
              {t("ledger.estimateBody", {
                base: formatEuro(data.tax.taxableCents),
                kst: formatEuro(data.tax.corporateCents),
                soli: formatEuro(data.tax.soliCents),
                gewst: formatEuro(data.tax.tradeCents),
                total: formatEuro(data.tax.totalCents),
              })}
            </p>
            <p className="mt-2 text-sm text-muted">{t("ledger.estimateNote", { rate: data.hebesatzPercent })}</p>
            <div className="mt-3">
              <Disclaimer>{t("disclaimer.default")}</Disclaimer>
            </div>
          </Card>
          <Tabs label={t("tabs.sections")}>
          <Tab id="accounts" label={t("ledger.accounts")}>
          <p className="mb-3 text-sm">{data.equation === 0 ? t("ledger.balanced") : t("ledger.imbalance", { amount: formatEuro(data.equation) })}</p>
          <p className="mb-3">
            {data.all ? <a className={textLinkClass} href="/ledger">{t("ledger.hideZero")}</a> : <a className={textLinkClass} href="/ledger?all=1#accounts">{t("ledger.showAll")}</a>}
          </p>
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="py-2 font-medium">{t("common.account")}</th>
                  <th className="py-2 text-right font-medium">{t("ledger.debit")}</th>
                  <th className="py-2 text-right font-medium">{t("ledger.credit")}</th>
                  <th className="py-2 text-right font-medium">{t("ledger.balance")}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.code} className="border-b border-line">
                    <td className="py-2">
                      {row.code} {row.name}
                    </td>
                    <td className="py-2 text-right font-mono">{formatEuro(row.debitCents)}</td>
                    <td className="py-2 text-right font-mono">{formatEuro(row.creditCents)}</td>
                    <td className="py-2 text-right font-mono">{formatEuro(row.signedCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </Tab>
          <Tab id="expense" label={t("ledger.expense")}>
            <Card>
              {data.kleinunternehmer ? <p className="mb-3 text-sm text-muted">{t("ledger.kleinVat")}</p> : null}
              <ActionForm action={saveExpense} resetOnSuccess>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("common.date")}><TextInput name="date" type="date" defaultValue={data.today} /></Field>
                  <Field label={t("invoices.description")}><TextInput name="memo" /></Field>
                  <Field label={t("common.account")}>
                    <SelectInput name="account" defaultValue="4900">
                      {data.expenses.map((account) => (
                        <option key={account.code} value={account.code}>
                          {account.code} {account.name}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label={t("ledger.net")}><TextInput name="net" inputMode="decimal" /></Field>
                  <Field label={t("common.vat")}>
                    <SelectInput name="vatBps" defaultValue={data.kleinunternehmer ? "0" : "1900"}>
                      <option value="0">0%</option>
                      <option value="700">7%</option>
                      <option value="1900">19%</option>
                    </SelectInput>
                  </Field>
                </div>
                <Check name="paidNow" label={t("ledger.paidNow")} defaultChecked />
                <SubmitButton>{t("ledger.postExpense")}</SubmitButton>
              </ActionForm>
            </Card>
          </Tab>
          <Tab id="prepayment" label={t("ledger.prepayment")}>
            <Card>
              <ActionForm action={saveVatPayment} resetOnSuccess>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label={t("common.date")}><TextInput name="date" type="date" defaultValue={data.today} /></Field>
                  <Field label={t("common.amount")}><TextInput name="amount" inputMode="decimal" /></Field>
                  <Field label={t("common.memo")}><TextInput name="memo" placeholder={t("ledger.prepaymentMemo")} /></Field>
                </div>
                <SubmitButton>{t("ledger.postPrepayment")}</SubmitButton>
              </ActionForm>
            </Card>
          </Tab>
          <Tab id="manual" label={t("ledger.manual")}>
            <Card>
              <JournalForm today={data.today} accounts={data.accounts} />
            </Card>
          </Tab>
          <Tab id="journal" label={t("ledger.recent")}>
            <div className="grid gap-2">
              {data.journal.map((entry) => (
                <details key={entry.id} className="rounded-2xl border border-line bg-card px-4 py-3">
                  <summary className="min-h-11 cursor-pointer text-sm">
                    {formatDate(entry.entryDate)} · {entry.memo}
                  </summary>
                  <ul className="mt-2 grid gap-1 text-sm">
                    {entry.lines.map((line, index) => (
                      <li key={`${entry.id}-${index}`} className="flex justify-between gap-3">
                        <span>
                          {line.code} {line.name}
                        </span>
                        <span className="font-mono">
                          {line.debitCents ? formatEuro(line.debitCents) : ""} {line.creditCents ? formatEuro(line.creditCents) : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </Tab>
          </Tabs>
          <p className="mt-4 text-xs text-muted">{t("ledger.footer", { amount: formatEuro(data.bankCents) })}</p>
        </>
      )}
    </ViewGate>
  );
}
