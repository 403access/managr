"use client";

import { saveResolution, toggleCompliance } from "@/server/actions";
import type { legalView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { formatEuro } from "@/domain/money";
import { GMBH_MINIMUM_CAPITAL_CENTS } from "@/domain/rates-2026";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Field, PageHeader, Pill, Section, SelectInput, TextArea, TextInput } from "@/components/ui";

type Legal = ReturnType<typeof legalView>;

export function LegalScreen() {
  const query = useView<Legal>(queryKeys.legal, viewPath.legal);
  return (
    <ViewGate query={query}>
      {(data) => {
        const areas = [...new Set(data.items.map((item) => item.area))];
        return (
          <>
            <PageHeader
              title="Legal"
              lede={`A checklist and a record of shareholder decisions. The GmbH minimum is ${formatEuro(GMBH_MINIMUM_CAPITAL_CENTS)}. The statutory reserve duty ends when share capital is increased to that amount and the increase is registered, not when the reserve balance reaches it.`}
            />
            {areas.map((area) => (
              <Section key={area} title={area}>
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
                          <Pill tone={item.done ? "done" : "open"}>{item.done ? "done" : "open"}</Pill>
                          <SubmitButton tone="quiet">{item.done ? "Reopen" : "Mark done"}</SubmitButton>
                        </ActionForm>
                      </Card>
                    ))}
                </div>
              </Section>
            ))}
            <Section title="Resolutions">
              <div className="grid gap-2">
                {data.resolutions.map((resolution) => (
                  <Card key={resolution.id}>
                    <p className="text-sm font-medium">{resolution.title}</p>
                    <p className="text-xs text-muted">
                      {formatDate(resolution.resolvedOn)} · {resolution.kind}
                    </p>
                    {resolution.summary ? <p className="mt-2 text-sm">{resolution.summary}</p> : null}
                    <p className="mt-2 text-sm whitespace-pre-wrap text-muted">{resolution.body}</p>
                  </Card>
                ))}
              </div>
              <Card className="mt-3">
                <ActionForm action={saveResolution} resetOnSuccess>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Date"><TextInput name="resolvedOn" type="date" defaultValue={data.today} /></Field>
                    <Field label="Kind">
                      <SelectInput name="kind" defaultValue="other">
                        <option value="formation">Formation</option>
                        <option value="profit">Profit and reserve</option>
                        <option value="appointment">Appointment</option>
                        <option value="other">Other</option>
                      </SelectInput>
                    </Field>
                  </div>
                  <Field label="Title"><TextInput name="title" /></Field>
                  <Field label="Summary"><TextInput name="summary" /></Field>
                  <Field label="Decision"><TextArea name="body" /></Field>
                  <SubmitButton>Record resolution</SubmitButton>
                </ActionForm>
              </Card>
            </Section>
          </>
        );
      }}
    </ViewGate>
  );
}
