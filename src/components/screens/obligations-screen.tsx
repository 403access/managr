"use client";

import Link from "next/link";
import { completeDeadline, deleteDeadline, saveDeadline, setObligation } from "@/server/actions";
import type { obligationsView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Disclaimer, Empty, Field, PageHeader, Pill, Section, SelectInput, TextInput } from "@/components/ui";

type Dates = ReturnType<typeof obligationsView>;
type Obligation = Dates["due"][number];

export function ObligationsScreen({ year }: { year: number }) {
  const query = useView<Dates>(queryKeys.obligations(year), viewPath.obligations(year));
  const { t, tx, label } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader
            title={t("dates.title")}
            lede={t("dates.lede")}
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
            {t("dates.showing", { year: data.year })}
            {data.kleinunternehmer ? t("dates.klein") : t("dates.vatOn")}
            {data.usesTaxAdvisor ? t("dates.adviser") : t("dates.standard")}
          </p>
          {data.reminders.length > 0 ? (
            <Card className="mb-4">
              {data.reminders.map((reminder) => (
                <p key={reminder.id} className="text-sm">
                  {t("dates.renews", { label: reminder.label, date: formatDate(reminder.renewalDate) })}
                  {reminder.overdue ? ` · ${t("common.overdue")}` : ""}.
                </p>
              ))}
            </Card>
          ) : null}
          <Section title={t("dates.needsLook")}>
            {data.due.length === 0 ? <Empty>{t("dates.nothingDue")}</Empty> : <div className="grid gap-2">{data.due.map((item) => <ObligationRow key={item.key} item={item} />)}</div>}
          </Section>
          <Section title={t("dates.year")}>
            <div className="grid gap-2">{data.later.map((item) => <ObligationRow key={item.key} item={item} />)}</div>
          </Section>
          <Section title={t("dates.yours")}>
            <div className="grid gap-2">
              {data.deadlines.map((deadline) => (
                <Card key={deadline.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="text-sm font-medium">{deadline.title}</span>
                    <span className="mt-1 block text-xs text-muted">
                      {formatDate(deadline.dueDate)} · {label(deadline.recurrence)} · {label(deadline.category)}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Pill tone={deadline.status}>{label(deadline.status)}</Pill>
                    {deadline.status !== "done" ? (
                      <ActionForm action={completeDeadline} compact>
                        <input type="hidden" name="id" value={deadline.id} />
                        <SubmitButton tone="quiet">{t("common.done")}</SubmitButton>
                      </ActionForm>
                    ) : null}
                    <ActionForm action={deleteDeadline} compact confirm={t("dates.remove")}>
                      <input type="hidden" name="id" value={deadline.id} />
                      <SubmitButton tone="danger">{t("common.remove")}</SubmitButton>
                    </ActionForm>
                  </span>
                </Card>
              ))}
            </div>
            <Card className="mt-3">
              <ActionForm action={saveDeadline} resetOnSuccess>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("common.title")}><TextInput name="title" /></Field>
                  <Field label={t("common.due")}><TextInput name="dueDate" type="date" defaultValue={data.today} /></Field>
                  <Field label={t("common.category")}><TextInput name="category" defaultValue="general" /></Field>
                  <Field label={t("common.repeat")}>
                    <SelectInput name="recurrence" defaultValue="none">
                      <option value="none">{label("none")}</option>
                      <option value="monthly">{label("monthly")}</option>
                      <option value="quarterly">{label("quarterly")}</option>
                      <option value="yearly">{label("yearly")}</option>
                    </SelectInput>
                  </Field>
                </div>
                <Field label={t("common.notes")}><TextInput name="notes" /></Field>
                <SubmitButton>{t("dates.add")}</SubmitButton>
              </ActionForm>
            </Card>
          </Section>
          <div className="mt-8">
            <Disclaimer>{t("disclaimer.dates")}</Disclaimer>
          </div>
        </>
      )}
    </ViewGate>
  );
}

function ObligationRow({ item }: { item: Obligation }) {
  const { t, tx, label } = useI18n();
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{tx(item.title)}</p>
          <p className="text-xs text-muted">
            {formatDate(item.dueDate)} · {label(item.category)}
          </p>
          <p className="mt-1 text-sm text-muted">{tx(item.detail)}</p>
        </div>
        <div className="grid gap-2">
          <Pill tone={item.status}>{label(item.status)}</Pill>
          <ActionForm action={setObligation} compact>
            <input type="hidden" name="key" value={item.key} />
            {item.status !== "done" ? <SubmitButton name="status" value="done">{t("common.done")}</SubmitButton> : null}
            {item.status !== "skipped" ? <SubmitButton name="status" value="skipped" tone="quiet">{t("common.skip")}</SubmitButton> : null}
            {item.status !== "open" ? <SubmitButton name="status" value="open" tone="quiet">{t("common.reopen")}</SubmitButton> : null}
          </ActionForm>
        </div>
      </div>
    </Card>
  );
}
