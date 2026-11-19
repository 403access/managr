"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { deleteTask, deleteTime, saveTask, saveTime, toggleTask } from "@/server/actions";
import type { timeView } from "@/server/views";
import { TASK_TYPES, type TaskType } from "@/domain/analytics";
import { addDays, formatDate } from "@/domain/calendar";
import {
  DEFAULT_TASK_SORT,
  DEFAULT_TIME_ENTRY_SORT,
  TASK_SORTS,
  TIME_ENTRY_SORTS,
  daySpan,
  filterTasks,
  filterTimeEntries,
  sortTasks,
  sortTimeEntries,
  type TaskSort,
  type TimeEntrySort,
} from "@/domain/time";
import { queryKeys, viewPath } from "@/client/query-keys";
import { formatDuration } from "@/components/amounts";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AddSheet } from "@/components/add-sheet";
import { DateRangeCalendar } from "@/components/date-range-calendar";
import { InfoButton } from "@/components/info-sheet";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { Tab, Tabs } from "@/components/tabs";
import { Card, Check, Empty, Field, PageHeader, Pill, SelectInput, TextInput } from "@/components/ui";

type Week = ReturnType<typeof timeView>;

const areas = ["general", "invoices", "tax", "legal", "cover", "people"] as const;

export function TimeScreen({ from, to }: { from: string; to: string }) {
  const query = useView<Week>(queryKeys.time(from, to), viewPath.time(from, to));
  return <ViewGate query={query}>{(data) => <TimeBody data={data} />}</ViewGate>;
}

function TimeBody({ data }: { data: Week }) {
  const { t, label } = useI18n();
  const areaName = (code: string) => (code === "legal" ? t("nav.legal") : label(code));
  const span = daySpan(data.start, data.end);
  const previousHref = `/time?from=${addDays(data.start, -span)}&to=${addDays(data.end, -span)}`;
  const nextHref = `/time?from=${addDays(data.end, 1)}&to=${addDays(data.end, span)}`;
  return (
    <>
      <PageHeader
        title={t("time.title")}
        lede={`${formatDate(data.start)} – ${formatDate(data.end)}`}
        info={<InfoButton topic="time" />}
        action={
          <span className="flex flex-wrap gap-2">
            <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href="/projects">
              {t("nav.projects")}
            </Link>
            <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href="/time/playback">
              {t("time.playback")}
            </Link>
            <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href={previousHref}>
              {t("common.previous")}
            </Link>
            <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href={nextHref}>
              {t("common.next")}
            </Link>
            <AddSheet label={t("common.add")} title={t("common.add")}>
              <Tabs label={t("tabs.sections")} inline>
                <Tab id="entry" label={t("time.add")}>
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
                      <Field label={t("time.project")}>
                        <SelectInput name="projectId" defaultValue="">
                          <option value="">{t("time.projectNone")}</option>
                          {data.projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </SelectInput>
                      </Field>
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
                      <Field label={t("time.taskType")} hint={t("time.taskTypeHint")}>
                        <SelectInput name="taskType" defaultValue="">
                          <option value="">{t("time.taskTypeFromTask")}</option>
                          {TASK_TYPES.map((type) => (
                            <option key={type} value={type}>{label(type)}</option>
                          ))}
                        </SelectInput>
                      </Field>
                    </div>
                    <Field label={t("common.memo")}><TextInput name="memo" /></Field>
                    <Check name="billable" label={t("time.billableCheck")} />
                    <SubmitButton>{t("time.save")}</SubmitButton>
                  </ActionForm>
                </Tab>
                <Tab id="task" label={t("time.addTask")}>
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
                      <Field label={t("time.project")}>
                        <SelectInput name="projectId" defaultValue="">
                          <option value="">{t("time.projectNone")}</option>
                          {data.projects.map((project) => (
                            <option key={project.id} value={project.id}>{project.name}</option>
                          ))}
                        </SelectInput>
                      </Field>
                      <Field label={t("time.taskType")}>
                        <SelectInput name="taskType" defaultValue="other">
                          {TASK_TYPES.map((type) => (
                            <option key={type} value={type}>{label(type)}</option>
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
                    <Check name="deliverable" label={t("time.deliverable")} hint={t("time.deliverableHint")} />
                    <Field label={t("common.notes")}><TextInput name="notes" /></Field>
                    <SubmitButton>{t("time.addTask")}</SubmitButton>
                  </ActionForm>
                </Tab>
              </Tabs>
            </AddSheet>
          </span>
        }
      />
      <Tabs label={t("tabs.sections")}>
        <Tab id="week" label={t("time.entries")}>
          <WeekPanel data={data} />
        </Tab>
        <Tab id="tasks" label={t("time.tasks")}>
          <TasksPanel data={data} areaName={areaName} />
        </Tab>
      </Tabs>
    </>
  );
}

function WeekPanel({ data }: { data: Week }) {
  const { t, tx, label } = useI18n();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [person, setPerson] = useState("");
  const [project, setProject] = useState("");
  const [taskType, setTaskType] = useState<TaskType | "">("");
  const [billable, setBillable] = useState<"" | "yes" | "no">("");
  const [sort, setSort] = useState<TimeEntrySort>(DEFAULT_TIME_ENTRY_SORT);
  const personFilter = person === "" ? null : person === "none" ? "none" : Number(person);
  const projectFilter = project === "" ? null : project === "none" ? "none" : Number(project);
  const filtered = useMemo(
    () => filterTimeEntries(data.entries, { query: search, person: personFilter, project: projectFilter, taskType, billable }),
    [billable, data.entries, personFilter, projectFilter, search, taskType],
  );
  const sorted = useMemo(() => sortTimeEntries(filtered, sort), [filtered, sort]);
  const shownMinutes = useMemo(() => filtered.reduce((sum, entry) => sum + entry.minutes, 0), [filtered]);
  const active = Boolean(search.trim() || person || project || taskType || billable);

  function reset() {
    setSearch("");
    setPerson("");
    setProject("");
    setTaskType("");
    setBillable("");
  }

  function applyRange(from: string, to: string) {
    router.push(`/time?from=${from}&to=${to}#week`);
  }

  function sortLabel(value: TimeEntrySort): string {
    switch (value) {
      case "dateDesc":
        return t("time.sortDateDesc");
      case "durationDesc":
        return t("time.sortDurationDesc");
      case "durationAsc":
        return t("time.sortDurationAsc");
      case "person":
        return t("time.sortPerson");
      case "project":
        return t("time.sortProject");
      default:
        return t("time.sortDateAsc");
    }
  }

  return (
    <>
      <Card className="mb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg">{t("time.rangeTitle")}</h2>
          <p className="font-mono text-sm">{formatDate(data.start)} – {formatDate(data.end)}</p>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-muted">{t("time.rangeHint")}</p>
        <DateRangeCalendar from={data.start} to={data.end} today={data.today} onSelect={applyRange} />
      </Card>
      {data.entries.length === 0 ? (
        <Empty>{t("time.empty")}</Empty>
      ) : (
        <>
          <Card className="mb-3">
            <div role="group" aria-label={t("time.filterLabel")} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="md:col-span-2 xl:col-span-3">
                <Field label={t("time.filterSearch")}>
                  <TextInput
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("time.filterSearchPlaceholder")}
                  />
                </Field>
              </div>
              <Field label={t("time.person")}>
                <SelectInput value={person} onChange={(event) => setPerson(event.target.value)}>
                  <option value="">{t("time.filterAll")}</option>
                  <option value="none">{t("time.filterNoPerson")}</option>
                  {data.people.map((item) => (
                    <option key={item.id} value={String(item.id)}>{item.firstName} {item.lastName}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label={t("time.project")}>
                <SelectInput value={project} onChange={(event) => setProject(event.target.value)}>
                  <option value="">{t("time.filterAll")}</option>
                  <option value="none">{t("time.projectNone")}</option>
                  {data.projects.map((item) => (
                    <option key={item.id} value={String(item.id)}>{item.name}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label={t("time.taskType")}>
                <SelectInput value={taskType} onChange={(event) => setTaskType(event.target.value as TaskType | "")}>
                  <option value="">{t("time.filterAll")}</option>
                  {TASK_TYPES.map((type) => (
                    <option key={type} value={type}>{label(type)}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label={t("time.filterBillable")}>
                <SelectInput value={billable} onChange={(event) => setBillable(event.target.value as "" | "yes" | "no")}>
                  <option value="">{t("time.filterAll")}</option>
                  <option value="yes">{t("time.filterBillableYes")}</option>
                  <option value="no">{t("time.filterBillableNo")}</option>
                </SelectInput>
              </Field>
              <Field label={t("time.sortBy")}>
                <SelectInput value={sort} onChange={(event) => setSort(event.target.value as TimeEntrySort)}>
                  {TIME_ENTRY_SORTS.map((value) => (
                    <option key={value} value={value}>{sortLabel(value)}</option>
                  ))}
                </SelectInput>
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted" aria-live="polite">
                {t("time.filterResult", { shown: filtered.length, total: data.entries.length })}
                {active ? ` · ${t("time.filterTotal", { duration: formatDuration(shownMinutes) })}` : ""}
              </p>
              {active ? (
                <button type="button" onClick={reset} className="text-sm font-medium text-pine underline-offset-4 hover:underline">
                  {t("time.filterReset")}
                </button>
              ) : null}
            </div>
          </Card>
          {sorted.length === 0 ? (
            <Empty>{t("time.filterEmpty")}</Empty>
          ) : (
            <div className="grid gap-2">
              {sorted.map((entry) => (
                <Card key={entry.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {t("time.span", { date: formatDate(entry.entryDate), start: entry.startedAt, end: entry.endedAt, minutes: entry.breakMinutes })}
                      </p>
                      <p className="text-sm text-muted">
                        {entry.memo || t("time.noMemo")}
                        {entry.firstName ? ` · ${entry.firstName}` : ""}
                        {entry.projectId ? ` · ${entry.projectName}` : ""}
                        {entry.taskType !== "other" ? ` · ${label(entry.taskType)}` : ""}
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
        </>
      )}
    </>
  );
}

function TasksPanel({ data, areaName }: { data: Week; areaName: (code: string) => string }) {
  const { t, label } = useI18n();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [project, setProject] = useState("");
  const [area, setArea] = useState("");
  const [taskType, setTaskType] = useState<TaskType | "">("");
  const [sort, setSort] = useState<TaskSort>(DEFAULT_TASK_SORT);
  const projectFilter = project === "" ? null : project === "none" ? "none" : Number(project);
  const filtered = useMemo(
    () => filterTasks(data.tasks, { query: search, status, project: projectFilter, area, taskType }),
    [area, data.tasks, projectFilter, search, status, taskType],
  );
  const sorted = useMemo(() => sortTasks(filtered, sort), [filtered, sort]);
  const active = Boolean(search.trim() || status || project || area || taskType);

  function reset() {
    setSearch("");
    setStatus("");
    setProject("");
    setArea("");
    setTaskType("");
  }

  function sortLabel(value: TaskSort): string {
    switch (value) {
      case "dueAsc":
        return t("time.taskSortDueAsc");
      case "dueDesc":
        return t("time.taskSortDueDesc");
      case "title":
        return t("time.taskSortTitle");
      case "project":
        return t("time.taskSortProject");
      default:
        return t("time.taskSortStatus");
    }
  }

  if (data.tasks.length === 0) return <Empty>{t("time.emptyTasks")}</Empty>;

  return (
    <>
      <Card className="mb-3">
        <div role="group" aria-label={t("time.taskFilterLabel")} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="md:col-span-2 xl:col-span-3">
            <Field label={t("time.filterSearch")}>
              <TextInput
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("time.taskFilterSearchPlaceholder")}
              />
            </Field>
          </div>
          <Field label={t("common.status")}>
            <SelectInput value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">{t("time.filterAll")}</option>
              <option value="open">{label("open")}</option>
              <option value="doing">{label("doing")}</option>
              <option value="done">{label("done")}</option>
            </SelectInput>
          </Field>
          <Field label={t("time.project")}>
            <SelectInput value={project} onChange={(event) => setProject(event.target.value)}>
              <option value="">{t("time.filterAll")}</option>
              <option value="none">{t("time.projectNone")}</option>
              {data.projects.map((item) => (
                <option key={item.id} value={String(item.id)}>{item.name}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label={t("time.area")}>
            <SelectInput value={area} onChange={(event) => setArea(event.target.value)}>
              <option value="">{t("time.filterAll")}</option>
              {areas.map((value) => (
                <option key={value} value={value}>{areaName(value)}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label={t("time.taskType")}>
            <SelectInput value={taskType} onChange={(event) => setTaskType(event.target.value as TaskType | "")}>
              <option value="">{t("time.filterAll")}</option>
              {TASK_TYPES.map((type) => (
                <option key={type} value={type}>{label(type)}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label={t("time.sortBy")}>
            <SelectInput value={sort} onChange={(event) => setSort(event.target.value as TaskSort)}>
              {TASK_SORTS.map((value) => (
                <option key={value} value={value}>{sortLabel(value)}</option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted" aria-live="polite">
            {t("time.taskFilterResult", { shown: filtered.length, total: data.tasks.length })}
          </p>
          {active ? (
            <button type="button" onClick={reset} className="text-sm font-medium text-pine underline-offset-4 hover:underline">
              {t("time.filterReset")}
            </button>
          ) : null}
        </div>
      </Card>
      {sorted.length === 0 ? (
        <Empty>{t("time.taskFilterEmpty")}</Empty>
      ) : (
        <div className="grid gap-2">
          {sorted.map((task) => (
            <Card key={task.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="text-sm font-medium">{task.title}</span>
                {task.dueDate ? <span className="mt-1 block text-xs text-muted">{t("time.taskDue", { date: formatDate(task.dueDate), area: areaName(task.area) })}</span> : null}
                <span className="mt-1 block text-xs text-muted">
                  {task.projectId ? task.projectName : t("time.projectNone")} · {label(task.taskType)}
                  {task.deliverable ? ` · ${t("time.deliverable")}` : ""}
                </span>
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
      )}
    </>
  );
}