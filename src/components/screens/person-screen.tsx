"use client";

import { addAbsence, deleteAbsence } from "@/server/actions";
import type { personView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { formatEuro } from "@/domain/money";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { EmployeeForm } from "@/components/employee-form";
import { useI18n } from "@/components/locale-provider";
import { PayrollForm } from "@/components/payroll-form";
import { useView, ViewGate } from "@/components/use-view";
import { Tab, Tabs } from "@/components/tabs";
import { Card, Disclaimer, Field, PageHeader, Pill, SelectInput, TextInput } from "@/components/ui";

const rows = [
  ["people.health", "healthCents"],
  ["people.additional", "additionalHealthCents"],
  ["people.care", "careCents"],
  ["people.pension", "pensionCents"],
  ["people.unemployment", "unemploymentCents"],
  ["people.insolvency", "insolvencyCents"],
  ["people.flatTaxRow", "flatTaxCents"],
] as const;

type Person = NonNullable<ReturnType<typeof personView>>;

export function PersonScreen({ id }: { id: number }) {
  const query = useView<Person>(queryKeys.person(id), viewPath.person(id));
  const { t, tx, label } = useI18n();
  return (
    <ViewGate query={query}>
      {(loaded) => {
        const { employee, estimate } = loaded;
        return (
          <>
            <PageHeader title={`${employee.firstName} ${employee.lastName}`} lede={employee.role || label(employee.kind)} action={estimate ? <Pill tone={estimate.regime}>{label(estimate.regime)}</Pill> : undefined} />
            {loaded.estimateError ? <p className="mb-4 text-sm text-clay">{tx(loaded.estimateError)}</p> : null}
            <Tabs label={t("tabs.sections")}>
            <Tab id="overview" label={t("people.overview")}>
            {estimate ? (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[22rem] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th className="py-2 font-medium">{t("people.contribution")}</th>
                        <th className="py-2 text-right font-medium">{t("people.employee")}</th>
                        <th className="py-2 text-right font-medium">{t("people.employer")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(([key, field]) => (
                        <tr key={field} className="border-b border-line">
                          <td className="py-2">{t(key)}</td>
                          <td className="py-2 text-right font-mono">{formatEuro(estimate.employee[field])}</td>
                          <td className="py-2 text-right font-mono">{formatEuro(estimate.employer[field])}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className="py-2 font-medium">{t("people.total")}</td>
                        <td className="py-2 text-right font-mono">{formatEuro(estimate.employee.totalCents)}</td>
                        <td className="py-2 text-right font-mono">{formatEuro(estimate.employer.totalCents)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-sm">
                  {t("people.payout", { payout: formatEuro(estimate.payoutCents), cost: formatEuro(estimate.employerCashCents) })}
                </p>
                {estimate.warnings.map((warning) => (
                  <p key={warning} className="mt-2 text-sm text-amber">
                    {tx(warning)}
                  </p>
                ))}
                <div className="mt-3">
                  <Disclaimer>{t("disclaimer.default")}</Disclaimer>
                </div>
              </Card>
            ) : null}
            <h2 className={`${estimate ? "mt-6" : ""} mb-3 text-2xl`}>{t("people.vacation")}</h2>
              <Card>
                <p className="text-sm">
                  {t("people.vacationBody", {
                    days: employee.vacationDays,
                    used: loaded.vacationUsed,
                    minimum: loaded.minimumDays,
                    week: employee.workdaysPerWeek,
                  })}
                </p>
                {loaded.shortfall ? <p className="mt-2 text-sm text-amber">{tx(loaded.shortfall)}</p> : null}
                <p className="mt-2 text-xs text-muted">{t("people.vacationNote", { days: employee.workdaysPerWeek })}</p>
              </Card>
            </Tab>
            <Tab id="record" label={t("people.record")}>
              <EmployeeForm person={employee} today={loaded.today} />
            </Tab>
            <Tab id="payroll" label={t("people.payroll")}>
              <Card>
                <PayrollForm person={employee} company={loaded.company} postedMonths={loaded.postedMonths} today={loaded.today} />
                {loaded.postedMonths.length > 0 ? <p className="mt-3 text-sm text-muted">{t("people.posted", { months: loaded.postedMonths.join(", ") })}</p> : null}
              </Card>
            </Tab>
            <Tab id="absences" label={t("people.absences")}>
              <div className="grid gap-2">
                {loaded.absences.map((absence) => (
                  <Card key={absence.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">
                      {formatDate(absence.startDate)} – {formatDate(absence.endDate)} · {label(absence.kind)} · {absence.notes}
                    </span>
                    <span className="flex items-center gap-2">
                      <Pill tone={absence.status}>{label(absence.status)}</Pill>
                      <ActionForm action={deleteAbsence} compact>
                        <input type="hidden" name="id" value={absence.id} />
                        <SubmitButton tone="quiet">{t("common.remove")}</SubmitButton>
                      </ActionForm>
                    </span>
                  </Card>
                ))}
              </div>
              <Card className="mt-3">
                <ActionForm action={addAbsence} resetOnSuccess>
                  <input type="hidden" name="employeeId" value={employee.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("common.start")}><TextInput name="startDate" type="date" defaultValue={loaded.today} /></Field>
                    <Field label={t("common.end")}><TextInput name="endDate" type="date" defaultValue={loaded.today} /></Field>
                    <Field label={t("common.kind")}>
                      <SelectInput name="kind" defaultValue="vacation">
                        <option value="vacation">{label("vacation")}</option>
                        <option value="sick">{label("sick")}</option>
                        <option value="other">{label("other")}</option>
                      </SelectInput>
                    </Field>
                    <Field label={t("common.status")}>
                      <SelectInput name="status" defaultValue="approved">
                        <option value="approved">{label("approved")}</option>
                        <option value="requested">{label("requested")}</option>
                        <option value="rejected">{label("rejected")}</option>
                      </SelectInput>
                    </Field>
                  </div>
                  <Field label={t("common.notes")}><TextInput name="notes" /></Field>
                  <SubmitButton>{t("people.addAbsence")}</SubmitButton>
                </ActionForm>
              </Card>
            </Tab>
            </Tabs>
          </>
        );
      }}
    </ViewGate>
  );
}
