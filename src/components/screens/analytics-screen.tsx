"use client";

import Link from "next/link";
import type { analyticsView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { formatEuro } from "@/domain/money";
import { queryKeys, viewPath } from "@/client/query-keys";
import { formatDuration } from "@/components/amounts";
import { MonthBarChart, StatusBar, TimeBarChart } from "@/components/charts";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Empty, PageHeader, Pill, Stat } from "@/components/ui";

type Analytics = ReturnType<typeof analyticsView>;

function Legend() {
  const { t } = useI18n();
  return (
    <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-pine" />{t("analytics.productiveLegend")}</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-amber" />{t("analytics.unproductiveLegend")}</span>
    </div>
  );
}

export function AnalyticsScreen({ year }: { year: number }) {
  const query = useView<Analytics>(queryKeys.analytics(year), viewPath.analytics(year));
  const { t, label, monthName } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader
            title={t("analytics.title")}
            lede={t("analytics.lede", { year: data.year })}
            action={
              <span className="flex flex-wrap gap-2">
                <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href={`/analytics?year=${data.year - 1}`}>
                  {t("analytics.previousYear")}
                </Link>
                <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href={`/analytics?year=${data.year + 1}`}>
                  {t("analytics.nextYear")}
                </Link>
                <Link className="inline-flex min-h-11 items-center rounded-full bg-pine px-4 text-sm font-medium text-paper" href={`/analytics/report?year=${data.year}`}>
                  {t("analytics.report")}
                </Link>
              </span>
            }
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t("analytics.totalTime")} value={formatDuration(data.totals.minutes)} hint={t("analytics.reportScope", { year: data.year })} />
            <Stat label={t("analytics.productive")} value={`${data.productiveShare} %`} hint={`${formatDuration(data.totals.productiveMinutes)} ${t("analytics.productiveLegend")}`} />
            <Stat label={t("analytics.billable")} value={`${data.billableShare} %`} hint={formatDuration(data.totals.billableMinutes)} />
            <Stat label={t("analytics.projectsActive")} value={String(data.projectCounts.active)} hint={`${data.projectCounts.started} ${t("analytics.projectsStarted", { year: data.year })}`} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section>
              <h2 className="mb-3 text-2xl">{t("analytics.projectTime")}</h2>
              <Card>
                <TimeBarChart
                  ariaLabel={t("analytics.projectTime")}
                  empty={t("analytics.noTime")}
                  rows={data.projectRows.map((row) => ({
                    key: String(row.projectId ?? "none"),
                    label: row.unassigned ? t("analytics.unassigned") : row.name,
                    minutes: row.minutes,
                    productiveMinutes: row.productiveMinutes,
                    secondary: row.unassigned
                      ? t("analytics.noCustomer")
                      : `${row.customerName || t("analytics.noCustomer")} · ${formatDuration(row.billableMinutes)} ${t("analytics.billable")}`,
                    href: row.unassigned ? undefined : "/projects",
                  }))}
                />
                <Legend />
              </Card>
            </section>

            <section>
              <h2 className="mb-3 text-2xl">{t("analytics.projectStatus")}</h2>
              <Card>
                <StatusBar
                  total={data.projectCounts.started + data.projectCounts.completed + data.projectCounts.active + data.projectCounts.paused}
                  parts={[
                    { key: "started", label: t("analytics.projectsStarted", { year: data.year }), value: data.projectCounts.started, tone: "pine" },
                    { key: "completed", label: t("analytics.projectsCompleted", { year: data.year }), value: data.projectCounts.completed, tone: "moss" },
                    { key: "active", label: t("analytics.projectsActive"), value: data.projectCounts.active, tone: "amber" },
                    { key: "paused", label: t("analytics.projectsPaused"), value: data.projectCounts.paused, tone: "muted" },
                  ]}
                />
                <p className="mt-3 text-xs leading-relaxed text-muted">{t("analytics.statusHint")}</p>
              </Card>
            </section>

            <section className="lg:col-span-2">
              <h2 className="mb-3 text-2xl">{t("analytics.monthly")}</h2>
              <Card>
                {data.totals.minutes === 0 ? (
                  <Empty>{t("analytics.noTime")}</Empty>
                ) : (
                  <MonthBarChart
                    ariaLabel={t("analytics.monthly")}
                    months={data.months.map((month) => ({
                      key: month.month,
                      label: monthName(Number(month.month.slice(5, 7))),
                      minutes: month.minutes,
                      productiveMinutes: month.productiveMinutes,
                      unproductiveMinutes: month.unproductiveMinutes,
                    }))}
                  />
                )}
                <Legend />
              </Card>
            </section>

            <section>
              <h2 className="mb-3 text-2xl">{t("analytics.taskTypes")}</h2>
              <Card>
                <TimeBarChart
                  ariaLabel={t("analytics.taskTypes")}
                  empty={t("analytics.noTaskTypes")}
                  rows={data.typeRows.map((row) => ({
                    key: row.taskType,
                    label: label(row.taskType),
                    minutes: row.minutes,
                    productiveMinutes: row.productive ? row.minutes : 0,
                    secondary: `${t("analytics.taskCount", { count: row.taskCount })} · ${row.productive ? t("analytics.productiveLegend") : t("analytics.unproductiveLegend")}`,
                  }))}
                />
                <p className="mt-3 text-xs leading-relaxed text-muted">{t("analytics.productiveHint")}</p>
              </Card>
            </section>

            <section>
              <h2 className="mb-3 text-2xl">{t("analytics.people")}</h2>
              <Card>
                {data.peopleRows.length === 0 ? <Empty>{t("analytics.noPeople")}</Empty> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs text-muted">
                          <th className="py-2 font-medium">{t("common.name")}</th>
                          <th className="py-2 text-right font-medium">{t("analytics.minutes")}</th>
                          <th className="py-2 text-right font-medium">{t("analytics.productive")}</th>
                          <th className="py-2 text-right font-medium">{t("analytics.projectsActive")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.peopleRows.map((person) => (
                          <tr key={person.kind === "employee" ? `employee-${person.employeeId}` : person.kind === "contact" ? `contact-${person.contactId}` : "none"} className="border-b border-line last:border-0">
                            <td className="py-2">
                              {person.kind === "employee" && person.employeeId !== null ? (
                                <Link href={`/people/${person.employeeId}`} className="text-pine">{person.firstName} {person.lastName}</Link>
                              ) : person.kind === "contact" ? (
                                <>
                                  {person.firstName} {person.lastName}
                                  {person.customerName ? <span className="block text-xs text-muted">{person.customerName}</span> : null}
                                </>
                              ) : t("analytics.noPerson")}
                            </td>
                            <td className="py-2 text-right font-mono tabular-nums">{formatDuration(person.minutes)}</td>
                            <td className="py-2 text-right font-mono tabular-nums">{person.productiveShare} %</td>
                            <td className="py-2 text-right font-mono tabular-nums">{person.projectCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </section>

            <section className="lg:col-span-2">
              <h2 className="mb-3 text-2xl">{t("analytics.customers")}</h2>
              <Card>
                {data.customerRows.length === 0 ? <Empty>{t("analytics.noCustomers")}</Empty> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs text-muted">
                          <th className="py-2 font-medium">{t("analytics.customer")}</th>
                          <th className="py-2 text-right font-medium">{t("analytics.minutes")}</th>
                          <th className="py-2 text-right font-medium">{t("analytics.projectStatus")}</th>
                          <th className="py-2 text-right font-medium">{t("analytics.invoiced", { year: data.year })}</th>
                          <th className="py-2 text-right font-medium">{t("analytics.report")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.customerRows.map((customer) => (
                          <tr key={customer.customerId} className="border-b border-line last:border-0">
                            <td className="py-2"><Link href={`/customers#customer-${customer.customerId}`} className="text-pine">{customer.name}</Link></td>
                            <td className="py-2 text-right font-mono tabular-nums">{formatDuration(customer.minutes)}</td>
                            <td className="py-2 text-right font-mono tabular-nums">{customer.projectCount}</td>
                            <td className="py-2 text-right font-mono tabular-nums">{formatEuro(customer.invoicedCents)}</td>
                            <td className="py-2 text-right">
                              <Link href={`/analytics/report?year=${data.year}&customer=${customer.customerId}`} className="inline-flex min-h-11 items-center text-sm text-pine">
                                {t("analytics.customerReport")}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </section>

            <section>
              <h2 className="mb-3 text-2xl">{t("analytics.deliverables")}</h2>
              <Card>
                {data.deliverables.length === 0 ? <Empty>{t("analytics.noDeliverables")}</Empty> : (
                  <div className="grid gap-2">
                    {data.deliverables.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2 last:border-0 last:pb-0">
                        <span>
                          <span className="block text-sm font-medium">{item.title}</span>
                          <span className="text-xs text-muted">{item.projectName || t("analytics.unassigned")} · {item.customerName || t("analytics.noCustomer")}</span>
                        </span>
                        <span className="text-xs text-muted">{item.completedAt ? formatDate(item.completedAt) : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </section>

            <section>
              <h2 className="mb-3 text-2xl">{t("analytics.openDeliverables")}</h2>
              <Card>
                {data.openDeliverables.length === 0 ? <Empty>{t("analytics.noOpenDeliverables")}</Empty> : (
                  <div className="grid gap-2">
                    {data.openDeliverables.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2 last:border-0 last:pb-0">
                        <span>
                          <span className="block text-sm font-medium">{item.title}</span>
                          <span className="text-xs text-muted">{item.projectName || t("analytics.unassigned")} · {item.customerName || t("analytics.noCustomer")}</span>
                        </span>
                        <span className="flex items-center gap-2 text-xs text-muted">
                          {item.dueDate ? formatDate(item.dueDate) : ""}
                          <Pill tone="doing">{t("analytics.deliverablesOpen")}</Pill>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </section>
          </div>
        </>
      )}
    </ViewGate>
  );
}