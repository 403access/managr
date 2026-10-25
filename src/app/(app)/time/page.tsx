import Link from "next/link";
import { deleteTask, deleteTime, saveTask, saveTime, toggleTask } from "@/server/actions";
import { listPeople, listTasks, listTime } from "@/server/queries";
import { addDays, formatDate, todayIso } from "@/domain/calendar";
import { durationMinutes, timeWarnings } from "@/domain/time";
import { formatDuration } from "@/components/amounts";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Check, Empty, Field, PageHeader, Pill, Section, SelectInput, TextInput } from "@/components/ui";

export const metadata = { title: "Time" };

export default async function TimePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const params = await searchParams;
  const anchor = params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week) ? params.week : todayIso();
  const week = listTime(anchor);
  const people = listPeople();
  const tasks = listTasks();
  const previous = addDays(week.start, -7);
  const next = addDays(week.start, 7);
  let total = 0;

  return (
    <>
      <PageHeader title="Time" lede={`${formatDate(week.start)} – ${formatDate(week.end)}`} action={
        <span className="flex gap-2">
          <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href={`/time?week=${previous}`}>Previous</Link>
          <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href={`/time?week=${next}`}>Next</Link>
        </span>
      } />
      {week.entries.length === 0 ? <Empty>No time in this week.</Empty> : (
        <div className="grid gap-2">
          {week.entries.map((entry) => {
            let minutes = 0;
            let warnings: { level: "stop" | "watch"; message: string }[] = [];
            let error = "";
            try {
              minutes = durationMinutes(entry.startedAt, entry.endedAt, entry.breakMinutes);
              warnings = timeWarnings(minutes, entry.breakMinutes);
              total += minutes;
            } catch (caught) {
              error = caught instanceof Error ? caught.message : "Check this entry.";
            }
            const person = people.find((item) => item.employee.id === entry.employeeId);
            return (
              <Card key={entry.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{formatDate(entry.entryDate)} · {entry.startedAt}–{entry.endedAt} · break {entry.breakMinutes} min</p>
                    <p className="text-sm text-muted">{entry.memo || "No memo"}{person ? ` · ${person.employee.firstName}` : ""}{entry.billable ? " · billable" : ""}</p>
                    {error ? <p className="text-sm text-clay">{error}</p> : <p className="font-mono text-sm">{formatDuration(minutes)}</p>}
                    {warnings.map((warning) => <p key={warning.message} className="text-sm text-amber">{warning.message}</p>)}
                  </div>
                  <ActionForm action={deleteTime} compact>
                    <input type="hidden" name="id" value={entry.id} />
                    <SubmitButton tone="quiet">Remove</SubmitButton>
                  </ActionForm>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-sm">Week total {formatDuration(total)}.</p>
      <Section title="Add time">
        <Card>
          <ActionForm action={saveTime}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Day"><TextInput name="entryDate" type="date" defaultValue={anchor} /></Field>
              <Field label="Person">
                <SelectInput name="employeeId" defaultValue="">
                  <option value="">No one named</option>
                  {people.map((item) => <option key={item.employee.id} value={item.employee.id}>{item.employee.firstName} {item.employee.lastName}</option>)}
                </SelectInput>
              </Field>
              <Field label="Start"><TextInput name="startedAt" type="time" defaultValue="09:00" /></Field>
              <Field label="End"><TextInput name="endedAt" type="time" defaultValue="17:00" /></Field>
              <Field label="Break minutes"><TextInput name="breakMinutes" inputMode="numeric" defaultValue="30" /></Field>
              <Field label="Task">
                <SelectInput name="taskId" defaultValue="">
                  <option value="">None</option>
                  {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                </SelectInput>
              </Field>
            </div>
            <Field label="Memo"><TextInput name="memo" /></Field>
            <Check name="billable" label="Billable" />
            <SubmitButton>Save time</SubmitButton>
          </ActionForm>
        </Card>
      </Section>
      <Section title="Tasks">
        <div className="grid gap-2">
          {tasks.map((task) => (
            <Card key={task.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="text-sm font-medium">{task.title}</span>
                {task.dueDate ? <span className="mt-1 block text-xs text-muted">Due {formatDate(task.dueDate)} · {task.area}</span> : null}
                {task.notes ? <span className="mt-1 block text-xs text-muted">{task.notes}</span> : null}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <Pill tone={task.status}>{task.status}</Pill>
                <ActionForm action={toggleTask} compact>
                  <input type="hidden" name="id" value={task.id} />
                  <SubmitButton tone="quiet">Advance</SubmitButton>
                </ActionForm>
                <ActionForm action={deleteTask} compact confirm="Remove this task?">
                  <input type="hidden" name="id" value={task.id} />
                  <SubmitButton tone="danger">Remove</SubmitButton>
                </ActionForm>
              </span>
            </Card>
          ))}
        </div>
        <Card className="mt-3">
          <ActionForm action={saveTask}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title"><TextInput name="title" /></Field>
              <Field label="Due"><TextInput name="dueDate" type="date" /></Field>
              <Field label="Area">
                <SelectInput name="area" defaultValue="general">
                  <option value="general">General</option>
                  <option value="invoices">Invoices</option>
                  <option value="tax">Tax</option>
                  <option value="legal">Legal</option>
                  <option value="cover">Cover</option>
                  <option value="people">People</option>
                </SelectInput>
              </Field>
              <Field label="Status">
                <SelectInput name="status" defaultValue="open">
                  <option value="open">Open</option>
                  <option value="doing">Doing</option>
                  <option value="done">Done</option>
                </SelectInput>
              </Field>
            </div>
            <Field label="Notes"><TextInput name="notes" /></Field>
            <SubmitButton>Add task</SubmitButton>
          </ActionForm>
        </Card>
      </Section>
    </>
  );
}
