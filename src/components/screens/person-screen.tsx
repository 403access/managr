"use client";

import { addAbsence, deleteAbsence } from "@/server/actions";
import type { personView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { formatEuro } from "@/domain/money";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { EmployeeForm } from "@/components/employee-form";
import { PayrollForm } from "@/components/payroll-form";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Disclaimer, Field, PageHeader, Pill, Section, SelectInput, TextInput } from "@/components/ui";

const rows = [
  ["Health", "healthCents"],
  ["Additional", "additionalHealthCents"],
  ["Care", "careCents"],
  ["Pension", "pensionCents"],
  ["Unemployment", "unemploymentCents"],
  ["Insolvency", "insolvencyCents"],
  ["Flat tax", "flatTaxCents"],
] as const;

type Person = NonNullable<ReturnType<typeof personView>>;

export function PersonScreen({ id }: { id: number }) {
  const query = useView<Person>(queryKeys.person(id), viewPath.person(id));
  return (
    <ViewGate query={query}>
      {(loaded) => {
        const { employee, estimate } = loaded;
        return (
          <>
            <PageHeader title={`${employee.firstName} ${employee.lastName}`} lede={employee.role || employee.kind} action={estimate ? <Pill tone={estimate.regime}>{estimate.regime}</Pill> : undefined} />
            {loaded.estimateError ? <p className="mb-4 text-sm text-clay">{loaded.estimateError}</p> : null}
            {estimate ? (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[22rem] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th className="py-2 font-medium">Contribution</th>
                        <th className="py-2 text-right font-medium">Employee</th>
                        <th className="py-2 text-right font-medium">Employer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(([label, key]) => (
                        <tr key={key} className="border-b border-line">
                          <td className="py-2">{label}</td>
                          <td className="py-2 text-right font-mono">{formatEuro(estimate.employee[key])}</td>
                          <td className="py-2 text-right font-mono">{formatEuro(estimate.employer[key])}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className="py-2 font-medium">Total</td>
                        <td className="py-2 text-right font-mono">{formatEuro(estimate.employee.totalCents)}</td>
                        <td className="py-2 text-right font-mono">{formatEuro(estimate.employer.totalCents)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-sm">
                  Payout {formatEuro(estimate.payoutCents)} before wage tax. Employer cost {formatEuro(estimate.employerCashCents)}.
                </p>
                {estimate.warnings.map((warning) => (
                  <p key={warning} className="mt-2 text-sm text-amber">
                    {warning}
                  </p>
                ))}
                <div className="mt-3">
                  <Disclaimer />
                </div>
              </Card>
            ) : null}
            <Section title="Vacation">
              <Card>
                <p className="text-sm">
                  Entitlement {employee.vacationDays} days. Used this calendar year {loaded.vacationUsed}. Statutory minimum {loaded.minimumDays} on a {employee.workdaysPerWeek}-day week.
                </p>
                {loaded.shortfall ? <p className="mt-2 text-sm text-amber">{loaded.shortfall}</p> : null}
                <p className="mt-2 text-xs text-muted">Used days count the first {employee.workdaysPerWeek} weekdays, Monday first. The pattern is an assumption.</p>
              </Card>
            </Section>
            <Section title="Record">
              <EmployeeForm person={employee} today={loaded.today} />
            </Section>
            <Section title="Payroll">
              <Card>
                <PayrollForm person={employee} company={loaded.company} postedMonths={loaded.postedMonths} today={loaded.today} />
                {loaded.postedMonths.length > 0 ? <p className="mt-3 text-sm text-muted">Posted: {loaded.postedMonths.join(", ")}</p> : null}
              </Card>
            </Section>
            <Section title="Absences">
              <div className="grid gap-2">
                {loaded.absences.map((absence) => (
                  <Card key={absence.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">
                      {formatDate(absence.startDate)} – {formatDate(absence.endDate)} · {absence.kind} · {absence.notes}
                    </span>
                    <span className="flex items-center gap-2">
                      <Pill tone={absence.status}>{absence.status}</Pill>
                      <ActionForm action={deleteAbsence} compact>
                        <input type="hidden" name="id" value={absence.id} />
                        <SubmitButton tone="quiet">Remove</SubmitButton>
                      </ActionForm>
                    </span>
                  </Card>
                ))}
              </div>
              <Card className="mt-3">
                <ActionForm action={addAbsence} resetOnSuccess>
                  <input type="hidden" name="employeeId" value={employee.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Start"><TextInput name="startDate" type="date" defaultValue={loaded.today} /></Field>
                    <Field label="End"><TextInput name="endDate" type="date" defaultValue={loaded.today} /></Field>
                    <Field label="Kind">
                      <SelectInput name="kind" defaultValue="vacation">
                        <option value="vacation">Vacation</option>
                        <option value="sick">Sick</option>
                        <option value="other">Other</option>
                      </SelectInput>
                    </Field>
                    <Field label="Status">
                      <SelectInput name="status" defaultValue="approved">
                        <option value="approved">Approved</option>
                        <option value="requested">Requested</option>
                        <option value="rejected">Rejected</option>
                      </SelectInput>
                    </Field>
                  </div>
                  <Field label="Notes"><TextInput name="notes" /></Field>
                  <SubmitButton>Add absence</SubmitButton>
                </ActionForm>
              </Card>
            </Section>
          </>
        );
      }}
    </ViewGate>
  );
}
