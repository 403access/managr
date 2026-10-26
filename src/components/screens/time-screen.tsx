"use client";

import Link from "next/link";
import { deleteTask, deleteTime, saveTask, saveTime, toggleTask } from "@/server/actions";
import type { timeView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { queryKeys, viewPath } from "@/client/query-keys";
import { formatDuration } from "@/components/amounts";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Check, Empty, Field, PageHeader, Pill, Section, SelectInput, TextInput } from "@/components/ui";

type Week = ReturnType<typeof timeView>;

const areas = ["general", "invoices", "tax", "legal", "cover", "people"] as const;

export function TimeScreen({ week }: { week: string }) {
  const query = useView<Week>(queryKeys.time(week), viewPath.time(week));
  const { t, tx, label } = useI18n();
  const areaName = (code: string) => (code === "legal" ? t("nav.legal") : label(code));
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader
            title={t("time.title")}
            lede={`${formatDate(data.start)} – ${formatDate(data.end)}`}
            action={
              <span className="flex gap-2">
                <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href={`/time?week=${data.previous}`}>
                  {t("common.previous")}
                </Link>
                <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href={`/time?week=${data.next}`}>
                  {t("common.next")}
                </Link>
              </span>
            }
          />
          {data.entries.length === 0 ? (
            <Empty>{t("time.empty")}</Empty>
          ) : (
            <div className="grid gap-2">
              {data.entries.map((entry) => (
                <Card key={entry.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {t("time.span", { date: formatDate(entry.entryDate), start: entry.startedAt, end: entry.endedAt, minutes: entry.breakMinutes })}
                      </p>
                      <p className="text-sm text-muted">
                        {entry.memo || t("time.noMemo")}
                        {entry.firstName ? ` · ${entry.firstName}` : ""}
                        {entry.billable ? ` · ${t("time.billable")}` : ""}
                      </p>
                      {entry.error ? <p className="text-sm text-clay">{tx(entry.error)}</p> : <p className="font-mono text-sm">{formatDuration(entry.minutes)}</p>}
                      {entry.warnings.map((warning) => (
                        <p key={warning.message} className="text-sm text-amber">
                          {tx(warning.message)}
                        </p>
                      ))}
                    </div>
                    <ActionForm action={deleteTime} compact>
                      <input type="hidden" name="id" value={entry.id} />
                      <SubmitButton tone="quiet">{t("common.remove")}</SubmitButton>
                    </ActionForm>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <p className="mt-3 text-sm">{t("time.total", { duration: formatDuration(data.total) })}</p>
          <Section title={t("time.add")}>
            <Card>
              <ActionForm action={saveTime} resetOnSuccess>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("time.day")}><TextInput name="entryDate" type="date" defaultValue={data.anchor} /></Field>
                  <Field label={t("time.person")}>
                    <SelectInput name="employeeId" defaultValue="">
                      <option value="">{t("time.nobody")}</option>
                      {data.people.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.firstName} {person.lastName}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label={t("common.start")}><TextInput name="startedAt" type="time" defaultValue="09:00" /></Field>
                  <Field label={t("common.end")}><TextInput name="endedAt" type="time" defaultValue="17:00" /></Field>
                  <Field label={t("time.break")}><TextInput name="breakMinutes" inputMode="numeric" defaultValue="30" /></Field>
                  <Field label={t("time.task")}>
                    <SelectInput name="taskId" defaultValue="">
                      <option value="">{t("time.none")}</option>
                      {data.tasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>
                <Field label={t("common.memo")}><TextInput name="memo" /></Field>
                <Check name="billable" label={t("time.billableCheck")} />
                <SubmitButton>{t("time.save")}</SubmitButton>
              </ActionForm>
            </Card>
          </Section>
          <Section title={t("time.tasks")}>
            <div className="grid gap-2">
              {data.tasks.map((task) => (
                <Card key={task.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="text-sm font-medium">{task.title}</span>
                    {task.dueDate ? <span className="mt-1 block text-xs text-muted">{t("time.taskDue", { date: formatDate(task.dueDate), area: areaName(task.area) })}</span> : null}
                    {task.notes ? <span className="mt-1 block text-xs text-muted">{task.notes}</span> : null}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Pill tone={task.status}>{label(task.status)}</Pill>
                    <ActionForm action={toggleTask} compact>
                      <input type="hidden" name="id" value={task.id} />
                      <SubmitButton tone="quiet">{t("common.advance")}</SubmitButton>
                    </ActionForm>
                    <ActionForm action={deleteTask} compact confirm={t("time.removeTask")}>
                      <input type="hidden" name="id" value={task.id} />
                      <SubmitButton tone="danger">{t("common.remove")}</SubmitButton>
                    </ActionForm>
                  </span>
                </Card>
              ))}
            </div>
            <Card className="mt-3">
              <ActionForm action={saveTask} resetOnSuccess>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("common.title")}><TextInput name="title" /></Field>
                  <Field label={t("common.due")}><TextInput name="dueDate" type="date" /></Field>
                  <Field label={t("time.area")}>
                    <SelectInput name="area" defaultValue="general">
                      {areas.map((area) => (
                        <option key={area} value={area}>{areaName(area)}</option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label={t("common.status")}>
                    <SelectInput name="status" defaultValue="open">
                      <option value="open">{label("open")}</option>
                      <option value="doing">{label("doing")}</option>
                      <option value="done">{label("done")}</option>
                    </SelectInput>
                  </Field>
                </div>
                <Field label={t("common.notes")}><TextInput name="notes" /></Field>
                <SubmitButton>{t("time.addTask")}</SubmitButton>
              </ActionForm>
            </Card>
          </Section>
        </>
      )}
    </ViewGate>
  );
}
