import Link from "next/link";
import { toggleTask } from "@/server/actions";
import { accountBalances, listDeadlines, listInvoices, listObligations, listPolicies, listTasks, listTime, loadCompany, signedAccount } from "@/server/queries";
import { ACCOUNTS } from "@/domain/accounts";
import { addDays, fiscalYearContaining, formatDate, todayIso } from "@/domain/calendar";
import { formatEuro } from "@/domain/money";
import { policyReminders } from "@/domain/obligations";
import { conversionGap } from "@/domain/reserve";
import { summarizeProfit } from "@/domain/reporting";
import { kleinunternehmerAssessment } from "@/domain/tax";
import { durationMinutes } from "@/domain/time";
import { formatDuration } from "@/components/amounts";
import { SubmitButton } from "@/components/action-form";
import { ActionForm } from "@/components/action-form";
import { Card, Disclaimer, Empty, Money, PageHeader, Pill, Stat } from "@/components/ui";

export const metadata = { title: "Desk" };

export default function DeskPage() {
  const company = loadCompany();
  const today = todayIso();
  const yearNumber = Number(today.slice(0, 4));
  const fy = fiscalYearContaining(today, company.fiscalYearStartMonth);
  const yearRows = accountBalances(fy.start, today);
  const profit = summarizeProfit(yearRows);
  const balances = accountBalances();
  const reserve = signedAccount(balances, ACCOUNTS.reserve);
  const gap = conversionGap(company.shareCapitalCents, reserve);
  const calendarRevenue = summarizeProfit(accountBalances(`${yearNumber}-01-01`, today)).revenueCents;
  const klein = kleinunternehmerAssessment({
    foundingDate: company.foundingDate,
    calendarYear: yearNumber,
    priorYearTurnoverCents: company.priorYearRevenueCents,
    currentYearTurnoverCents: calendarRevenue,
    claimsExemption: company.kleinunternehmer,
  });
  const openInvoices = listInvoices().filter((invoice) => ["open", "overdue", "partial", "draft"].includes(invoice.displayStatus)).slice(0, 5);
  const horizon = addDays(today, 45);
  const dates = [...listObligations(yearNumber), ...listObligations(yearNumber + 1)]
    .filter((item) => item.status !== "done" && item.status !== "skipped" && item.dueDate <= horizon)
    .map((item) => ({ due: item.dueDate, title: item.title, href: "/obligations", tone: item.dueDate < today ? "overdue" : "open" }));
  for (const deadline of listDeadlines()) {
    if (deadline.status === "open" && deadline.dueDate <= horizon) {
      dates.push({ due: deadline.dueDate, title: deadline.title, href: "/obligations", tone: deadline.dueDate < today ? "overdue" : "open" });
    }
  }
  for (const reminder of policyReminders(listPolicies(), today)) {
    dates.push({ due: reminder.renewalDate, title: reminder.label, href: "/company", tone: reminder.overdue ? "overdue" : "open" });
  }
  dates.sort((a, b) => a.due.localeCompare(b.due));
  const tasks = listTasks().filter((task) => task.status !== "done").slice(0, 5);
  const week = listTime(today);
  const minutes = week.entries.reduce((sum, entry) => {
    try {
      return sum + durationMinutes(entry.startedAt, entry.endedAt, entry.breakMinutes);
    } catch {
      return sum;
    }
  }, 0);

  return (
    <>
      <PageHeader title="Desk" lede={`${company.legalName} · ${formatDate(today)}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bank" value={formatEuro(signedAccount(balances, ACCOUNTS.bank))} />
        <Stat label="Receivables" value={formatEuro(signedAccount(balances, ACCOUNTS.receivables))} />
        <Stat label="Profit before tax" value={formatEuro(profit.profitBeforeTaxCents)} hint={`Financial year ${fy.label}, to date`} />
        <Stat label="Reserve gap" value={formatEuro(gap.gapCents)} hint={gap.dutyActive ? "Share capital plus reserve, toward the GmbH minimum" : "§5a duty is off in this record"} />
      </div>
      {gap.dutyActive && gap.gapCents === 0 ? (
        <p className="mt-3 text-sm text-muted">Capital and reserve cover €25,000 on paper. The UG rules end only when a capital increase is registered.</p>
      ) : null}
      {klein.notes.length > 0 ? (
        <Card className="mt-4">
          {klein.notes.map((note) => <p key={note} className="text-sm leading-relaxed">{note}</p>)}
        </Card>
      ) : null}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-2xl">Invoices</h2>
          {openInvoices.length === 0 ? <Empty>Nothing open.</Empty> : (
            <div className="grid gap-2">
              {openInvoices.map((invoice) => (
                <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
                  <span>
                    <span className="block text-sm font-medium">{invoice.customerName}</span>
                    <span className="text-xs text-muted">{invoice.number ?? "Draft"} · {formatDate(invoice.dueDate)}</span>
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
          {dates.length === 0 ? <Empty>Nothing due in the next 45 days.</Empty> : (
            <div className="grid gap-2">
              {dates.slice(0, 7).map((item) => (
                <Link key={`${item.href}-${item.title}-${item.due}`} href={item.href} className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
                  <span className="text-sm">{item.title}</span>
                  <span className="flex items-center gap-2 text-xs"><span className="text-muted">{formatDate(item.due)}</span><Pill tone={item.tone}>{item.tone === "overdue" ? "overdue" : "due"}</Pill></span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section>
          <h2 className="mb-3 text-2xl">Tasks</h2>
          {tasks.length === 0 ? <Empty>No open tasks.</Empty> : (
            <div className="grid gap-2">
              {tasks.map((task) => (
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
            <p className="font-mono text-2xl">{formatDuration(minutes)}</p>
            <p className="mt-1 text-sm text-muted">{formatDate(week.start)} – {formatDate(week.end)}</p>
            <Link href="/time" className="mt-3 inline-flex min-h-11 items-center text-sm text-pine">Open time</Link>
          </Card>
        </section>
      </div>
      <div className="mt-8">
        <Disclaimer />
      </div>
    </>
  );
}
