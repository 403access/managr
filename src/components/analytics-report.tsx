import type { ReactNode } from "react";
import type { analyticsView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { formatEuro } from "@/domain/money";
import { label, monthName, t } from "@/i18n";
import { formatDuration } from "@/components/amounts";
import { MonthBarChart, StatusBar, TimeBarChart } from "@/components/charts";
import { PrintReportButton } from "@/components/print-report-button";

type Analytics = ReturnType<typeof analyticsView>;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h2 className="mb-3 border-b border-line pb-2 text-2xl">{title}</h2>
      {children}
    </section>
  );
}

export function AnalyticsReport({ data }: { data: Analytics }) {
  const text = (key: Parameters<typeof t>[1], vars?: Record<string, string | number>) => t("de", key, vars);
  return (
    <main className="mx-auto max-w-4xl px-6 py-8 text-sm">
      <PrintReportButton backHref={`/analytics?year=${data.year}`} year={data.year} />

      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-ink pb-5">
        <div>
          <p className="text-xs tracking-wide text-muted uppercase">managr</p>
          <h1 className="mt-1 text-3xl">{text("analytics.reportTitle")}</h1>
          <p className="mt-2 text-muted">{text("analytics.reportScope", { year: data.year })}</p>
          <p className="text-muted">{text("analytics.reportGenerated", { date: formatDate(data.today) })}</p>
        </div>
        <div className="text-right">
          <p className="font-medium">{data.company.legalName}</p>
          <p className="text-muted">{data.company.city}</p>
          <p className="mt-2 font-medium">{text("analytics.reportCustomer")}</p>
          <p>{data.customer?.name ?? text("analytics.reportAll")}</p>
          {data.customer?.city ? <p className="text-muted">{data.customer.city}</p> : null}
          {data.customer?.email ? <p className="text-muted">{data.customer.email}</p> : null}
        </div>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [text("analytics.totalTime"), formatDuration(data.totals.minutes)],
          [text("analytics.productive"), `${data.productiveShare} %`],
          [text("analytics.billable"), `${data.billableShare} %`],
          [text("analytics.projectsActive"), String(data.projectCounts.active)],
        ].map(([title, value]) => (
          <div key={title} className="rounded-xl border border-line p-3">
            <p className="text-xs text-muted">{title}</p>
            <p className="mt-1 font-mono text-lg tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <Section title={text("analytics.projectTime")}>
        <TimeBarChart
          ariaLabel={text("analytics.projectTime")}
          empty={text("analytics.noTime")}
          rows={data.projectRows.map((row) => ({
            key: String(row.projectId ?? "none"),
            label: row.unassigned ? text("analytics.unassigned") : row.name,
            minutes: row.minutes,
            productiveMinutes: row.productiveMinutes,
            secondary: `${row.customerName || text("analytics.noCustomer")} · ${formatDuration(row.billableMinutes)} ${text("analytics.billable")}`,
          }))}
        />
        <p className="mt-3 text-xs text-muted">{text("analytics.productiveHint")}</p>
      </Section>

      <Section title={text("analytics.projectStatus")}>
        <StatusBar
          total={data.projectCounts.started + data.projectCounts.completed + data.projectCounts.active + data.projectCounts.paused}
          parts={[
            { key: "started", label: text("analytics.projectsStarted", { year: data.year }), value: data.projectCounts.started, tone: "pine" },
            { key: "completed", label: text("analytics.projectsCompleted", { year: data.year }), value: data.projectCounts.completed, tone: "moss" },
            { key: "active", label: text("analytics.projectsActive"), value: data.projectCounts.active, tone: "amber" },
            { key: "paused", label: text("analytics.projectsPaused"), value: data.projectCounts.paused, tone: "muted" },
          ]}
        />
        <p className="mt-3 text-xs text-muted">{text("analytics.statusHint")}</p>
      </Section>

      <Section title={text("analytics.taskTypes")}>
        <TimeBarChart
          ariaLabel={text("analytics.taskTypes")}
          empty={text("analytics.noTaskTypes")}
          rows={data.typeRows.map((row) => ({
            key: row.taskType,
            label: label("de", row.taskType),
            minutes: row.minutes,
            productiveMinutes: row.productive ? row.minutes : 0,
            secondary: `${text("analytics.taskCount", { count: row.taskCount })} · ${row.productive ? text("analytics.productiveLegend") : text("analytics.unproductiveLegend")}`,
          }))}
        />
      </Section>

      <Section title={text("analytics.monthly")}>
        {data.totals.minutes === 0 ? (
          <p className="text-muted">{text("analytics.noTime")}</p>
        ) : (
          <MonthBarChart
            ariaLabel={text("analytics.monthly")}
            months={data.months.map((month) => ({
              key: month.month,
              label: monthName("de", Number(month.month.slice(5, 7))),
              minutes: month.minutes,
              productiveMinutes: month.productiveMinutes,
              unproductiveMinutes: month.unproductiveMinutes,
            }))}
          />
        )}
      </Section>

      <Section title={text("analytics.deliverables")}>
        {data.deliverables.length === 0 ? <p className="text-muted">{text("analytics.noDeliverables")}</p> : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-medium">Deliverable</th>
                <th className="py-2 font-medium">{text("analytics.project")}</th>
                <th className="py-2 font-medium">{text("analytics.customer")}</th>
                <th className="py-2 text-right font-medium">{text("analytics.completedOn")}</th>
              </tr>
            </thead>
            <tbody>
              {data.deliverables.map((item) => (
                <tr key={item.id} className="border-b border-line">
                  <td className="py-2">{item.title}</td>
                  <td className="py-2">{item.projectName || text("analytics.unassigned")}</td>
                  <td className="py-2">{item.customerName || text("analytics.noCustomer")}</td>
                  <td className="py-2 text-right">{item.completedAt ? formatDate(item.completedAt) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={text("analytics.openDeliverables")}>
        {data.openDeliverables.length === 0 ? <p className="text-muted">{text("analytics.noOpenDeliverables")}</p> : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-medium">Deliverable</th>
                <th className="py-2 font-medium">{text("analytics.project")}</th>
                <th className="py-2 font-medium">{text("analytics.customer")}</th>
                <th className="py-2 text-right font-medium">{text("analytics.dueOn")}</th>
              </tr>
            </thead>
            <tbody>
              {data.openDeliverables.map((item) => (
                <tr key={item.id} className="border-b border-line">
                  <td className="py-2">{item.title}</td>
                  <td className="py-2">{item.projectName || text("analytics.unassigned")}</td>
                  <td className="py-2">{item.customerName || text("analytics.noCustomer")}</td>
                  <td className="py-2 text-right">{item.dueDate ? formatDate(item.dueDate) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={text("analytics.people")}>
        {data.peopleRows.length === 0 ? <p className="text-muted">{text("analytics.noPeople")}</p> : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 font-medium">{text("common.name")}</th>
                <th className="py-2 font-medium">{text("people.role")}</th>
                <th className="py-2 text-right font-medium">{text("analytics.minutes")}</th>
                <th className="py-2 text-right font-medium">{text("analytics.productive")}</th>
                <th className="py-2 text-right font-medium">{text("analytics.projectsActive")}</th>
              </tr>
            </thead>
            <tbody>
              {data.peopleRows.map((person) => (
                <tr key={String(person.employeeId ?? "none")} className="border-b border-line">
                  <td className="py-2">{person.employeeId === null ? text("analytics.noPerson") : `${person.firstName} ${person.lastName}`}</td>
                  <td className="py-2">{person.role}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{formatDuration(person.minutes)}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{person.productiveShare} %</td>
                  <td className="py-2 text-right font-mono tabular-nums">{person.projectCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {data.customer === null ? (
        <Section title={text("analytics.customers")}>
          {data.customerRows.length === 0 ? <p className="text-muted">{text("analytics.noCustomers")}</p> : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="py-2 font-medium">{text("analytics.customer")}</th>
                  <th className="py-2 text-right font-medium">{text("analytics.minutes")}</th>
                  <th className="py-2 text-right font-medium">{text("analytics.projectStatus")}</th>
                  <th className="py-2 text-right font-medium">{text("analytics.invoiced", { year: data.year })}</th>
                </tr>
              </thead>
              <tbody>
                {data.customerRows.map((customer) => (
                  <tr key={customer.customerId} className="border-b border-line">
                    <td className="py-2">{customer.name}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{formatDuration(customer.minutes)}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{customer.projectCount}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{formatEuro(customer.invoicedCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}

      <footer className="mt-10 border-t border-line pt-4 text-xs leading-relaxed text-muted">
        <p>{text("analytics.reportNote")}</p>
        <p className="mt-1">{data.company.legalName}</p>
      </footer>
    </main>
  );
}