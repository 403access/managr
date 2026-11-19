"use client";

import Link from "next/link";
import {
  calculateTaxFiling,
  checkTaxFilingAction,
  correctTaxFiling,
  deleteTaxFiling,
  releaseTaxFiling,
  reopenTaxFiling,
  saveTaxFilingNote,
  submitTaxFilingManually,
} from "@/server/actions";
import type { taxFilingView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { figureLines } from "@/domain/elster-format";
import type { MessageKey } from "@/i18n";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useI18n } from "@/components/locale-provider";
import { TaxCheckList } from "@/components/tax-checks";
import { useView, ViewGate } from "@/components/use-view";
import { Tab, Tabs } from "@/components/tabs";
import { Card, Check, Disclaimer, Empty, Field, Money, PageHeader, Pill, TextArea, TextInput } from "@/components/ui";

type Filing = NonNullable<ReturnType<typeof taxFilingView>>;

export function TaxFilingScreen({ id }: { id: number }) {
  const query = useView<Filing>(queryKeys.taxFiling(id), viewPath.taxFiling(id));
  const { t, label } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => {
        const filing = data.filing;
        const checks = filing.checks;
        const lines = filing.figures ? figureLines(filing.figures) : [];
        return (
          <>
            <PageHeader
              title={`${label(filing.kind)} · ${filing.periodLabel}`}
              lede={t("tax.filingLede", { from: formatDate(filing.period.from), to: formatDate(filing.period.to) })}
              action={<Link className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm" href="/tax">{t("tax.back")}</Link>}
            />
            <Card className="mb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={filing.status}>{label(filing.status)}</Pill>
                    {filing.replacesId ? <Pill tone="corrected">{t("tax.correction")}</Pill> : null}
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {filing.dueDate ? `${t("tax.due")} ${formatDate(filing.dueDate)}` : t("tax.noDue")}
                    {filing.obligationKey ? ` · ${filing.obligationKey}` : ""}
                  </p>
                  {filing.figuresHash ? <p className="mt-1 font-mono text-xs text-muted">{t("tax.hash")} {filing.figuresHash.slice(0, 12)}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {filing.canEdit ? (
                    <ActionForm action={calculateTaxFiling} compact>
                      <input type="hidden" name="id" value={filing.id} />
                      <SubmitButton tone="quiet">{t("tax.calculate")}</SubmitButton>
                    </ActionForm>
                  ) : null}
                  {filing.hasFigures && filing.canEdit ? (
                    <ActionForm action={checkTaxFilingAction} compact>
                      <input type="hidden" name="id" value={filing.id} />
                      <SubmitButton tone="quiet">{t("tax.checkAction")}</SubmitButton>
                    </ActionForm>
                  ) : null}
                  {filing.nextStatuses.includes("ready") ? (
                    <ActionForm action={releaseTaxFiling} compact>
                      <input type="hidden" name="id" value={filing.id} />
                      {filing.summary.warn > 0 ? <Check name="confirmWarnings" label={t("tax.confirmWarnings")} /> : null}
                      <SubmitButton>{t("tax.release")}</SubmitButton>
                    </ActionForm>
                  ) : null}
                  {filing.status === "checked" || filing.status === "ready" ? (
                    <ActionForm action={reopenTaxFiling} compact>
                      <input type="hidden" name="id" value={filing.id} />
                      <SubmitButton tone="quiet">{t("tax.reopen")}</SubmitButton>
                    </ActionForm>
                  ) : null}
                  {filing.nextStatuses.includes("corrected") ? (
                    <ActionForm action={correctTaxFiling} compact>
                      <input type="hidden" name="id" value={filing.id} />
                      <SubmitButton tone="quiet">{t("tax.correct")}</SubmitButton>
                    </ActionForm>
                  ) : null}
                  {filing.canEdit ? (
                    <ActionForm action={deleteTaxFiling} compact confirm={t("tax.deleteConfirm")}>
                      <input type="hidden" name="id" value={filing.id} />
                      <SubmitButton tone="danger">{t("tax.delete")}</SubmitButton>
                    </ActionForm>
                  ) : null}
                </div>
              </div>
              {filing.summary.block > 0 ? (
                <p className="mt-3 text-sm text-clay">{t("tax.releaseBlocked", { count: filing.summary.block })}</p>
              ) : null}
              {filing.summary.warn > 0 ? (
                <p className="mt-1 text-sm text-amber">{t("tax.releaseWarnings", { count: filing.summary.warn })}</p>
              ) : null}
            </Card>
            <Tabs label={t("tabs.sections")}>
              <Tab id="figures" label={t("tax.figures")}>
                {filing.figures ? (
                  <div className="grid gap-2">
                    <Card>
                      <table className="w-full text-sm">
                        <tbody>
                          {lines.map((line) => (
                            <tr key={line.key} className="border-b border-line/60 last:border-0">
                              <td className="py-2 pr-4">{t(`tax.figure.${line.key}` as MessageKey)}</td>
                              <td className="py-2 text-right"><Money cents={line.cents} /></td>
                              <td className="w-24 py-2 pl-3 text-right text-xs text-muted">{line.wholeEuros ? t("tax.wholeEuros") : t("tax.exact")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                    <Card>
                      <dl className="grid gap-1 text-sm">
                        <div className="flex justify-between gap-3"><dt className="text-muted">{t("tax.period")}</dt><dd>{formatDate(filing.period.from)} – {formatDate(filing.period.to)}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-muted">{t("tax.formatVersion")}</dt><dd>{filing.formatVersion}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-muted">{t("tax.figuresHash")}</dt><dd className="font-mono text-xs">{filing.figuresHash || t("tax.notSet")}</dd></div>
                      </dl>
                    </Card>
                    <Card>
                      <p className="text-sm font-medium">{t("tax.download")}</p>
                      <p className="mt-1 text-xs text-muted">{t("tax.downloadHint")}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {data.exportFormats.map((format) => (
                          <a
                            key={format}
                            className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm"
                            href={`/tax/${filing.id}/export?format=${format}`}
                          >
                            {format === "xml" ? t("tax.downloadXml") : format === "csv" ? t("tax.downloadCsv") : t("tax.downloadJson")}
                          </a>
                        ))}
                      </div>
                    </Card>
                  </div>
                ) : (
                  <Empty>{t("tax.noFigures")}</Empty>
                )}
              </Tab>
              <Tab id="checks" label={t("tax.checks")}>
                <div className="grid gap-2">
                  {checks.length === 0 ? <Empty>{t("tax.noChecks")}</Empty> : <TaxCheckList checks={checks} />}
                  <Card>
                    <ActionForm action={saveTaxFilingNote}>
                      <input type="hidden" name="id" value={filing.id} />
                      <Field label={t("tax.note")}><TextArea name="notes" defaultValue={filing.notes} /></Field>
                      <SubmitButton>{t("tax.saveNote")}</SubmitButton>
                    </ActionForm>
                  </Card>
                </div>
              </Tab>
              <Tab id="submit" label={t("tax.submit")}>
                <div className="grid gap-2">
                  {filing.canSubmit ? (
                    <Card>
                      <p className="text-sm font-medium">{t("tax.manualTitle")}</p>
                      <p className="mt-1 text-sm text-muted">{t("tax.manualHint")}</p>
                      <ActionForm action={submitTaxFilingManually}>
                        <input type="hidden" name="id" value={filing.id} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label={t("tax.ticket")} hint={t("tax.ticketHint")}>
                            <TextInput name="ticket" required />
                          </Field>
                          <Field label={t("tax.submittedOn")}>
                            <TextInput name="submittedOn" type="date" defaultValue={data.today} required />
                          </Field>
                        </div>
                        <Field label={t("tax.protocol")} hint={t("tax.protocolHint")}>
                          <input className="min-h-11 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm" type="file" name="protocol" accept=".pdf,.xml,.zip" />
                        </Field>
                        <Check name="confirmed" label={t("tax.manualConfirm")} />
                        <SubmitButton>{t("tax.manualSubmit")}</SubmitButton>
                      </ActionForm>
                    </Card>
                  ) : (
                    <Card>
                      <p className="text-sm">{filing.status === "submitted_manually" ? t("tax.alreadySubmitted") : t("tax.submitOnlyReady")}</p>
                    </Card>
                  )}
                  {data.transmissions.length === 0 ? <Empty>{t("tax.noTransmissions")}</Empty> : (
                    <Card>
                      <p className="text-sm font-medium">{t("tax.transmissions")}</p>
                      <div className="mt-2 grid gap-2">
                        {data.transmissions.map((transmission) => (
                          <div key={transmission.id} className="rounded-xl border border-line p-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span>{label(transmission.transport)} · {label(transmission.status)}</span>
                              <span className="text-xs text-muted">{formatDate((transmission.finishedAt ?? transmission.startedAt).slice(0, 10))}</span>
                            </div>
                            {transmission.ticket ? <p className="mt-1 text-xs text-muted">{t("tax.ticket")}: {transmission.ticket}</p> : null}
                            {transmission.protocolName ? (
                              <a className="mt-1 inline-block text-xs underline" href={`/tax/${filing.id}/protocol/${transmission.id}`}>
                                {transmission.protocolName}
                              </a>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              </Tab>
              <Tab id="history" label={t("tax.history")}>
                {data.events.length === 0 ? <Empty>{t("tax.historyEmpty")}</Empty> : (
                  <div className="grid gap-2">
                    {data.events.map((event) => (
                      <Card key={event.id} className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm">{label(event.type)}</p>
                          <p className="mt-1 text-xs text-muted">
                            {formatDate(event.at.slice(0, 10))}
                            {event.fromStatus || event.toStatus ? ` · ${label(event.fromStatus)} → ${label(event.toStatus)}` : ""}
                          </p>
                        </div>
                        <span className="text-xs text-muted">{event.actor}</span>
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