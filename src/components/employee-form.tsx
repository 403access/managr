"use client";

import type { MouseEvent } from "react";
import { saveEmployee } from "@/server/actions";
import { useI18n } from "./locale-provider";
import { ActionForm, SubmitButton } from "./action-form";
import { euroInput, hoursInput, percentInput } from "./amounts";
import { Tab, Tabs } from "./tabs";
import { Check, Field, SelectInput, TextArea, TextInput } from "./ui";

export type EmployeeValues = {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
  kind: string;
  shareholderId: number | null;
  managerId: number | null;
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

// A required field in a hidden section cannot receive focus, so the browser
// would block the submit without showing why. Open that section first.
function revealInvalidSection(event: MouseEvent<HTMLButtonElement>) {
  const form = event.currentTarget.form;
  if (!form) return;
  const invalid = form.querySelector<HTMLElement>(":invalid");
  if (!invalid) return;
  const panel = invalid.closest<HTMLElement>('[role="tabpanel"]');
  if (!panel?.hasAttribute("hidden")) return;
  event.preventDefault();
  const tab = document.getElementById(panel.getAttribute("aria-labelledby") ?? "");
  tab?.click();
  requestAnimationFrame(() => invalid.focus());
}

export function EmployeeForm({ person, today, shareholders = [], colleagues = [] }: { person?: EmployeeValues; today: string; shareholders?: { id: number; name: string }[]; colleagues?: { id: number; name: string; role: string }[] }) {
  const { t, label } = useI18n();
  return (
    <ActionForm action={saveEmployee}>
      {person ? <input type="hidden" name="id" value={person.id} /> : null}
      <Tabs label={t("tabs.sections")} inline>
        <Tab id="person" label={t("people.tabPerson")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("people.first")}><TextInput name="firstName" defaultValue={person?.firstName ?? ""} required /></Field>
            <Field label={t("people.last")}><TextInput name="lastName" defaultValue={person?.lastName ?? ""} required /></Field>
            <Field label={t("people.role")}><TextInput name="role" defaultValue={person?.role ?? ""} placeholder={t("people.rolePlaceholder")} /></Field>
          </div>
        </Tab>
        <Tab id="address" label={t("people.tabAddress")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("common.street")}><TextInput name="street" defaultValue={person?.street ?? ""} autoComplete="street-address" /></Field>
            <Field label={t("common.postal")}><TextInput name="postalCode" defaultValue={person?.postalCode ?? ""} autoComplete="postal-code" /></Field>
            <Field label={t("common.city")}><TextInput name="city" defaultValue={person?.city ?? ""} autoComplete="address-level2" /></Field>
            <Field label={t("common.email")}><TextInput name="email" type="email" defaultValue={person?.email ?? ""} autoComplete="email" /></Field>
            <Field label={t("common.phone")}><TextInput name="phone" type="tel" defaultValue={person?.phone ?? ""} autoComplete="tel" /></Field>
          </div>
        </Tab>
        <Tab id="employment" label={t("people.employment")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("people.employment")}>
              <SelectInput name="kind" defaultValue={person?.kind ?? "regular"}>
                <option value="regular">{t("people.kindEmployee")}</option>
                <option value="minijob">{t("people.kindMinijob")}</option>
                <option value="midijob">{t("people.kindMidijob")}</option>
                <option value="apprentice">{t("people.kindApprentice")}</option>
                <option value="managing_director">{t("people.kindDirector")}</option>
              </SelectInput>
            </Field>
            <Field label={t("people.sv")} hint={t("people.svHint")}>
              <SelectInput name="svStatus" defaultValue={person?.svStatus ?? "automatic"}>
                <option value="automatic">{label("automatic")}</option>
                <option value="subject">{label("subject")}</option>
                <option value="exempt">{label("exempt")}</option>
              </SelectInput>
            </Field>
            <Field label={t("common.start")}><TextInput name="startDate" type="date" defaultValue={person?.startDate ?? today} required /></Field>
            <Field label={t("common.end")}><TextInput name="endDate" type="date" defaultValue={person?.endDate ?? ""} /></Field>
            <Field label={t("people.weekly")}><TextInput name="weeklyHours" inputMode="decimal" defaultValue={person ? hoursInput(person.weeklyMinutes) : "40"} /></Field>
            <Field label={t("people.workdays")} hint={t("people.workdaysHint")}>
              <TextInput name="workdays" inputMode="numeric" defaultValue={person?.workdaysPerWeek ?? 5} />
            </Field>
            <Field label={t("people.vacationDays")}><TextInput name="vacationDays" inputMode="numeric" defaultValue={person?.vacationDays ?? 20} /></Field>
            <Field label={t("people.monthlyGross")} hint={t("people.monthlyGrossHint")}><TextInput name="gross" inputMode="decimal" defaultValue={person ? euroInput(person.grossMonthlyCents) : ""} required /></Field>
            <Field label={t("people.shareholder")} hint={t("people.shareholderHint")}>
              <SelectInput name="shareholderId" defaultValue={person?.shareholderId ?? ""}>
                <option value="">{t("people.shareholderNone")}</option>
                {shareholders.map((holder) => (
                  <option key={holder.id} value={holder.id}>{holder.name}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t("people.manager")} hint={t("people.managerHint")}>
              <SelectInput name="managerId" defaultValue={person?.managerId ?? ""}>
                <option value="">{t("people.managerNone")}</option>
                {colleagues
                  .filter((colleague) => colleague.id !== person?.id)
                  .map((colleague) => (
                    <option key={colleague.id} value={colleague.id}>
                      {colleague.name}
                      {colleague.role ? ` · ${colleague.role}` : ""}
                    </option>
                  ))}
              </SelectInput>
            </Field>
            <Field label={t("people.ownership")} hint={t("people.ownershipHint")}>
              <TextInput name="ownership" inputMode="decimal" defaultValue={person ? percentInput(person.ownershipBps) : "0,00"} />
            </Field>
          </div>
        </Tab>
        <Tab id="insurance" label={t("people.tabInsurance")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("people.taxClass")} hint={t("people.taxClassHint")}><TextInput name="taxClass" defaultValue={person?.taxClass ?? ""} /></Field>
            <Field label={t("people.taxId")}><TextInput name="taxId" defaultValue={person?.taxId ?? ""} /></Field>
            <Field label={t("people.svNumber")}><TextInput name="svNumber" defaultValue={person?.svNumber ?? ""} /></Field>
            <Field label={t("people.insurer")}><TextInput name="healthInsuranceName" defaultValue={person?.healthInsuranceName ?? ""} /></Field>
            <Field label={t("people.ownKv")} hint={t("people.ownKvHint")}>
              <TextInput name="additionalKv" inputMode="decimal" defaultValue={person?.additionalKvBps != null ? percentInput(person.additionalKvBps) : ""} placeholder="2,90" />
            </Field>
            <Field label={t("people.careSteps")} hint={t("people.careStepsHint")}>
              <TextInput name="careSteps" inputMode="numeric" defaultValue={person?.careDiscountSteps ?? 0} />
            </Field>
          </div>
          <div className="mt-2 grid gap-1">
            <Check name="churchTax" label={t("people.church")} defaultChecked={person?.churchTax ?? false} hint={t("people.churchHint")} />
            <Check name="childless" label={t("people.childless")} defaultChecked={person?.childlessSurcharge ?? false} />
            <Check name="minijobPublicHealth" label={t("people.miniKv")} defaultChecked={person?.minijobPublicHealth ?? true} hint={t("people.miniKvHint")} />
            <Check name="pensionOptOut" label={t("people.optOut")} defaultChecked={person?.pensionOptOut ?? false} />
            <Check name="flatTax" label={t("people.flatTax")} defaultChecked={person?.flatTax ?? true} />
          </div>
        </Tab>
        <Tab id="notes" label={t("common.notes")}>
          <Field label={t("common.notes")}><TextArea name="notes" defaultValue={person?.notes ?? ""} /></Field>
        </Tab>
      </Tabs>
      <SubmitButton onClick={revealInvalidSection}>{person ? t("people.save") : t("people.add")}</SubmitButton>
    </ActionForm>
  );
}