"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteProject, saveProject } from "@/server/actions";
import type { projectsView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { queryKeys, viewPath } from "@/client/query-keys";
import { formatDuration } from "@/components/amounts";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Empty, Field, PageHeader, Pill, SelectInput, TextArea, TextInput } from "@/components/ui";

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

function ProjectCard({ project, customers, today }: { project: Project; customers: Projects["customers"]; today: string }) {
  const { t, label } = useI18n();
  const [editing, setEditing] = useState(false);
  return (
    <Card key={project.id} className="content-start">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{project.name}</p>
          <p className="text-sm text-muted">
            {project.customerId === null ? t("projects.noCustomer") : (
              <Link href={`/customers#customer-${project.customerId}`} className="text-pine">{project.customerName}</Link>
            )}
            {" · "}{formatDate(project.startedOn)}
            {project.endedOn ? ` – ${formatDate(project.endedOn)}` : ""}
          </p>
        </div>
        <Pill tone={project.status}>{label(project.status)}</Pill>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-xs text-muted">{t("projects.booked")}</dt><dd className="font-mono">{formatDuration(project.minutes)}</dd></div>
        <div><dt className="text-xs text-muted">{t("projects.tasks")}</dt><dd className="font-mono">{project.openTasks}/{project.taskCount}</dd></div>
        <div><dt className="text-xs text-muted">{t("projects.deliverables")}</dt><dd className="font-mono">{project.deliverables}</dd></div>
      </dl>
      {project.openDeliverables > 0 ? <p className="mt-1 text-xs text-muted">{t("projects.openDeliverables", { count: project.openDeliverables })}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" onClick={() => setEditing((open) => !open)}>
          {editing ? t("common.close") : t("common.edit")}
        </button>
        {project.customerId !== null ? (
          <Link href={`/analytics/report?customer=${project.customerId}`} className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm">
            {t("projects.report")}
          </Link>
        ) : null}
        <ActionForm action={deleteProject} compact confirm={t("projects.remove")}>
          <input type="hidden" name="id" value={project.id} />
          <SubmitButton tone="danger">{t("common.remove")}</SubmitButton>
        </ActionForm>
      </div>
      {editing ? (
        <ActionForm action={saveProject} className="mt-3 grid gap-3">
          <input type="hidden" name="id" value={project.id} />
          <ProjectFields project={project} customers={customers} today={today} />
          <SubmitButton tone="quiet">{t("projects.save")}</SubmitButton>
        </ActionForm>
      ) : null}
    </Card>
  );
}

export function ProjectsScreen() {
  const query = useView<Projects>(queryKeys.projects, viewPath.projects);
  const { t } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader
            title={t("projects.title")}
            lede={t("projects.lede")}
            action={<Link href="/analytics" className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm">{t("projects.analytics")}</Link>}
          />
          {data.projects.length === 0 ? <Empty>{t("projects.empty")}</Empty> : null}
          <div className="grid gap-3 xl:grid-cols-2">
            {data.projects.map((project) => (
              <ProjectCard key={project.id} project={project} customers={data.customers} today={data.today} />
            ))}
          </div>
          <Card className="mt-3">
            <h2 className="mb-3 text-2xl">{t("projects.new")}</h2>
            <ActionForm action={saveProject} resetOnSuccess>
              <ProjectFields customers={data.customers} today={data.today} />
              <SubmitButton>{t("projects.add")}</SubmitButton>
            </ActionForm>
          </Card>
        </>
      )}
    </ViewGate>
  );
}