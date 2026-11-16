"use client";

import { addAbsence, deleteAbsence, deleteSalaryPeriod, payShareholder, saveSalaryPeriod } from "@/server/actions";
import type { personView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { formatEuro, formatPercentBps } from "@/domain/money";
import { payslip } from "@/domain/social";
import { queryKeys, viewPath } from "@/client/query-keys";
import { euroInput } from "@/components/amounts";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { EmployeeForm } from "@/components/employee-form";
import { useI18n } from "@/components/locale-provider";
import { PayrollForm } from "@/components/payroll-form";
import { PayslipTable } from "@/components/payslip-table";
import { useView, ViewGate } from "@/components/use-view";
import { Tab, Tabs } from "@/components/tabs";
import { Card, Disclaimer, Field, PageHeader, Pill, SelectInput, TextInput } from "@/components/ui";

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
                <PayslipTable payslip={payslip(estimate, 0)} wageTaxKnown={false} />
                <p className="mt-3 text-sm text-muted">{t("people.payslipNoTax")}</p>
                {estimate.warnings.map((warning) => (
                  <p key={warning} className="mt-2 text-sm text-amber">
                    {tx(warning)}
                  </p>
                ))}
                <div className="mt-3">
                  <Disclaimer>{t("people.payslipNote")}</Disclaimer>
                </div>
              </Card>
            ) : null}
            {employee.kind === "managing_director" ? (
              <Card className="mt-6">
                <h2 className="text-xl">{t("people.shareholderDirector")}</h2>
                {loaded.shareholder ? (
                  <p className="mt-2 text-sm">
                    {t("people.shareholderLinked", { name: loaded.shareholder.name, percent: formatPercentBps(loaded.shareholder.shareBps) })}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted">{t("people.shareholderUnlinked")}</p>
                )}
                {loaded.directorReview.warnings.map((warning) => (
                  <p key={warning} className="mt-2 text-sm text-amber">{tx(warning)}</p>
                ))}
                <p className="mt-3 text-sm">{t("people.shareholderPayable", { amount: formatEuro(loaded.shareholderPayableCents) })}</p>
                {loaded.shareholder && loaded.shareholderPayableCents > 0 ? (
                  <ActionForm action={payShareholder} className="mt-3 grid gap-3">
                    <input type="hidden" name="employeeId" value={employee.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={t("common.amount")}>
                        <TextInput name="amount" inputMode="decimal" defaultValue={euroInput(loaded.shareholderPayableCents)} />
                      </Field>
                      <Field label={t("common.date")}><TextInput name="date" type="date" defaultValue={loaded.today} /></Field>
                    </div>
                    <Field label={t("common.memo")}><TextInput name="memo" /></Field>
                    <SubmitButton>{t("people.shareholderPayout")}</SubmitButton>
                  </ActionForm>
                ) : null}
                <div className="mt-3">
                  <Disclaimer>{t("people.shareholderNote")}</Disclaimer>
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
            <Tab id="salary" label={t("people.salary")}>
              <Card>
                <p className="text-sm">{t("people.salaryCurrent", { amount: formatEuro(loaded.currentSalaryCents) })}</p>
                {loaded.nextChange ? (
                  <p className="mt-1 text-sm text-muted">
                    {t("people.salaryNext", { amount: formatEuro(loaded.nextChange.grossMonthlyCents), date: formatDate(loaded.nextChange.validFrom) })}
                  </p>
                ) : null}
                {loaded.salaryPeriods.length === 0 ? <p className="mt-2 text-sm text-muted">{t("people.salaryNone")}</p> : null}
              </Card>
              {loaded.salaryPeriods.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {loaded.salaryPeriods.map((period) => (
                    <Card key={period.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm">
                        {formatDate(period.validFrom)} · {formatEuro(period.grossMonthlyCents)}
                        {period.note ? ` · ${period.note}` : ""}
                      </span>
                      <ActionForm action={deleteSalaryPeriod} compact>
                        <input type="hidden" name="employeeId" value={employee.id} />
                        <input type="hidden" name="id" value={period.id} />
                        <SubmitButton tone="quiet">{t("common.remove")}</SubmitButton>
                      </ActionForm>
                    </Card>
                  ))}
                </div>
              ) : null}
              <Card className="mt-3">
                <h2 className="text-xl">{t("people.salaryAdd")}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{t("people.salaryAddHint")}</p>
                <ActionForm action={saveSalaryPeriod} resetOnSuccess>
                  <input type="hidden" name="employeeId" value={employee.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("people.salaryFrom")}><TextInput name="validFrom" type="date" defaultValue={loaded.today} /></Field>
                    <Field label={t("people.salaryGross")}><TextInput name="gross" inputMode="decimal" placeholder={formatEuro(loaded.employee.grossMonthlyCents)} /></Field>
                  </div>
                  <Field label={t("common.notes")}><TextInput name="note" /></Field>
                  <SubmitButton>{t("people.salarySave")}</SubmitButton>
                </ActionForm>
              </Card>
              <div className="mt-3">
                <Disclaimer>{t("people.salaryNote")}</Disclaimer>
              </div>
            </Tab>
            <Tab id="record" label={t("people.record")}>
              <EmployeeForm person={employee} today={loaded.today} shareholders={loaded.shareholders} />
            </Tab>
            <Tab id="payroll" label={t("people.payroll")}>
              <Card>
                <PayrollForm person={employee} company={loaded.company} salaryPeriods={loaded.salaryPeriods} shareholderDirector={employee.kind === "managing_director" && employee.shareholderId !== null} postedMonths={loaded.postedMonths} today={loaded.today} />
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
