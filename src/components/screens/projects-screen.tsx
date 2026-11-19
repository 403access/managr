"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { deleteProject, saveProject } from "@/server/actions";
import type { projectsView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { filterProjects, groupProjects, sortProjects, DEFAULT_PROJECT_GROUPING, DEFAULT_PROJECT_SORT, PROJECT_GROUPINGS, PROJECT_SORTS, PROJECT_STATUSES, type ProjectGrouping, type ProjectSort, type ProjectStatus } from "@/domain/projects";
import { queryKeys, viewPath } from "@/client/query-keys";
import { formatDuration } from "@/components/amounts";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AddSheet } from "@/components/add-sheet";
import { InfoButton } from "@/components/info-sheet";
import { useI18n } from "@/components/locale-provider";
import { useDetailSidebarMode } from "@/components/settings-provider";
import { SidePanel } from "@/components/side-panel";
import { useView, ViewGate } from "@/components/use-view";
import { useWideLayout } from "@/components/use-wide-layout";
import { buttonClass, Card, Empty, Field, PageHeader, Pill, SelectInput, TextArea, TextInput } from "@/components/ui";

type Projects = ReturnType<typeof projectsView>;
type Project = Projects["projects"][number];

function ProjectFields({ project, customers, today }: { project?: Project; customers: Projects["customers"]; today: string }) {
  const { t, label } = useI18n();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("projects.name")}><TextInput name="name" defaultValue={project?.name} required /></Field>
      <Field label={t("projects.customer")}>
        <SelectInput name="customerId" defaultValue={project?.customerId ?? ""}>
          <option value="">{t("projects.noCustomer")}</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>{customer.name}</option>
          ))}
        </SelectInput>
      </Field>
      <Field label={t("common.status")}>
        <SelectInput name="status" defaultValue={project?.status ?? "active"}>
          <option value="active">{label("active")}</option>
          <option value="done">{label("done")}</option>
          <option value="paused">{label("paused")}</option>
        </SelectInput>
      </Field>
      <Field label={t("projects.start")}><TextInput name="startedOn" type="date" defaultValue={project?.startedOn ?? today} required /></Field>
      <Field label={t("projects.end")} hint={t("projects.endHint")}><TextInput name="endedOn" type="date" defaultValue={project?.endedOn ?? ""} /></Field>
      <Field label={t("common.notes")}><TextArea name="notes" defaultValue={project?.notes} /></Field>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs font-medium tracking-wide text-muted uppercase sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function ProjectCard({ project, selected, onOpen }: { project: Project; selected: boolean; onOpen: (id: number) => void }) {
  const { t, label } = useI18n();
  return (
    <Card
      id={`project-${project.id}`}
      className={`content-start scroll-mt-6 transition ${selected ? "border-pine/60 bg-pine/5" : "hover:border-ink/30"}`}
    >
      <button
        type="button"
        onClick={() => onOpen(project.id)}
        className="block w-full cursor-pointer rounded-lg text-left focus-visible:ring-2 focus-visible:ring-pine"
      >
        <span className="flex flex-wrap items-start justify-between gap-2">
          <span className="block">
            <span className="block font-medium">{project.name}</span>
            <span className="block text-sm text-muted">
              {project.customerId === null ? t("projects.noCustomer") : project.customerName}
              {" · "}{formatDate(project.startedOn)}
              {project.endedOn ? ` – ${formatDate(project.endedOn)}` : ""}
            </span>
          </span>
          <Pill tone={project.status}>{label(project.status)}</Pill>
        </span>
        <span className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <span className="block">
            <span className="block text-xs text-muted">{t("projects.booked")}</span>
            <span className="block font-mono">{formatDuration(project.minutes)}</span>
          </span>
          <span className="block">
            <span className="block text-xs text-muted">{t("projects.tasks")}</span>
            <span className="block font-mono">{project.openTasks}/{project.taskCount}</span>
          </span>
          <span className="block">
            <span className="block text-xs text-muted">{t("projects.deliverables")}</span>
            <span className="block font-mono">{project.deliverables}</span>
          </span>
        </span>
        {project.openDeliverables > 0 ? (
          <span className="mt-1 block text-xs text-muted">{t("projects.openDeliverables", { count: project.openDeliverables })}</span>
        ) : null}
      </button>
    </Card>
  );
}

function ProjectDetailPanel({
  project,
  customers,
  today,
  variant,
  onClose,
}: {
  project: Project;
  customers: Projects["customers"];
  today: string;
  variant: "inline" | "overlay";
  onClose: () => void;
}) {
  const { t, label } = useI18n();
  const [editing, setEditing] = useState(false);
  return (
    <SidePanel
      variant={variant}
      title={project.name}
      subtitle={project.customerId === null ? t("projects.noCustomer") : project.customerName ?? ""}
      onClose={onClose}
    >
      <dl className="grid gap-3 text-sm">
        <DetailRow label={t("common.status")}>
          <Pill tone={project.status}>{label(project.status)}</Pill>
        </DetailRow>
        <DetailRow label={t("projects.customer")}>
          {project.customerId === null ? (
            t("projects.noCustomer")
          ) : (
            <Link href={`/customers#customer-${project.customerId}`} className="text-pine underline-offset-4 hover:underline">
              {project.customerName}
            </Link>
          )}
        </DetailRow>
        <DetailRow label={t("projects.start")}>{formatDate(project.startedOn)}</DetailRow>
        <DetailRow label={t("projects.end")}>{project.endedOn ? formatDate(project.endedOn) : "—"}</DetailRow>
        <DetailRow label={t("projects.booked")}>
          <span className="font-mono tabular-nums">{formatDuration(project.minutes)}</span>
        </DetailRow>
        <DetailRow label={t("projects.tasks")}>
          <span className="font-mono tabular-nums">{project.openTasks}/{project.taskCount}</span>
        </DetailRow>
        <DetailRow label={t("projects.deliverables")}>
          <span className="font-mono tabular-nums">{project.deliverables}</span>
          {project.openDeliverables > 0 ? (
            <span className="ml-2 text-xs text-muted">{t("projects.openDeliverables", { count: project.openDeliverables })}</span>
          ) : null}
        </DetailRow>
        <DetailRow label={t("common.notes")}>{project.notes || "—"}</DetailRow>
      </dl>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass("quiet")} onClick={() => setEditing((open) => !open)}>
          {editing ? t("common.close") : t("common.edit")}
        </button>
        {project.customerId !== null ? (
          <Link href={`/analytics/report?customer=${project.customerId}`} className={buttonClass("quiet")}>
            {t("projects.report")}
          </Link>
        ) : null}
      </div>
      {editing ? (
        <ActionForm action={saveProject} className="mt-4 grid gap-3">
          <input type="hidden" name="id" value={project.id} />
          <ProjectFields project={project} customers={customers} today={today} />
          <SubmitButton tone="quiet">{t("projects.save")}</SubmitButton>
        </ActionForm>
      ) : null}
      <div className="mt-6 border-t border-line pt-4">
        <ActionForm action={deleteProject} confirm={t("projects.remove")}>
          <input type="hidden" name="id" value={project.id} />
          <SubmitButton tone="danger">{t("common.remove")}</SubmitButton>
        </ActionForm>
      </div>
    </SidePanel>
  );
}

function ProjectGrid({
  projects,
  selectedId,
  onOpen,
}: {
  projects: Project[];
  selectedId: number | null;
  onOpen: (id: number) => void;
}) {
  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} selected={selectedId === project.id} onOpen={onOpen} />
      ))}
    </div>
  );
}

function ProjectsBody({ data }: { data: Projects }) {
  const { t, label, monthName } = useI18n();
  const mode = useDetailSidebarMode("projects");
  const wide = useWideLayout();
  const inline = mode === "inline" && wide;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [customer, setCustomer] = useState("");
  const [grouping, setGrouping] = useState<ProjectGrouping>(DEFAULT_PROJECT_GROUPING);
  const [sort, setSort] = useState<ProjectSort>(DEFAULT_PROJECT_SORT);
  const customerFilter = customer === "" ? null : customer === "none" ? "none" : Number(customer);
  const customers = useMemo(() => {
    const seen = new Map<number, string>();
    for (const project of data.projects) {
      if (project.customerId !== null && project.customerName) seen.set(project.customerId, project.customerName);
    }
    return [...seen.entries()].sort(([, left], [, right]) => left.localeCompare(right));
  }, [data.projects]);
  const filtered = useMemo(
    () => filterProjects(data.projects, { query: search, status, customer: customerFilter }),
    [customerFilter, data.projects, search, status],
  );
  const sorted = useMemo(() => sortProjects(filtered, sort), [filtered, sort]);
  const groups = useMemo(
    () => (grouping === "none" ? [] : groupProjects(sorted, grouping)),
    [grouping, sorted],
  );
  const active = Boolean(search.trim() || status || customer);
  const selected = selectedId === null ? null : data.projects.find((project) => project.id === selectedId) ?? null;

  useEffect(() => {
    const match = /^#project-(\d+)$/.exec(window.location.hash);
    if (!match) return;
    const id = Number(match[1]);
    if (data.projects.some((project) => project.id === id)) setSelectedId(id);
  }, [data.projects]);

  useEffect(() => {
    if (selectedId === null || data.projects.some((project) => project.id === selectedId)) return;
    setSelectedId(null);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, [data.projects, selectedId]);

  const closeProject = useCallback(() => {
    setSelectedId(null);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  function openProject(id: number) {
    setSelectedId(id);
    window.history.replaceState(null, "", `#project-${id}`);
  }

  function reset() {
    setSearch("");
    setStatus("");
    setCustomer("");
  }

  function groupHeading(group: (typeof groups)[number]): string {
    if (group.kind === "customer") {
      return group.customerId === null ? t("projects.noCustomer") : group.name ?? "";
    }
    return group.month === null
      ? t("projects.groupNoDeadline")
      : `${monthName(Number(group.month.slice(5, 7)))} ${group.month.slice(0, 4)}`;
  }

  function sortLabel(value: ProjectSort): string {
    switch (value) {
      case "startedDesc":
        return t("projects.sortStartedDesc");
      case "startedAsc":
        return t("projects.sortStartedAsc");
      case "deadlineAsc":
        return t("projects.sortDeadline");
      case "minutesDesc":
        return t("projects.sortMinutes");
      default:
        return t("projects.sortName");
    }
  }

  const content = (
    <>
      <PageHeader
        title={t("projects.title")}
        lede={t("projects.lede")}
        info={<InfoButton topic="projects" />}
        action={
          <span className="flex items-center gap-2">
            <Link href="/analytics" className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm">{t("projects.analytics")}</Link>
            <AddSheet label={t("projects.add")} title={t("projects.new")}>
              <ActionForm action={saveProject} resetOnSuccess>
                <ProjectFields customers={data.customers} today={data.today} />
                <SubmitButton>{t("projects.add")}</SubmitButton>
              </ActionForm>
            </AddSheet>
          </span>
        }
      />
      {data.projects.length === 0 ? <Empty>{t("projects.empty")}</Empty> : null}
      {data.projects.length > 0 ? (
        <Card className="mb-3">
          <div role="group" aria-label={t("projects.filterLabel")} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="md:col-span-2 xl:col-span-4">
              <Field label={t("projects.filterSearch")}>
                <TextInput
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("projects.filterSearchPlaceholder")}
                />
              </Field>
            </div>
            <Field label={t("projects.filterStatus")}>
              <SelectInput value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus | "")}>
                <option value="">{t("projects.filterAll")}</option>
                {PROJECT_STATUSES.map((value) => (
                  <option key={value} value={value}>{label(value)}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t("projects.filterCustomer")}>
              <SelectInput value={customer} onChange={(event) => setCustomer(event.target.value)}>
                <option value="">{t("projects.filterAll")}</option>
                <option value="none">{t("projects.noCustomer")}</option>
                {customers.map(([id, name]) => (
                  <option key={id} value={String(id)}>{name}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t("projects.groupBy")}>
              <SelectInput value={grouping} onChange={(event) => setGrouping(event.target.value as ProjectGrouping)}>
                {PROJECT_GROUPINGS.map((value) => (
                  <option key={value} value={value}>
                    {value === "customer" ? t("projects.groupCustomer") : value === "deadline" ? t("projects.groupDeadline") : t("projects.groupNone")}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t("projects.sortBy")}>
              <SelectInput value={sort} onChange={(event) => setSort(event.target.value as ProjectSort)}>
                {PROJECT_SORTS.map((value) => (
                  <option key={value} value={value}>{sortLabel(value)}</option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted" aria-live="polite">
              {t("projects.filterResult", { shown: filtered.length, total: data.projects.length })}
            </p>
            {active ? (
              <button type="button" onClick={reset} className="text-sm font-medium text-pine underline-offset-4 hover:underline">
                {t("projects.filterReset")}
              </button>
            ) : null}
          </div>
        </Card>
      ) : null}
      {data.projects.length > 0 && filtered.length === 0 ? <Empty>{t("projects.filterEmpty")}</Empty> : null}
      {filtered.length > 0 && grouping === "none" ? (
        <ProjectGrid projects={sorted} selectedId={selectedId} onOpen={openProject} />
      ) : null}
      {filtered.length > 0 && grouping !== "none" ? (
        <div className="grid gap-5">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg">{groupHeading(group)}</h2>
                <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs text-muted">{group.projects.length}</span>
              </div>
              <ProjectGrid projects={group.projects} selectedId={selectedId} onOpen={openProject} />
            </section>
          ))}
        </div>
      ) : null}
    </>
  );

  if (inline && selected) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">{content}</div>
        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <ProjectDetailPanel
            key={selected.id}
            project={selected}
            customers={data.customers}
            today={data.today}
            variant="inline"
            onClose={closeProject}
          />
        </aside>
      </div>
    );
  }

  return (
    <>
      {content}
      {selected ? (
        <ProjectDetailPanel
          key={selected.id}
          project={selected}
          customers={data.customers}
          today={data.today}
          variant="overlay"
          onClose={closeProject}
        />
      ) : null}
    </>
  );
}

export function ProjectsScreen() {
  const query = useView<Projects>(queryKeys.projects, viewPath.projects);
  return (
    <ViewGate query={query}>
      {(data) => <ProjectsBody data={data} />}
    </ViewGate>
  );
}