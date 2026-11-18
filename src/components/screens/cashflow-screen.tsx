"use client";

import Link from "next/link";
import type { cashflowView } from "@/server/views";
import type { MoneyFlowSliceKey } from "@/domain/money-flow";
import { formatEuro, formatPercentBps } from "@/domain/money";
import { queryKeys, viewPath } from "@/client/query-keys";
import { MoneyFlowChart, type FlowTone } from "@/components/money-flow-chart";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Disclaimer, Empty, PageHeader, Stat, textLinkClass } from "@/components/ui";

type Cashflow = ReturnType<typeof cashflowView>;

const FLOW_TONES: Record<MoneyFlowSliceKey, FlowTone> = {
  purchases: "muted",
  netWages: "pine",
  wageTax: "amber",
  social: "moss",
  vat: "clay",
  corporate: "ink",
  soli: "ink",
  trade: "clay",
  profit: "moss",
};

function ChainRow({
  sign,
  label,
  amountCents,
  strong = false,
  hint,
}: {
  sign: string;
  label: string;
  amountCents: number;
  strong?: boolean;
  hint?: string;
}) {
  return (
    <tr className={strong ? "border-t border-line font-medium" : "border-t border-line/60"}>
      <td className="w-6 py-2 align-top font-mono text-muted">{sign}</td>
      <td className="py-2 align-top">
        {label}
        {hint ? <span className="mt-1 block text-xs font-normal leading-relaxed text-muted">{hint}</span> : null}
      </td>
      <td className="py-2 text-right align-top font-mono tabular-nums">{formatEuro(Math.abs(amountCents))}</td>
    </tr>
  );
}

export function CashflowScreen({ year }: { year: number }) {
  const query = useView<Cashflow>(queryKeys.cashflow(year), viewPath.cashflow(year));
  const { t } = useI18n();

  const flowLabel: Record<MoneyFlowSliceKey, string> = {
    purchases: t("cashflow.flow.purchases"),
    netWages: t("cashflow.flow.netWages"),
    wageTax: t("cashflow.flow.wageTax"),
    social: t("cashflow.flow.social"),
    vat: t("cashflow.flow.vat"),
    corporate: t("cashflow.flow.corporate"),
    soli: t("cashflow.flow.soli"),
    trade: t("cashflow.flow.trade"),
    profit: t("cashflow.flow.profit"),
  };
  const cashLabel: Record<string, string> = {
    customer: t("cashflow.cash.customer"),
    expense: t("cashflow.cash.expense"),
    payroll: t("cashflow.cash.payroll"),
    vat: t("cashflow.cash.vat"),
    owner: t("cashflow.cash.owner"),
    capital: t("cashflow.cash.capital"),
    other: t("cashflow.cash.other"),
  };

  return (
    <ViewGate query={query}>
      {(data) => {
        const taxOpen = data.flow.taxOfficeOpenCents;
        const taxDue = data.flow.taxOfficeDueCents;
        return (
          <>
            <PageHeader
              title={t("cashflow.title")}
              lede={t("cashflow.lede", { year: data.year })}
              action={
                <span className="flex flex-wrap gap-2">
                  <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href={`/cashflow?year=${data.year - 1}`}>
                    {t("cashflow.previousYear")}
                  </Link>
                  <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href={`/cashflow?year=${data.year + 1}`}>
                    {t("cashflow.nextYear")}
                  </Link>
                </span>
              }
            />

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label={t("cashflow.billed")}
                value={formatEuro(data.billing.grossCents)}
                hint={t("cashflow.billedHint", {
                  count: data.billing.count,
                  net: formatEuro(data.billing.netCents),
                  vat: formatEuro(data.billing.vatCents),
                })}
              />
              <Stat
                label={t("cashflow.received")}
                value={formatEuro(data.billing.paidCents)}
                hint={t("cashflow.receivedHint", { share: data.billing.paidSharePercent })}
              />
              <Stat
                label={t("cashflow.open")}
                value={formatEuro(data.billing.openCents)}
                hint={t("cashflow.openHint", { share: data.billing.openSharePercent })}
              />
              <Stat
                label={t("cashflow.taxOffice")}
                value={formatEuro(Math.abs(taxDue))}
                hint={
                  taxDue < 0
                    ? t("cashflow.taxOfficeCredit", { amount: formatEuro(Math.abs(taxDue)) })
                    : taxOpen < 0
                      ? t("cashflow.taxOfficeCredit", { amount: formatEuro(Math.abs(taxOpen)) })
                      : t("cashflow.taxOfficeHint", { open: formatEuro(taxOpen) })
                }
              />
            </div>

            <Card className="mt-6">
              <h2 className="text-2xl">{t("cashflow.flowTitle")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t("cashflow.flowLede")}</p>
              {data.company.kleinunternehmer ? <p className="mt-2 text-sm leading-relaxed">{t("cashflow.kleinVat")}</p> : null}
              <div className="mt-4">
                <MoneyFlowChart
                  slices={data.flow.slices.map((slice) => ({
                    key: slice.key,
                    label: flowLabel[slice.key],
                    amountCents: slice.amountCents,
                    tone: FLOW_TONES[slice.key],
                  }))}
                  sourceLabel={data.flow.balanced ? t("cashflow.source") : t("cashflow.funding")}
                  sourceAmountCents={data.flow.sourceTotalCents}
                  ariaLabel={t("cashflow.flowTitle")}
                  empty={t("cashflow.noData")}
                  shareLabel={(share) => formatPercentBps(share)}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                {t("cashflow.sourceHint", { net: formatEuro(data.flow.grossRevenueCents - data.vat.outputCents), vat: formatEuro(data.vat.outputCents) })}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {data.flow.balanced ? t("cashflow.balanceOk") : t("cashflow.balanceFunded", { amount: formatEuro(data.flow.fundingCents) })}
              </p>
            </Card>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="lg:col-span-2">
                <h2 className="mb-3 text-2xl">{t("cashflow.chainTitle")}</h2>
                <Card>
                  <p className="text-sm leading-relaxed text-muted">{t("cashflow.chainLede")}</p>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[30rem] text-sm">
                      <tbody>
                        <ChainRow sign="+" label={t("cashflow.chain.vatOut")} amountCents={data.vat.outputCents} />
                        <ChainRow sign="−" label={t("cashflow.chain.vatIn")} amountCents={data.vat.inputCents} />
                        <ChainRow sign="=" label={t("cashflow.chain.vatPayable")} amountCents={data.vat.payableCents} strong />
                        <ChainRow sign="−" label={t("cashflow.chain.vatPrepaid")} amountCents={data.vat.prepaidCents} />
                        <ChainRow sign="=" label={t("cashflow.chain.vatOpen")} amountCents={data.vat.openCents} strong />
                        <ChainRow sign="+" label={t("cashflow.chain.wageTax")} amountCents={data.payroll.wageTaxCents} />
                        <ChainRow sign="+" label={t("cashflow.chain.corporate")} amountCents={data.tax.corporateCents} />
                        <ChainRow sign="+" label={t("cashflow.chain.soli")} amountCents={data.tax.soliCents} />
                        <ChainRow sign="+" label={t("cashflow.chain.trade")} amountCents={data.tax.tradeCents} />
                        <ChainRow
                          sign="="
                          label={t("cashflow.chain.total")}
                          amountCents={taxOpen}
                          strong
                          hint={taxOpen < 0 ? t("cashflow.taxOfficeCredit", { amount: formatEuro(Math.abs(taxOpen)) }) : undefined}
                        />
                        <ChainRow
                          sign=" "
                          label={t("cashflow.chain.social")}
                          amountCents={data.payroll.socialCents}
                          hint={t("cashflow.chain.socialHint")}
                        />
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted">{t("cashflow.chain.note")}</p>
                </Card>
              </section>

              <section>
                <h2 className="mb-3 text-2xl">{t("cashflow.payrollTitle")}</h2>
                <Card>
                  <dl className="grid gap-2 text-sm">
                    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
                      <dt>{t("cashflow.payroll.gross")}</dt>
                      <dd className="font-mono tabular-nums">{formatEuro(data.payroll.grossWagesCents)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
                      <dt>{t("cashflow.payroll.employer")}</dt>
                      <dd className="font-mono tabular-nums">{formatEuro(data.payroll.employerSocialCents)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
                      <dt>{t("cashflow.payroll.flatTax")}</dt>
                      <dd className="font-mono tabular-nums">{formatEuro(data.payroll.flatTaxCents)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2 font-medium">
                      <dt>{t("cashflow.payroll.net")}</dt>
                      <dd className="font-mono tabular-nums">{formatEuro(data.payroll.netPayCents)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
                      <dt>{t("cashflow.payroll.wageTax")}</dt>
                      <dd className="font-mono tabular-nums">{formatEuro(data.payroll.wageTaxCents)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <dt>{t("cashflow.payroll.social")}</dt>
                      <dd className="font-mono tabular-nums">{formatEuro(data.payroll.socialCents)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs leading-relaxed text-muted">{t("cashflow.chain.socialHint")}</p>
                </Card>
              </section>

              <section>
                <h2 className="mb-3 text-2xl">{t("cashflow.vatTitle")}</h2>
                <Card>
                  <dl className="grid gap-2 text-sm">
                    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
                      <dt>{t("cashflow.vat.output19")}</dt>
                      <dd className="font-mono tabular-nums">{formatEuro(data.vat.output19Cents)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
                      <dt>{t("cashflow.vat.output7")}</dt>
                      <dd className="font-mono tabular-nums">{formatEuro(data.vat.output7Cents)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
                      <dt>{t("cashflow.vat.input19")}</dt>
                      <dd className="font-mono tabular-nums">{formatEuro(data.vat.input19Cents)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
                      <dt>{t("cashflow.vat.input7")}</dt>
                      <dd className="font-mono tabular-nums">{formatEuro(data.vat.input7Cents)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 font-medium">
                      <dt>{t("cashflow.chain.vatOpen")}</dt>
                      <dd className="font-mono tabular-nums">{formatEuro(data.vat.openCents)}</dd>
                    </div>
                  </dl>
                </Card>
              </section>
            </div>

            <section className="mt-6">
              <h2 className="mb-3 text-2xl">{t("cashflow.cashTitle")}</h2>
              <Card>
                <p className="text-sm leading-relaxed text-muted">{t("cashflow.cashLede")}</p>
                {data.cash.categories.length === 0 ? (
                  <div className="mt-4"><Empty>{t("cashflow.cash.empty")}</Empty></div>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[36rem] text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs text-muted">
                          <th className="py-2 font-medium">{t("cashflow.cash.category")}</th>
                          <th className="py-2 text-right font-medium">{t("cashflow.cash.in")}</th>
                          <th className="py-2 text-right font-medium">{t("cashflow.cash.out")}</th>
                          <th className="py-2 text-right font-medium">{t("cashflow.cash.net")}</th>
                          <th className="py-2 text-right font-medium">{t("cashflow.cash.count")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.cash.categories.map((row) => (
                          <tr key={row.key} className="border-b border-line last:border-0">
                            <td className="py-2">{cashLabel[row.key] ?? row.key}</td>
                            <td className="py-2 text-right font-mono tabular-nums">{formatEuro(row.inflowCents)}</td>
                            <td className="py-2 text-right font-mono tabular-nums">{formatEuro(row.outflowCents)}</td>
                            <td className="py-2 text-right font-mono tabular-nums">{formatEuro(row.inflowCents - row.outflowCents)}</td>
                            <td className="py-2 text-right font-mono tabular-nums">{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <dl className="mt-4 grid gap-2 border-t border-line pt-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted">{t("cashflow.cash.opening")}</dt>
                    <dd className="font-mono tabular-nums">{formatEuro(data.cash.openingCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">{t("cashflow.cash.change")}</dt>
                    <dd className="font-mono tabular-nums">{formatEuro(data.cash.changeCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">{t("cashflow.cash.closing")}</dt>
                    <dd className="font-mono tabular-nums">{formatEuro(data.cash.closingCents)}</dd>
                  </div>
                </dl>
              </Card>
            </section>

            {data.filings.vat.total > 0 || data.filings.wageTax.total > 0 ? (
              <section className="mt-6">
                <h2 className="mb-3 text-2xl">{t("cashflow.filingsTitle")}</h2>
                <Card>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    {data.filings.vat.total > 0 ? (
                      <div>
                        <dt className="text-xs text-muted">{t("cashflow.filings.vat")}</dt>
                        <dd className="font-mono tabular-nums">
                          {t("cashflow.filings.count", { done: data.filings.vat.done, total: data.filings.vat.total })}
                        </dd>
                      </div>
                    ) : null}
                    {data.filings.wageTax.total > 0 ? (
                      <div>
                        <dt className="text-xs text-muted">{t("cashflow.filings.wageTax")}</dt>
                        <dd className="font-mono tabular-nums">
                          {t("cashflow.filings.count", { done: data.filings.wageTax.done, total: data.filings.wageTax.total })}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  <p className="mt-3 text-xs leading-relaxed text-muted">{t("cashflow.filings.hint")}</p>
                  <Link className={textLinkClass} href={`/obligations?year=${data.year}`}>{t("cashflow.filings.link")}</Link>
                </Card>
              </section>
            ) : null}

            <div className="mt-4">
              <Disclaimer>{t("cashflow.note")}</Disclaimer>
            </div>
          </>
        );
      }}
    </ViewGate>
  );
}