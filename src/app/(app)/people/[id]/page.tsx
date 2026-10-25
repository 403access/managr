import { notFound } from "next/navigation";
import { addAbsence, deleteAbsence } from "@/server/actions";
import { loadPerson } from "@/server/queries";
import { formatDate, todayIso } from "@/domain/calendar";
import { formatEuro } from "@/domain/money";
import { minimumVacationDays, vacationShortfall } from "@/domain/time";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { EmployeeForm } from "@/components/employee-form";
import { PayrollForm } from "@/components/payroll-form";
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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Person ${id}` };
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric < 1) notFound();
  const loaded = loadPerson(numeric);
  if (!loaded) notFound();
  const { employee, estimate, estimateError, absences, postedMonths, vacationUsed, company } = loaded;
  const shortfall = vacationShortfall(employee.vacationDays, employee.workdaysPerWeek);
  const today = todayIso();

  return (
    <>
      <PageHeader title={`${employee.firstName} ${employee.lastName}`} lede={employee.role || employee.kind} action={estimate ? <Pill tone={estimate.regime}>{estimate.regime}</Pill> : undefined} />
      {estimateError ? <p className="mb-4 text-sm text-clay">{estimateError}</p> : null}
      {estimate ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left"><th className="py-2 font-medium">Contribution</th><th className="py-2 text-right font-medium">Employee</th><th className="py-2 text-right font-medium">Employer</th></tr>
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
          <p className="mt-3 text-sm">Payout {formatEuro(estimate.payoutCents)} before wage tax. Employer cost {formatEuro(estimate.employerCashCents)}.</p>
          {estimate.warnings.map((warning) => <p key={warning} className="mt-2 text-sm text-amber">{warning}</p>)}
          <div className="mt-3"><Disclaimer /></div>
        </Card>
      ) : null}
      <Section title="Vacation">
        <Card>
          <p className="text-sm">Entitlement {employee.vacationDays} days. Used this calendar year {vacationUsed}. Statutory minimum {minimumVacationDays(employee.workdaysPerWeek)} on a {employee.workdaysPerWeek}-day week.</p>
          {shortfall ? <p className="mt-2 text-sm text-amber">{shortfall}</p> : null}
          <p className="mt-2 text-xs text-muted">Used days count the first {employee.workdaysPerWeek} weekdays, Monday first. The pattern is an assumption.</p>
        </Card>
      </Section>
      <Section title="Record">
        <EmployeeForm person={employee} today={today} />
      </Section>
      <Section title="Payroll">
        <Card>
          <PayrollForm person={employee} company={company} postedMonths={postedMonths} today={today} />
          {postedMonths.length > 0 ? <p className="mt-3 text-sm text-muted">Posted: {postedMonths.join(", ")}</p> : null}
        </Card>
      </Section>
      <Section title="Absences">
        <div className="grid gap-2">
          {absences.map((absence) => (
            <Card key={absence.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">{formatDate(absence.startDate)} – {formatDate(absence.endDate)} · {absence.kind} · {absence.notes}</span>
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
          <ActionForm action={addAbsence}>
            <input type="hidden" name="employeeId" value={employee.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Start"><TextInput name="startDate" type="date" defaultValue={today} /></Field>
              <Field label="End"><TextInput name="endDate" type="date" defaultValue={today} /></Field>
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
}
