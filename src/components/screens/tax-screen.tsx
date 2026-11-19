"use client";

import Link from "next/link";
import { prepareTaxFiling, saveElsterSettings } from "@/server/actions";
import type { taxView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AddSheet } from "@/components/add-sheet";
import { useI18n } from "@/components/locale-provider";
import { TaxCheckList } from "@/components/tax-checks";
import { useView, ViewGate } from "@/components/use-view";
import { Tab, Tabs } from "@/components/tabs";
import { Card, Check, Disclaimer, Empty, Field, PageHeader, Pill, SelectInput, Stat, TextInput } from "@/components/ui";

type Tax = ReturnType<typeof taxView>;

export function TaxScreen({ year }: { year: number }) {
  const query = useView<Tax>(queryKeys.tax(year), viewPath.tax(year));
  const { t, label, monthName } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => {
        const checks = data.filings.flatMap((filing) =>
          filing.checks.map((check) => ({ ...check, filingId: filing.id, filingLabel: `${label(filing.kind)} · ${filing.periodLabel}` })),
        );
        const submitted = data.filings.filter((filing) => filing.submitted || filing.submission);
        return (
          <>
            <PageHeader
              title={t("tax.title")}
              lede={t("tax.lede")}
              action={
                <span className="flex items-center gap-2">
                  <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href={`/tax?year=${data.year - 1}`}>
                    {data.year - 1}
                  </Link>
                  <Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href={`/tax?year=${data.year + 1}`}>
                    {data.year + 1}
                  </Link>
                  <AddSheet label={t("tax.add")} title={t("tax.add")}>
                    <ActionForm action={prepareTaxFiling}>
                      <Field label={t("tax.kind")}>
                        <SelectInput name="kind" defaultValue={data.kinds[0] ?? "kst"}>
                          {data.kinds.map((kind) => (
                            <option key={kind} value={kind}>{label(kind)}</option>
                          ))}
                        </SelectInput>
                      </Field>
                      <Field label={t("tax.year")}>
                        <TextInput name="year" type="number" min={2000} max={2100} defaultValue={data.year} />
                      </Field>
                      <Field label={t("tax.period")} hint={t("tax.periodHint")}>
                        <SelectInput name="periodKey" defaultValue={data.year === Number(data.today.slice(0, 4)) ? data.today.slice(0, 7) : `${data.year}-01`}>
                          <optgroup label={t("tax.monthly")}>
                            {data.periods.monthly.map((period) => (
                              <option key={period.key} value={period.key}>{monthName(period.month ?? 1)} {data.year}</option>
                            ))}
                          </optgroup>
                          <optgroup label={t("tax.quarterly")}>
                            {data.periods.quarterly.map((period) => (
                              <option key={period.key} value={period.key}>Q{period.quarter} {data.year}</option>
                            ))}
                          </optgroup>
                        </SelectInput>
                      </Field>
                      <p className="text-xs leading-relaxed text-muted">{t("tax.annualHint")}</p>
                      <SubmitButton>{t("tax.create")}</SubmitButton>
                    </ActionForm>
                  </AddSheet>
                </span>
              }
            />
            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              <Stat label={t("tax.block")} value={String(data.aggregate.block)} hint={t("tax.blockHint")} />
              <Stat label={t("tax.warn")} value={String(data.aggregate.warn)} hint={t("tax.warnHint")} />
              <Stat label={t("tax.submitted")} value={String(submitted.length)} hint={t("tax.submittedHint")} />
            </div>
            <Tabs label={t("tabs.sections")}>
              <Tab id="returns" label={t("tax.returns")}>
                {data.filings.length === 0 ? (
                  <Empty>{t("tax.empty")}</Empty>
                ) : (
                  <div className="grid gap-2">
                    {data.filings.map((filing) => (
                      <Card key={filing.id} className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link className="text-sm font-medium underline decoration-line underline-offset-4" href={`/tax/${filing.id}`}>
                            {label(filing.kind)} · {filing.periodLabel}
                          </Link>
                          <p className="mt-1 text-xs text-muted">
                            {filing.dueDate ? `${t("tax.due")} ${formatDate(filing.dueDate)}` : t("tax.noDue")}
                            {filing.replacesId ? ` · ${t("tax.correction")}` : ""}
                          </p>
                          {filing.checks.length === 0 ? (
                            <p className="mt-1 text-xs text-muted">{t("tax.noChecks")}</p>
                          ) : filing.summary.block > 0 || filing.summary.warn > 0 ? (
                            <p className="mt-1 text-xs text-muted">
                              {t("tax.checkCounts", { block: filing.summary.block, warn: filing.summary.warn, info: filing.summary.info })}
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-moss">{t("tax.readyToReview")}</p>
                          )}
                        </div>
                        <Pill tone={filing.status}>{label(filing.status)}</Pill>
                      </Card>
                    ))}
                  </div>
                )}
              </Tab>
              <Tab id="checks" label={t("tax.checks")}>
                {checks.length === 0 ? <Empty>{t("tax.noChecks")}</Empty> : (
                  <div className="grid gap-3">
                    {data.filings
                      .filter((filing) => filing.checks.length > 0)
                      .map((filing) => (
                        <Card key={filing.id}>
                          <Link className="text-sm font-medium underline decoration-line underline-offset-4" href={`/tax/${filing.id}`}>
                            {label(filing.kind)} · {filing.periodLabel}
                          </Link>
                          <div className="mt-2">
                            <TaxCheckList checks={filing.checks} compact />
                          </div>
                        </Card>
                      ))}
                  </div>
                )}
              </Tab>
              <Tab id="elster" label={t("tax.elster")}>
                <div className="grid gap-2">
                  <Card>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{t("tax.elsterTitle")}</p>
                      <Pill tone={data.elster.configured ? "ready" : "draft"}>
                        {data.elster.configured ? t("tax.elsterConfigured") : t("tax.elsterNotConfigured")}
                      </Pill>
                    </div>
                    <p className="mt-2 text-sm text-muted">{t("tax.elsterLede")}</p>
                    <dl className="mt-3 grid gap-1 text-sm">
                      <div className="flex justify-between gap-3"><dt className="text-muted">{t("tax.elsterEnvironment")}</dt><dd>{label(data.elster.environment)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted">{t("tax.elsterHerstellerId")}</dt><dd>{data.elster.herstellerId || t("tax.notSet")}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted">{t("tax.elsterCertificate")}</dt><dd>{data.elster.certificateName || t("tax.notSet")}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted">{t("tax.elsterPrivacy")}</dt><dd>{data.elster.privacyAcknowledged ? t("tax.yes") : t("tax.no")}</dd></div>
                    </dl>
                    <p className="mt-3 text-xs leading-relaxed text-muted">{t("tax.elsterPhase")}</p>
                  </Card>
                  <Card>
                    <p className="mb-3 text-sm font-medium">{t("tax.elsterSettings")}</p>
                    <ActionForm action={saveElsterSettings}>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label={t("tax.elsterEnvironment")}>
                          <SelectInput name="environment" defaultValue={data.elster.environment}>
                            <option value="test">{label("test")}</option>
                            <option value="production">{label("production")}</option>
                          </SelectInput>
                        </Field>
                        <Field label={t("tax.elsterHerstellerId")} hint={t("tax.elsterHerstellerHint")}>
                          <TextInput name="herstellerId" defaultValue={data.elster.herstellerId} inputMode="numeric" maxLength={5} />
                        </Field>
                      </div>
                      <Field label={t("tax.elsterSoftware")}>
                        <TextInput name="softwareName" defaultValue={data.elster.softwareName} maxLength={80} />
                      </Field>
                      <Check name="privacyAcknowledged" label={t("tax.elsterPrivacyHint")} defaultChecked={data.elster.privacyAcknowledged} />
                      <SubmitButton>{t("tax.saveSettings")}</SubmitButton>
                    </ActionForm>
                  </Card>
                  <Card>
                    <p className="text-sm font-medium">{t("tax.manualTitle")}</p>
                    <p className="mt-1 text-sm text-muted">{t("tax.manualHint")}</p>
                  </Card>
                </div>
              </Tab>
              <Tab id="archive" label={t("tax.archive")}>
                {submitted.length === 0 ? <Empty>{t("tax.archiveEmpty")}</Empty> : (
                  <div className="grid gap-2">
                    {submitted.map((filing) => (
                      <Card key={filing.id} className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <Link className="text-sm font-medium underline decoration-line underline-offset-4" href={`/tax/${filing.id}`}>
                            {label(filing.kind)} · {filing.periodLabel}
                          </Link>
                          <p className="mt-1 text-xs text-muted">
                            {filing.submittedAt ? `${t("tax.submittedOn")} ${formatDate(filing.submittedAt.slice(0, 10))}` : ""}
                            {filing.submission?.ticket ? ` · ${t("tax.ticket")} ${filing.submission.ticket}` : ""}
                            {filing.submission?.protocolName ? ` · ${filing.submission.protocolName}` : ""}
                          </p>
                        </div>
                        <Pill tone={filing.status}>{label(filing.status)}</Pill>
                      </Card>
                    ))}
                  </div>
                )}
              </Tab>
            </Tabs>
            <div className="mt-8">
              <Disclaimer>{t("tax.disclaimer")}</Disclaimer>
            </div>
          </>
        );
      }}
    </ViewGate>
  );
}