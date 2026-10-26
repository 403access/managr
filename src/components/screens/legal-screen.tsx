"use client";

import { saveResolution, toggleCompliance } from "@/server/actions";
import type { legalView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { formatEuro } from "@/domain/money";
import { GMBH_MINIMUM_CAPITAL_CENTS } from "@/domain/rates-2026";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Field, PageHeader, Pill, Section, SelectInput, TextArea, TextInput } from "@/components/ui";

type Legal = ReturnType<typeof legalView>;

export function LegalScreen() {
  const query = useView<Legal>(queryKeys.legal, viewPath.legal);
  const { t, label } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => {
        const areas = [...new Set(data.items.map((item) => item.area))];
        return (
          <>
            <PageHeader title={t("legal.title")} lede={t("legal.lede", { amount: formatEuro(GMBH_MINIMUM_CAPITAL_CENTS) })} />
            {areas.map((area) => (
              <Section key={area} title={label(area) === area ? area : label(area)}>
                <div className="grid gap-2">
                  {data.items
                    .filter((item) => item.area === area)
                    .map((item) => (
                      <Card key={item.id} className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{item.title}</p>
                          {item.detail ? <p className="mt-1 text-sm text-muted">{item.detail}</p> : null}
                        </div>
                        <ActionForm action={toggleCompliance} compact>
                          <input type="hidden" name="id" value={item.id} />
                          <Pill tone={item.done ? "done" : "open"}>{item.done ? label("done") : label("open")}</Pill>
                          <SubmitButton tone="quiet">{item.done ? t("common.reopen") : t("legal.markDone")}</SubmitButton>
                        </ActionForm>
                      </Card>
                    ))}
                </div>
              </Section>
            ))}
            <Section title={t("legal.resolutions")}>
              <div className="grid gap-2">
                {data.resolutions.map((resolution) => (
                  <Card key={resolution.id}>
                    <p className="text-sm font-medium">{resolution.title}</p>
                    <p className="text-xs text-muted">
                      {formatDate(resolution.resolvedOn)} · {label(resolution.kind)}
                    </p>
                    {resolution.summary ? <p className="mt-2 text-sm">{resolution.summary}</p> : null}
                    <p className="mt-2 text-sm whitespace-pre-wrap text-muted">{resolution.body}</p>
                  </Card>
                ))}
              </div>
              <Card className="mt-3">
                <ActionForm action={saveResolution} resetOnSuccess>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("common.date")}><TextInput name="resolvedOn" type="date" defaultValue={data.today} /></Field>
                    <Field label={t("common.kind")}>
                      <SelectInput name="kind" defaultValue="other">
                        <option value="formation">{label("formation")}</option>
                        <option value="profit">{label("profit")}</option>
                        <option value="appointment">{label("appointment")}</option>
                        <option value="other">{label("other")}</option>
                      </SelectInput>
                    </Field>
                  </div>
                  <Field label={t("common.title")}><TextInput name="title" /></Field>
                  <Field label={t("legal.summary")}><TextInput name="summary" /></Field>
                  <Field label={t("legal.wording")}><TextArea name="body" /></Field>
                  <SubmitButton>{t("legal.record")}</SubmitButton>
                </ActionForm>
              </Card>
            </Section>
          </>
        );
      }}
    </ViewGate>
  );
}
