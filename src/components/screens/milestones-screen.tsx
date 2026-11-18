"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { milestonesView } from "@/server/views";
import { deleteMilestone, saveMilestone } from "@/server/actions";
import { formatDate } from "@/domain/calendar";
import {
  MILESTONE_CATEGORIES,
  MILESTONE_STATUSES,
  filterMilestones,
  groupMilestonesByQuarter,
  type MilestoneCategory,
  type MilestoneStatus,
} from "@/domain/milestones";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { StatusBar } from "@/components/charts";
import { useI18n } from "@/components/locale-provider";
import { Tabs, Tab } from "@/components/tabs";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Empty, Field, PageHeader, Pill, SelectInput, Stat, TextArea, TextInput } from "@/components/ui";

type Milestones = ReturnType<typeof milestonesView>;
type Milestone = Milestones["milestones"][number];

function ProgressBar({ value, tone = "bg-pine" }: { value: number; tone?: string }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-line/60" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <span className={`block h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function milestoneTone(status: string): string {
  switch (status) {
    case "achieved":
      return "bg-moss";
    case "missed":
      return "bg-clay";
    case "active":
      return "bg-pine";
    default:
      return "bg-amber";
  }
}

function CompanyChoices({ milestone, companies }: { milestone?: Milestone; companies: Milestones["companies"] }) {
  const { t } = useI18n();
  return (
    <fieldset className="grid gap-1 sm:col-span-2">
      <legend className="text-sm font-medium">{t("milestones.companies")}</legend>
      <p className="text-xs leading-relaxed text-muted">{t("milestones.companiesHint")}</p>
      {companies.length === 0 ? null : (
        <div className="mt-1 grid gap-1 sm:grid-cols-2">
          {companies.map((company) => (
            <label key={company.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-white px-3 text-sm">
              <input
                type="checkbox"
                name="companyIds"
                value={company.id}
                defaultChecked={milestone?.companyIds.includes(company.id) ?? false}
                className="size-5 shrink-0 accent-pine"
              />
              <span className="min-w-0">{company.name}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function MilestoneFields({
  milestone,
  companies,
  defaultTargetDate,
}: {
  milestone?: Milestone;
  companies: Milestones["companies"];
  defaultTargetDate: string;
}) {
  const { t, label } = useI18n();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("common.title")}>
        <TextInput name="title" defaultValue={milestone?.title} required />
      </Field>
      <Field label={t("milestones.category")}>
        <SelectInput name="category" defaultValue={milestone?.category ?? "other"}>
          {MILESTONE_CATEGORIES.map((category) => (
            <option key={category} value={category}>{label(category)}</option>
          ))}
        </SelectInput>
      </Field>
      <Field label={t("common.status")}>
        <SelectInput name="status" defaultValue={milestone?.status ?? "planned"}>
          {MILESTONE_STATUSES.map((status) => (
            <option key={status} value={status}>{label(status)}</option>
          ))}
        </SelectInput>
      </Field>
      <Field label={t("milestones.targetDate")}>
        <TextInput name="targetDate" type="date" defaultValue={milestone?.targetDate ?? defaultTargetDate} required />
      </Field>
      <Field label={t("milestones.progress")} hint={t("milestones.progressHint")}>
        <TextInput name="progress" type="number" min={0} max={100} step={1} defaultValue={milestone?.progress ?? 0} />
      </Field>
      <Field label={t("milestones.description")}>
        <TextArea name="description" defaultValue={milestone?.description} />
      </Field>
      <CompanyChoices milestone={milestone} companies={companies} />
    </div>
  );
}

function MilestoneCard({ milestone, companies }: { milestone: Milestone; companies: Milestones["companies"] }) {
  const { t, label } = useI18n();
  const [editing, setEditing] = useState(false);
  return (
    <Card className="content-start">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{milestone.title}</p>
          <p className="text-sm text-muted">
            {label(milestone.category)} · {formatDate(milestone.targetDate)}
          </p>
        </div>
        <span className="flex flex-wrap gap-1">
          <Pill tone={milestone.status}>{label(milestone.status)}</Pill>
          {milestone.overdue ? <Pill tone="overdue">{t("common.overdue")}</Pill> : null}
        </span>
      </div>
      {milestone.description ? <p className="mt-2 text-sm leading-relaxed text-muted">{milestone.description}</p> : null}
      <div className="mt-3 grid gap-1">
        <div className="flex items-baseline justify-between gap-2 text-xs text-muted">
          <span>{t("milestones.progress")}</span>
          <span className="font-mono text-sm text-ink tabular-nums">{milestone.effectiveProgress} %</span>
        </div>
        <ProgressBar value={milestone.effectiveProgress} tone={milestoneTone(milestone.status)} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {milestone.companyNames.length === 0 ? (
          <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs text-muted">{t("milestones.allCompanies")}</span>
        ) : (
          milestone.companyNames.map((company) => (
            <span key={company.id} className="rounded-full bg-pine/10 px-2 py-0.5 text-xs text-pine">{company.name}</span>
          ))
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" onClick={() => setEditing((open) => !open)}>
          {editing ? t("common.close") : t("common.edit")}
        </button>
        <ActionForm action={deleteMilestone} compact confirm={t("milestones.remove")}>
          <input type="hidden" name="id" value={milestone.id} />
          <SubmitButton tone="danger">{t("common.remove")}</SubmitButton>
        </ActionForm>
      </div>
      {editing ? (
        <ActionForm action={saveMilestone} className="mt-3 grid gap-3">
          <input type="hidden" name="id" value={milestone.id} />
          <MilestoneFields milestone={milestone} companies={companies} defaultTargetDate={milestone.targetDate} />
          <SubmitButton tone="quiet">{t("milestones.save")}</SubmitButton>
        </ActionForm>
      ) : null}
    </Card>
  );
}

function GoalsPanel({ data }: { data: Milestones }) {
  const { t, label } = useI18n();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<MilestoneStatus | "">("");
  const [category, setCategory] = useState<MilestoneCategory | "">("");
  const [company, setCompany] = useState("");
  const companyFilter = company === "" ? null : company === "none" ? "none" : Number(company);
  const filtered = useMemo(
    () => filterMilestones(data.milestones, { query: search, status, category, company: companyFilter }),
    [category, companyFilter, data.milestones, search, status],
  );
  const groups = useMemo(() => groupMilestonesByQuarter(filtered), [filtered]);
  const active = Boolean(search.trim() || status || category || company);

  function reset() {
    setSearch("");
    setStatus("");
    setCategory("");
    setCompany("");
  }

  return (
    <div className="grid gap-5">
      {data.milestones.length === 0 ? <Empty>{t("milestones.empty")}</Empty> : null}
      {data.milestones.length > 0 ? (
        <Card>
          <div role="group" aria-label={t("milestones.filterLabel")} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="md:col-span-2 xl:col-span-4">
              <Field label={t("milestones.filterSearch")}>
                <TextInput
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("milestones.filterSearchPlaceholder")}
                />
              </Field>
            </div>
            <Field label={t("milestones.filterStatus")}>
              <SelectInput value={status} onChange={(event) => setStatus(event.target.value as MilestoneStatus | "")}>
                <option value="">{t("milestones.filterAll")}</option>
                {MILESTONE_STATUSES.map((value) => (
                  <option key={value} value={value}>{label(value)}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t("milestones.filterCategory")}>
              <SelectInput value={category} onChange={(event) => setCategory(event.target.value as MilestoneCategory | "")}>
                <option value="">{t("milestones.filterAll")}</option>
                {MILESTONE_CATEGORIES.map((value) => (
                  <option key={value} value={value}>{label(value)}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t("milestones.filterCompany")}>
              <SelectInput value={company} onChange={(event) => setCompany(event.target.value)}>
                <option value="">{t("milestones.filterAll")}</option>
                <option value="none">{t("milestones.allCompanies")}</option>
                {data.companies.map((item) => (
                  <option key={item.id} value={String(item.id)}>{item.name}</option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted" aria-live="polite">
              {t("milestones.filterResult", { shown: filtered.length, total: data.milestones.length })}
            </p>
            {active ? (
              <button type="button" onClick={reset} className="text-sm font-medium text-pine underline-offset-4 hover:underline">
                {t("milestones.filterReset")}
              </button>
            ) : null}
          </div>
        </Card>
      ) : null}
      {data.milestones.length > 0 && filtered.length === 0 ? <Empty>{t("milestones.filterEmpty")}</Empty> : null}
      {groups.map((group) => (
        <section key={group.key}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg">{t("milestones.quarterGroup", { quarter: group.quarter, year: group.year })}</h2>
            <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs text-muted">{group.milestones.length}</span>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {group.milestones.map((milestone) => (
              <MilestoneCard key={milestone.id} milestone={milestone} companies={data.companies} />
            ))}
          </div>
        </section>
      ))}
      <Card>
        <h2 className="mb-3 text-2xl">{t("milestones.new")}</h2>
        <ActionForm action={saveMilestone} resetOnSuccess>
          <MilestoneFields companies={data.companies} defaultTargetDate={`${data.year}-12-31`} />
          <SubmitButton>{t("milestones.add")}</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}

function AnalysisPanel({ data }: { data: Milestones }) {
  const { t, label } = useI18n();
  const analysis = data.analysis;
  if (analysis.total === 0) return <Empty>{t("milestones.analysisEmpty")}</Empty>;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section>
        <h2 className="mb-3 text-2xl">{t("milestones.statusAnalysis")}</h2>
        <Card>
          <StatusBar
            total={analysis.total}
            parts={[
              { key: "planned", label: label("planned"), value: analysis.byStatus.planned, tone: "muted" },
              { key: "active", label: label("active"), value: analysis.byStatus.active, tone: "pine" },
              { key: "achieved", label: label("achieved"), value: analysis.byStatus.achieved, tone: "moss" },
              { key: "missed", label: label("missed"), value: analysis.byStatus.missed, tone: "amber" },
            ]}
          />
          <p className="mt-3 text-sm text-muted">
            {t("milestones.achievedOf", { achieved: analysis.achieved, total: analysis.total })} · {analysis.achievementRate} %
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{t("milestones.statusHint")}</p>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-2xl">{t("milestones.quarterAnalysis")}</h2>
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            {analysis.quarters.map((quarter) => (
              <div key={quarter.quarter} className="rounded-xl border border-line p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium">Q{quarter.quarter}</p>
                  <p className="font-mono text-sm tabular-nums">{quarter.achieved}/{quarter.total}</p>
                </div>
                <div className="mt-2"><ProgressBar value={quarter.averageProgress} /></div>
                <p className="mt-1 flex flex-wrap justify-between gap-1 text-xs text-muted">
                  <span>{quarter.averageProgress} %</span>
                  {quarter.overdue > 0 ? <span className="text-clay">{t("milestones.overdueCount", { count: quarter.overdue })}</span> : null}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-2xl">{t("milestones.categoryAnalysis")}</h2>
        <Card>
          {analysis.categories.length === 0 ? <p className="text-sm text-muted">{t("milestones.noCategories")}</p> : (
            <div className="grid gap-3">
              {analysis.categories.map((row) => (
                <div key={row.category} className="grid gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{label(row.category)}</span>
                    <span className="font-mono text-muted tabular-nums">{row.averageProgress} % · {row.achieved}/{row.total}</span>
                  </div>
                  <ProgressBar value={row.averageProgress} />
                  {row.overdue > 0 ? <p className="text-xs text-clay">{t("milestones.overdueCount", { count: row.overdue })}</p> : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-2xl">{t("milestones.companyAnalysis")}</h2>
        <Card>
          <div className="grid gap-3">
            {data.companyRows.map((row) => (
              <div key={row.id ?? "none"} className="grid gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{row.id === null ? t("milestones.allCompanies") : row.name}</span>
                  <span className="font-mono text-muted tabular-nums">
                    {row.total === 0 ? t("milestones.companyNoGoals") : `${row.averageProgress} % · ${row.achieved}/${row.total}`}
                  </span>
                </div>
                <ProgressBar value={row.averageProgress} />
                {row.overdue > 0 ? <p className="text-xs text-clay">{t("milestones.overdueCount", { count: row.overdue })}</p> : null}
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function MilestonesBody({ data }: { data: Milestones }) {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        title={t("milestones.title")}
        lede={t("milestones.lede")}
        action={
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("milestones.year")}>
            {data.years.map((year) => (
              <Link
                key={year}
                href={`/milestones?year=${year}`}
                className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm ${year === data.year ? "bg-pine text-paper" : "border border-line bg-card text-ink"}`}
                aria-current={year === data.year ? "page" : undefined}
              >
                {year}
              </Link>
            ))}
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={t("milestones.total")} value={String(data.analysis.total)} hint={t("milestones.yearHint")} />
        <Stat label={t("milestones.open")} value={String(data.analysis.open)} />
        <Stat label={t("milestones.achievedStat")} value={String(data.analysis.achieved)} />
        <Stat label={t("milestones.overdue")} value={String(data.analysis.overdue)} />
        <Stat label={t("milestones.averageProgress")} value={`${data.analysis.averageProgress} %`} />
      </div>
      <div className="mt-6">
        <Tabs label={t("milestones.tabs")}>
          <Tab id="goals" label={t("milestones.goals")}>
            <GoalsPanel data={data} />
          </Tab>
          <Tab id="analysis" label={t("milestones.analysis")}>
            <AnalysisPanel data={data} />
          </Tab>
        </Tabs>
      </div>
    </>
  );
}

export function MilestonesScreen({ year }: { year: number }) {
  const query = useView<Milestones>(queryKeys.milestones(year), viewPath.milestones(year));
  return (
    <ViewGate query={query}>
      {(data) => <MilestonesBody data={data} />}
    </ViewGate>
  );
}