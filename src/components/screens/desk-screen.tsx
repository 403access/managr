"use client";

import Link from "next/link";
import { toggleTask } from "@/server/actions";
import type { deskView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { formatEuro } from "@/domain/money";
import { GMBH_MINIMUM_CAPITAL_CENTS } from "@/domain/rates-2026";
import { queryKeys, viewPath } from "@/client/query-keys";
import { formatDuration } from "@/components/amounts";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Disclaimer, Empty, Money, PageHeader, Pill, Stat } from "@/components/ui";

type Desk = ReturnType<typeof deskView>;

export function DeskScreen() {
  const query = useView<Desk>(queryKeys.desk, viewPath.desk);
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader title="Desk" lede={`${data.legalName} · ${formatDate(data.today)}`} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Bank" value={formatEuro(data.bankCents)} />
            <Stat label="Receivables" value={formatEuro(data.receivablesCents)} />
            <Stat label="Profit before tax" value={formatEuro(data.profitBeforeTaxCents)} hint={`Financial year ${data.fyLabel}, to date`} />
            <Stat label="Reserve gap" value={formatEuro(data.gap.gapCents)} hint={data.gap.dutyActive ? "Share capital plus reserve, toward the GmbH minimum" : "§5a duty is off in this record"} />
          </div>
          {data.gap.dutyActive && data.gap.gapCents === 0 ? (
            <p className="mt-3 text-sm text-muted">Capital and reserve cover {formatEuro(GMBH_MINIMUM_CAPITAL_CENTS)} on paper. The UG rules end only when a capital increase is registered.</p>
          ) : null}
          {data.kleinNotes.length > 0 ? (
            <Card className="mt-4">
              {data.kleinNotes.map((note) => (
                <p key={note} className="text-sm leading-relaxed">
                  {note}
                </p>
              ))}
            </Card>
          ) : null}
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section>
              <h2 className="mb-3 text-2xl">Invoices</h2>
              {data.invoices.length === 0 ? (
                <Empty>Nothing open.</Empty>
              ) : (
                <div className="grid gap-2">
                  {data.invoices.map((invoice) => (
                    <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
                      <span>
                        <span className="block text-sm font-medium">{invoice.customerName}</span>
                        <span className="text-xs text-muted">
                          {invoice.number ?? "Draft"} · {formatDate(invoice.dueDate)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Money cents={invoice.openCents} />
                        <Pill tone={invoice.displayStatus}>{invoice.displayStatus}</Pill>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h2 className="mb-3 text-2xl">Coming up</h2>
              {data.dates.length === 0 ? (
                <Empty>Nothing due in the next 45 days.</Empty>
              ) : (
                <div className="grid gap-2">
                  {data.dates.map((item) => (
                    <Link key={`${item.href}-${item.title}-${item.due}`} href={item.href} className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
                      <span className="text-sm">{item.title}</span>
                      <span className="flex items-center gap-2 text-xs">
                        <span className="text-muted">{formatDate(item.due)}</span>
                        <Pill tone={item.tone}>{item.tone === "overdue" ? "overdue" : "due"}</Pill>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h2 className="mb-3 text-2xl">Tasks</h2>
              {data.tasks.length === 0 ? (
                <Empty>No open tasks.</Empty>
              ) : (
                <div className="grid gap-2">
                  {data.tasks.map((task) => (
                    <Card key={task.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="text-sm font-medium">{task.title}</span>
                        {task.dueDate ? <span className="mt-1 block text-xs text-muted">{formatDate(task.dueDate)}</span> : null}
                      </span>
                      <span className="flex items-center gap-2">
                        <Pill tone={task.status}>{task.status}</Pill>
                        <ActionForm action={toggleTask} compact>
                          <input type="hidden" name="id" value={task.id} />
                          <SubmitButton tone="quiet">Advance</SubmitButton>
                        </ActionForm>
                      </span>
                    </Card>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h2 className="mb-3 text-2xl">This week</h2>
              <Card>
                <p className="font-mono text-2xl">{formatDuration(data.minutes)}</p>
                <p className="mt-1 text-sm text-muted">
                  {formatDate(data.weekStart)} – {formatDate(data.weekEnd)}
                </p>
                <Link href="/time" className="mt-3 inline-flex min-h-11 items-center text-sm text-pine">
                  Open time
                </Link>
              </Card>
            </section>
          </div>
          <div className="mt-8">
            <Disclaimer />
          </div>
        </>
      )}
    </ViewGate>
  );
}
