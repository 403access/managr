"use client";

import Link from "next/link";
import { completeDeadline, deleteDeadline, saveDeadline, setObligation } from "@/server/actions";
import type { obligationsView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Disclaimer, Empty, Field, PageHeader, Pill, Section, SelectInput, TextInput } from "@/components/ui";

type Dates = ReturnType<typeof obligationsView>;
type Obligation = Dates["due"][number];

export function ObligationsScreen({ year }: { year: number }) {
  const query = useView<Dates>(queryKeys.obligations(year), viewPath.obligations(year));
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader
            title="Dates"
            lede="Weekend and nationwide holidays shift under §108 AO. State holidays are not included, and a tax notice beats this calendar."
            action={
              <span className="flex gap-2">
                <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href={`/obligations?year=${data.year - 1}`}>
                  {data.year - 1}
                </Link>
                <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href={`/obligations?year=${data.year + 1}`}>
                  {data.year + 1}
                </Link>
              </span>
            }
          />
          <p className="mb-4 text-sm text-muted">
            Showing {data.year}. {data.kleinunternehmer ? "VAT dates are hidden while Kleinunternehmer is on." : "VAT dates follow the permanent extension flag."}
            {data.usesTaxAdvisor ? " Annual returns use the adviser deadline." : " Annual returns use the standard deadline."}
          </p>
          {data.reminders.length > 0 ? (
            <Card className="mb-4">
              {data.reminders.map((reminder) => (
                <p key={reminder.id} className="text-sm">
                  {reminder.label} renews {formatDate(reminder.renewalDate)}
                  {reminder.overdue ? " · overdue" : ""}.
                </p>
              ))}
            </Card>
          ) : null}
          <Section title="Needs a look">
            {data.due.length === 0 ? <Empty>Nothing open and due.</Empty> : <div className="grid gap-2">{data.due.map((item) => <ObligationRow key={item.key} item={item} />)}</div>}
          </Section>
          <Section title="The year">
            <div className="grid gap-2">{data.later.map((item) => <ObligationRow key={item.key} item={item} />)}</div>
          </Section>
          <Section title="Your deadlines">
            <div className="grid gap-2">
              {data.deadlines.map((deadline) => (
                <Card key={deadline.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="text-sm font-medium">{deadline.title}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {formatDate(deadline.dueDate)} · {deadline.recurrence} · {deadline.category}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Pill tone={deadline.status}>{deadline.status}</Pill>
                    {deadline.status !== "done" ? (
                      <ActionForm action={completeDeadline} compact>
                        <input type="hidden" name="id" value={deadline.id} />
                        <SubmitButton tone="quiet">Done</SubmitButton>
                      </ActionForm>
                    ) : null}
                    <ActionForm action={deleteDeadline} compact confirm="Remove this deadline?">
                      <input type="hidden" name="id" value={deadline.id} />
                      <SubmitButton tone="danger">Remove</SubmitButton>
                    </ActionForm>
                  </span>
                </Card>
              ))}
            </div>
            <Card className="mt-3">
              <ActionForm action={saveDeadline} resetOnSuccess>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Title"><TextInput name="title" /></Field>
                  <Field label="Due"><TextInput name="dueDate" type="date" defaultValue={data.today} /></Field>
                  <Field label="Category"><TextInput name="category" defaultValue="general" /></Field>
                  <Field label="Repeat">
                    <SelectInput name="recurrence" defaultValue="none">
                      <option value="none">Once</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </SelectInput>
                  </Field>
                </div>
                <Field label="Notes"><TextInput name="notes" /></Field>
                <SubmitButton>Add deadline</SubmitButton>
              </ActionForm>
            </Card>
          </Section>
          <div className="mt-8">
            <Disclaimer>These dates are a reminder list. They do not file a return.</Disclaimer>
          </div>
        </>
      )}
    </ViewGate>
  );
}

function ObligationRow({ item }: { item: Obligation }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{item.title}</p>
          <p className="text-xs text-muted">
            {formatDate(item.dueDate)} · {item.category}
          </p>
          <p className="mt-1 text-sm text-muted">{item.detail}</p>
        </div>
        <div className="grid gap-2">
          <Pill tone={item.status}>{item.status}</Pill>
          <ActionForm action={setObligation} compact>
            <input type="hidden" name="key" value={item.key} />
            {item.status !== "done" ? <SubmitButton name="status" value="done">Done</SubmitButton> : null}
            {item.status !== "skipped" ? <SubmitButton name="status" value="skipped" tone="quiet">Skip</SubmitButton> : null}
            {item.status !== "open" ? <SubmitButton name="status" value="open" tone="quiet">Reopen</SubmitButton> : null}
          </ActionForm>
        </div>
      </div>
    </Card>
  );
}
