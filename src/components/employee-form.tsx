"use client";

import { saveEmployee } from "@/server/actions";
import { ActionForm, SubmitButton } from "./action-form";
import { euroInput, hoursInput, percentInput } from "./amounts";
import { Check, Field, SelectInput, TextArea, TextInput } from "./ui";

export type EmployeeValues = {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
  kind: string;
  svStatus: string;
  ownershipBps: number;
  street: string;
  postalCode: string;
  city: string;
  email: string;
  phone: string;
  startDate: string;
  endDate: string | null;
  weeklyMinutes: number;
  workdaysPerWeek: number;
  vacationDays: number;
  grossMonthlyCents: number;
  taxClass: string;
  taxId: string;
  svNumber: string;
  churchTax: boolean;
  healthInsuranceName: string;
  additionalKvBps: number | null;
  childlessSurcharge: boolean;
  careDiscountSteps: number;
  minijobPublicHealth: boolean;
  pensionOptOut: boolean;
  flatTax: boolean;
  notes: string;
};

export function EmployeeForm({ person, today }: { person?: EmployeeValues; today: string }) {
  return (
    <ActionForm action={saveEmployee}>
      {person ? <input type="hidden" name="id" value={person.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="First name"><TextInput name="firstName" defaultValue={person?.firstName ?? ""} required /></Field>
        <Field label="Last name"><TextInput name="lastName" defaultValue={person?.lastName ?? ""} required /></Field>
        <Field label="Role"><TextInput name="role" defaultValue={person?.role ?? ""} placeholder="Designer" /></Field>
        <Field label="Employment">
          <SelectInput name="kind" defaultValue={person?.kind ?? "regular"}>
            <option value="regular">Employee</option>
            <option value="minijob">Minijob</option>
            <option value="midijob">Midijob label</option>
            <option value="apprentice">Apprentice</option>
            <option value="managing_director">Managing director</option>
          </SelectInput>
        </Field>
        <Field label="Social insurance" hint="Automatic treats a managing director with more than half the shares as not socially insured. That is the usual outcome, not a Statusfeststellung.">
          <SelectInput name="svStatus" defaultValue={person?.svStatus ?? "automatic"}>
            <option value="automatic">Automatic</option>
            <option value="subject">Subject</option>
            <option value="exempt">Exempt</option>
          </SelectInput>
        </Field>
        <Field label="Ownership %" hint="100 is the whole company. The pay band, not this label, selects minijob or Übergangsbereich.">
          <TextInput name="ownership" inputMode="decimal" defaultValue={person ? percentInput(person.ownershipBps) : "0,00"} />
        </Field>
        <Field label="Street"><TextInput name="street" defaultValue={person?.street ?? ""} /></Field>
        <Field label="Postal code"><TextInput name="postalCode" defaultValue={person?.postalCode ?? ""} /></Field>
        <Field label="City"><TextInput name="city" defaultValue={person?.city ?? ""} /></Field>
        <Field label="Email"><TextInput name="email" type="email" defaultValue={person?.email ?? ""} /></Field>
        <Field label="Phone"><TextInput name="phone" defaultValue={person?.phone ?? ""} /></Field>
        <Field label="Start"><TextInput name="startDate" type="date" defaultValue={person?.startDate ?? today} required /></Field>
        <Field label="End"><TextInput name="endDate" type="date" defaultValue={person?.endDate ?? ""} /></Field>
        <Field label="Weekly hours"><TextInput name="weeklyHours" inputMode="decimal" defaultValue={person ? hoursInput(person.weeklyMinutes) : "40"} /></Field>
        <Field label="Workdays per week" hint="Vacation math assumes the first of these days, Monday first.">
          <TextInput name="workdays" inputMode="numeric" defaultValue={person?.workdaysPerWeek ?? 5} />
        </Field>
        <Field label="Vacation days"><TextInput name="vacationDays" inputMode="numeric" defaultValue={person?.vacationDays ?? 20} /></Field>
        <Field label="Monthly gross"><TextInput name="gross" inputMode="decimal" defaultValue={person ? euroInput(person.grossMonthlyCents) : ""} required /></Field>
        <Field label="Tax class" hint="Stored for your adviser. Wage tax is not calculated."><TextInput name="taxClass" defaultValue={person?.taxClass ?? ""} /></Field>
        <Field label="Tax id"><TextInput name="taxId" defaultValue={person?.taxId ?? ""} /></Field>
        <Field label="Social security number"><TextInput name="svNumber" defaultValue={person?.svNumber ?? ""} /></Field>
        <Field label="Health insurance"><TextInput name="healthInsuranceName" defaultValue={person?.healthInsuranceName ?? ""} /></Field>
        <Field label="Their additional contribution %" hint="Leave blank to use the company figure.">
          <TextInput name="additionalKv" inputMode="decimal" defaultValue={person?.additionalKvBps != null ? percentInput(person.additionalKvBps) : ""} placeholder="2,90" />
        </Field>
        <Field label="Care discount steps" hint="0 to 4. Each step is 0.25 points off the employee share only.">
          <TextInput name="careSteps" inputMode="numeric" defaultValue={person?.careDiscountSteps ?? 0} />
        </Field>
      </div>
      <Check name="churchTax" label="Church tax" defaultChecked={person?.churchTax ?? false} hint="Stored only. It is not part of the estimate." />
      <Check name="childless" label="Childless long-term care surcharge" defaultChecked={person?.childlessSurcharge ?? false} />
      <Check name="minijobPublicHealth" label="Minijob in statutory health insurance" defaultChecked={person?.minijobPublicHealth ?? true} hint="Turns the employer health flat on or off." />
      <Check name="pensionOptOut" label="Minijob pension opt-out" defaultChecked={person?.pensionOptOut ?? false} />
      <Check name="flatTax" label="Minijob 2% flat tax" defaultChecked={person?.flatTax ?? true} />
      <Field label="Notes"><TextArea name="notes" defaultValue={person?.notes ?? ""} /></Field>
      <SubmitButton>{person ? "Save person" : "Add person"}</SubmitButton>
    </ActionForm>
  );
}
