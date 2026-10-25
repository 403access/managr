"use client";

import { addPolicy, addShareholder, deletePolicy, deleteShareholder, offsetReserve, recordReserve, updateBank, updateIdentity, updateTaxProfile } from "@/server/actions";
import type { companyView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { formatEuro } from "@/domain/money";
import { GMBH_MINIMUM_CAPITAL_CENTS } from "@/domain/rates-2026";
import { FEDERAL_STATES } from "@/domain/states";
import { queryKeys, viewPath } from "@/client/query-keys";
import { euroInput, percentInput } from "@/components/amounts";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ReserveHint } from "@/components/reserve-hint";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Check, Disclaimer, Field, Money, PageHeader, Section, SelectInput, TextArea, TextInput } from "@/components/ui";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type Company = ReturnType<typeof companyView>;

export function CompanyScreen() {
  const query = useView<Company>(queryKeys.company, viewPath.company);
  return (
    <ViewGate query={query}>
      {(data) => {
        const { company } = data;
        return (
          <>
            <PageHeader title="Company" lede="Stammdaten, shareholders, the statutory reserve, and cover. Changing share capital here does not register an increase." />
            <Section title="Identity">
              <Card>
                <ActionForm action={updateIdentity}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Legal name" hint="Needs Unternehmergesellschaft (haftungsbeschränkt) or UG (haftungsbeschränkt)."><TextInput name="legalName" defaultValue={company.legalName} /></Field>
                    <Field label="Managing director"><TextInput name="managingDirector" defaultValue={company.managingDirector} /></Field>
                    <Field label="Street"><TextInput name="street" defaultValue={company.street} /></Field>
                    <Field label="Postal code"><TextInput name="postalCode" defaultValue={company.postalCode} /></Field>
                    <Field label="City"><TextInput name="city" defaultValue={company.city} /></Field>
                    <Field label="Country"><TextInput name="country" defaultValue={company.country} /></Field>
                    <Field label="State">
                      <SelectInput name="stateCode" defaultValue={company.stateCode}>
                        {FEDERAL_STATES.map((state) => (
                          <option key={state.code} value={state.code}>
                            {state.name}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                    <Field label="Founded"><TextInput name="foundingDate" type="date" defaultValue={company.foundingDate} /></Field>
                    <Field label="Register court"><TextInput name="registerCourt" defaultValue={company.registerCourt} /></Field>
                    <Field label="HRB"><TextInput name="registerNumber" defaultValue={company.registerNumber} /></Field>
                    <Field label="Email"><TextInput name="email" defaultValue={company.email} /></Field>
                    <Field label="Phone"><TextInput name="phone" defaultValue={company.phone} /></Field>
                    <Field label="Website"><TextInput name="website" defaultValue={company.website} /></Field>
                    <Field label="IHK"><TextInput name="ihk" defaultValue={company.ihk} /></Field>
                    <Field label="Berufsgenossenschaft"><TextInput name="berufsgenossenschaft" defaultValue={company.berufsgenossenschaft} /></Field>
                    <Field label="Share capital" hint="Stored as a figure. It does not post a capital increase."><TextInput name="shareCapital" inputMode="decimal" defaultValue={euroInput(company.shareCapitalCents)} /></Field>
                  </div>
                  <SubmitButton>Save identity</SubmitButton>
                </ActionForm>
              </Card>
            </Section>
            <Section title="Tax profile">
              <Card>
                <ActionForm action={updateTaxProfile}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Tax number"><TextInput name="taxNumber" defaultValue={company.taxNumber} /></Field>
                    <Field label="VAT id"><TextInput name="vatId" defaultValue={company.vatId} /></Field>
                    <Field label="Wirtschafts-Identifikationsnummer"><TextInput name="economicId" defaultValue={company.economicId} /></Field>
                    <Field label="Hebesatz %" hint="Your municipality’s rate, such as 410. Not a federal constant."><TextInput name="hebesatz" inputMode="numeric" defaultValue={String(company.hebesatzPercent)} /></Field>
                    <Field label="Additional health contribution %" hint="A zero here follows the published average inside the contribution estimate."><TextInput name="additionalKv" inputMode="decimal" defaultValue={percentInput(company.additionalKvBps)} /></Field>
                    <Field label="Default VAT">
                      <SelectInput name="defaultVat" defaultValue={String(company.defaultVatBps)}>
                        <option value="0">0%</option>
                        <option value="700">7%</option>
                        <option value="1900">19%</option>
                      </SelectInput>
                    </Field>
                    <Field label="Prior-year turnover" hint="You maintain this. Ledger revenue is only a proxy for the §19 check."><TextInput name="priorYearRevenue" inputMode="decimal" defaultValue={euroInput(company.priorYearRevenueCents)} /></Field>
                    <Field label="Loss carryforward"><TextInput name="lossCarryforward" inputMode="decimal" defaultValue={euroInput(company.lossCarryforwardCents)} /></Field>
                    <Field label="Financial year starts">
                      <SelectInput name="fiscalYearStartMonth" defaultValue={String(company.fiscalYearStartMonth)}>
                        {MONTHS.map((month, index) => (
                          <option key={month} value={index + 1}>
                            {month}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                  </div>
                  <Check name="kleinunternehmer" label="Kleinunternehmer §19 UStG" defaultChecked={company.kleinunternehmer} hint="Confirm the binding period with an adviser before you waive or claim this." />
                  <Check name="vatPermanentExtension" label="Dauerfristverlängerung" defaultChecked={company.vatPermanentExtension} hint="Moves the VAT return one month later." />
                  <Check name="usesTaxAdvisor" label="A tax adviser files the returns" defaultChecked={company.usesTaxAdvisor} hint="Uses the longer annual deadline. The Bescheid still wins." />
                  <SubmitButton>Save tax profile</SubmitButton>
                </ActionForm>
              </Card>
            </Section>
            <Section title="Bank and invoices">
              <Card>
                <ActionForm action={updateBank}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Account holder bank"><TextInput name="bankName" defaultValue={company.bankName} /></Field>
                    <Field label="IBAN"><TextInput name="iban" defaultValue={company.iban} /></Field>
                    <Field label="BIC"><TextInput name="bic" defaultValue={company.bic} /></Field>
                    <Field label="Invoice prefix"><TextInput name="invoicePrefix" defaultValue={company.invoicePrefix} /></Field>
                    <Field label="Payment terms (days)"><TextInput name="paymentTermsDays" inputMode="numeric" defaultValue={String(company.paymentTermsDays)} /></Field>
                  </div>
                  <SubmitButton>Save bank settings</SubmitButton>
                </ActionForm>
              </Card>
            </Section>
            <Section title="Shareholders">
              {data.shareBps !== 10_000 ? <p className="mb-3 text-sm text-amber">Shares add up to {percentInput(data.shareBps)} %. The list should total 100 %.</p> : null}
              <div className="grid gap-2">
                {data.holders.map((holder) => (
                  <Card key={holder.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{holder.name}</p>
                      <p className="text-sm text-muted">
                        {percentInput(holder.shareBps)} % · nominal {formatEuro(holder.nominalCents)}
                      </p>
                      <p className="text-xs text-muted">{[holder.street, holder.postalCode, holder.city].filter(Boolean).join(", ")}</p>
                    </div>
                    <ActionForm action={deleteShareholder} compact confirm={`Remove ${holder.name} from the shareholder list?`}>
                      <input type="hidden" name="id" value={holder.id} />
                      <SubmitButton tone="danger">Remove</SubmitButton>
                    </ActionForm>
                  </Card>
                ))}
              </div>
              <Card className="mt-3">
                <ActionForm action={addShareholder} resetOnSuccess>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name"><TextInput name="name" /></Field>
                    <Field label="Share %"><TextInput name="share" inputMode="decimal" placeholder="100,00" /></Field>
                    <Field label="Nominal amount"><TextInput name="nominal" inputMode="decimal" placeholder="2.500,00" /></Field>
                    <Field label="Street"><TextInput name="street" /></Field>
                    <Field label="Postal code"><TextInput name="postalCode" /></Field>
                    <Field label="City"><TextInput name="city" /></Field>
                  </div>
                  <SubmitButton>Add shareholder</SubmitButton>
                </ActionForm>
              </Card>
            </Section>
            <Section title="Statutory reserve">
              <Card className="grid gap-4">
                <p className="text-sm leading-relaxed">
                  Balance <Money cents={data.reserve} />. Gap to {formatEuro(GMBH_MINIMUM_CAPITAL_CENTS)} share capital: <Money cents={data.gap.gapCents} />.
                  {data.duty ? " The quarter-reserve duty stays on while share capital is below that minimum. It does not stop because the reserve itself reaches it." : " The duty is off because share capital in this record is at the GmbH minimum."}
                </p>
                <ReserveHint shareCapitalCents={company.shareCapitalCents} />
                <ActionForm action={recordReserve}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Year"><TextInput name="year" inputMode="numeric" defaultValue={String(Number(data.today.slice(0, 4)) - 1)} /></Field>
                    <Field label="Date"><TextInput name="movedOn" type="date" defaultValue={data.today} /></Field>
                    <Field label="Amount"><TextInput name="amount" inputMode="decimal" /></Field>
                  </div>
                  <Field label="Note"><TextInput name="note" /></Field>
                  <SubmitButton>Post allocation</SubmitButton>
                </ActionForm>
                <ActionForm action={offsetReserve}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Offset date"><TextInput name="movedOn" type="date" defaultValue={data.today} /></Field>
                    <Field label="Offset amount" hint="Cannot exceed the reserve balance. This does not raise share capital."><TextInput name="amount" inputMode="decimal" /></Field>
                  </div>
                  <Field label="Note"><TextInput name="note" /></Field>
                  <SubmitButton tone="quiet">Offset a loss</SubmitButton>
                </ActionForm>
                {data.movements.length > 0 ? (
                  <ul className="grid gap-1 text-sm">
                    {data.movements.map((movement) => (
                      <li key={movement.id}>
                        {formatDate(movement.movedOn)} · {movement.kind} · {formatEuro(movement.amountCents)} · {movement.note}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            </Section>
            <Section title="Cover">
              <div className="grid gap-2">
                {data.policies.map((policy) => (
                  <Card key={policy.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{policy.label}</p>
                      <p className="text-sm text-muted">
                        {policy.provider} {policy.policyNumber} · {formatEuro(policy.monthlyPremiumCents)} / month {policy.renewalDate ? `· renews ${formatDate(policy.renewalDate)}` : ""}
                      </p>
                      {policy.notes ? <p className="text-xs text-muted">{policy.notes}</p> : null}
                    </div>
                    <ActionForm action={deletePolicy} compact confirm="Remove this policy?">
                      <input type="hidden" name="id" value={policy.id} />
                      <SubmitButton tone="danger">Remove</SubmitButton>
                    </ActionForm>
                  </Card>
                ))}
              </div>
              <Card className="mt-3">
                <ActionForm action={addPolicy} resetOnSuccess>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name"><TextInput name="label" /></Field>
                    <Field label="Kind">
                      <SelectInput name="kind" defaultValue="health">
                        <option value="health">Health and care</option>
                        <option value="liability">Liability</option>
                        <option value="contents">Contents</option>
                        <option value="legal">Legal</option>
                        <option value="other">Other</option>
                      </SelectInput>
                    </Field>
                    <Field label="Provider"><TextInput name="provider" /></Field>
                    <Field label="Policy number"><TextInput name="policyNumber" /></Field>
                    <Field label="Monthly premium"><TextInput name="premium" inputMode="decimal" /></Field>
                    <Field label="Renewal"><TextInput name="renewalDate" type="date" /></Field>
                  </div>
                  <Field label="Notes"><TextArea name="notes" /></Field>
                  <SubmitButton>Add policy</SubmitButton>
                </ActionForm>
              </Card>
            </Section>
            <div className="mt-8">
              <Disclaimer />
            </div>
          </>
        );
      }}
    </ViewGate>
  );
}
