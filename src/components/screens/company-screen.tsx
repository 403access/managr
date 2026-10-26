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
import { useI18n } from "@/components/locale-provider";
import { ReserveHint } from "@/components/reserve-hint";
import { useView, ViewGate } from "@/components/use-view";
import { Tab, Tabs } from "@/components/tabs";
import { Card, Check, Disclaimer, Field, PageHeader, SelectInput, TextArea, TextInput } from "@/components/ui";

type Company = ReturnType<typeof companyView>;

export function CompanyScreen() {
  const query = useView<Company>(queryKeys.company, viewPath.company);
  const { t, label, monthName } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => {
        const { company } = data;
        return (
          <>
            <PageHeader title={t("company.title")} lede={t("company.lede")} />
            <Tabs label={t("tabs.sections")}>
            <Tab id="identity" label={t("company.identity")}>
              <Card>
                <ActionForm action={updateIdentity}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("company.legalName")} hint={t("company.legalNameHint")}><TextInput name="legalName" defaultValue={company.legalName} /></Field>
                    <Field label={t("company.director")}><TextInput name="managingDirector" defaultValue={company.managingDirector} /></Field>
                    <Field label={t("common.street")}><TextInput name="street" defaultValue={company.street} /></Field>
                    <Field label={t("common.postal")}><TextInput name="postalCode" defaultValue={company.postalCode} /></Field>
                    <Field label={t("common.city")}><TextInput name="city" defaultValue={company.city} /></Field>
                    <Field label={t("common.country")}><TextInput name="country" defaultValue={company.country} /></Field>
                    <Field label={t("company.state")}>
                      <SelectInput name="stateCode" defaultValue={company.stateCode}>
                        {FEDERAL_STATES.map((state) => (
                          <option key={state.code} value={state.code}>
                            {state.name}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                    <Field label={t("company.founded")}><TextInput name="foundingDate" type="date" defaultValue={company.foundingDate} /></Field>
                    <Field label={t("company.court")}><TextInput name="registerCourt" defaultValue={company.registerCourt} /></Field>
                    <Field label={t("company.hrb")}><TextInput name="registerNumber" defaultValue={company.registerNumber} /></Field>
                    <Field label={t("common.email")}><TextInput name="email" defaultValue={company.email} /></Field>
                    <Field label={t("common.phone")}><TextInput name="phone" defaultValue={company.phone} /></Field>
                    <Field label={t("common.website")}><TextInput name="website" defaultValue={company.website} /></Field>
                    <Field label={t("company.ihk")}><TextInput name="ihk" defaultValue={company.ihk} /></Field>
                    <Field label={t("company.bg")}><TextInput name="berufsgenossenschaft" defaultValue={company.berufsgenossenschaft} /></Field>
                    <Field label={t("company.capital")} hint={t("company.capitalHint")}><TextInput name="shareCapital" inputMode="decimal" defaultValue={euroInput(company.shareCapitalCents)} /></Field>
                  </div>
                  <SubmitButton>{t("company.saveIdentity")}</SubmitButton>
                </ActionForm>
              </Card>
            </Tab>
            <Tab id="tax" label={t("company.tax")}>
              <Card>
                <ActionForm action={updateTaxProfile}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("company.taxNumber")}><TextInput name="taxNumber" defaultValue={company.taxNumber} /></Field>
                    <Field label={t("company.vatId")}><TextInput name="vatId" defaultValue={company.vatId} /></Field>
                    <Field label={t("company.wid")}><TextInput name="economicId" defaultValue={company.economicId} /></Field>
                    <Field label={t("company.hebesatz")} hint={t("company.hebesatzHint")}><TextInput name="hebesatz" inputMode="numeric" defaultValue={String(company.hebesatzPercent)} /></Field>
                    <Field label={t("company.additionalKv")} hint={t("company.additionalKvHint")}><TextInput name="additionalKv" inputMode="decimal" defaultValue={percentInput(company.additionalKvBps)} /></Field>
                    <Field label={t("company.defaultVat")}>
                      <SelectInput name="defaultVat" defaultValue={String(company.defaultVatBps)}>
                        <option value="0">0%</option>
                        <option value="700">7%</option>
                        <option value="1900">19%</option>
                      </SelectInput>
                    </Field>
                    <Field label={t("company.priorTurnover")} hint={t("company.priorTurnoverHint")}><TextInput name="priorYearRevenue" inputMode="decimal" defaultValue={euroInput(company.priorYearRevenueCents)} /></Field>
                    <Field label={t("company.lossCarry")}><TextInput name="lossCarryforward" inputMode="decimal" defaultValue={euroInput(company.lossCarryforwardCents)} /></Field>
                    <Field label={t("company.fyStart")}>
                      <SelectInput name="fiscalYearStartMonth" defaultValue={String(company.fiscalYearStartMonth)}>
                        {Array.from({ length: 12 }, (_, index) => (
                          <option key={index + 1} value={index + 1}>
                            {monthName(index + 1)}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                  </div>
                  <Check name="kleinunternehmer" label={t("company.klein")} defaultChecked={company.kleinunternehmer} hint={t("company.kleinHint")} />
                  <Check name="vatPermanentExtension" label={t("company.extension")} defaultChecked={company.vatPermanentExtension} hint={t("company.extensionHint")} />
                  <Check name="usesTaxAdvisor" label={t("company.adviser")} defaultChecked={company.usesTaxAdvisor} hint={t("company.adviserHint")} />
                  <SubmitButton>{t("company.saveTax")}</SubmitButton>
                </ActionForm>
              </Card>
            </Tab>
            <Tab id="bank" label={t("company.bank")}>
              <Card>
                <ActionForm action={updateBank}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("company.bankName")}><TextInput name="bankName" defaultValue={company.bankName} /></Field>
                    <Field label="IBAN"><TextInput name="iban" defaultValue={company.iban} /></Field>
                    <Field label="BIC"><TextInput name="bic" defaultValue={company.bic} /></Field>
                    <Field label={t("company.prefix")}><TextInput name="invoicePrefix" defaultValue={company.invoicePrefix} /></Field>
                    <Field label={t("company.terms")}><TextInput name="paymentTermsDays" inputMode="numeric" defaultValue={String(company.paymentTermsDays)} /></Field>
                  </div>
                  <SubmitButton>{t("company.saveBank")}</SubmitButton>
                </ActionForm>
              </Card>
            </Tab>
            <Tab id="shareholders" label={t("company.shareholders")}>
              {data.shareBps !== 10_000 ? <p className="mb-3 text-sm text-amber">{t("company.shareSum", { percent: percentInput(data.shareBps) })}</p> : null}
              <div className="grid gap-2">
                {data.holders.map((holder) => (
                  <Card key={holder.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{holder.name}</p>
                      <p className="text-sm text-muted">
                        {percentInput(holder.shareBps)} % · {t("company.nominal", { amount: formatEuro(holder.nominalCents) })}
                      </p>
                      <p className="text-xs text-muted">{[holder.street, holder.postalCode, holder.city].filter(Boolean).join(", ")}</p>
                    </div>
                    <ActionForm action={deleteShareholder} compact confirm={t("company.removeHolder", { name: holder.name })}>
                      <input type="hidden" name="id" value={holder.id} />
                      <SubmitButton tone="danger">{t("common.remove")}</SubmitButton>
                    </ActionForm>
                  </Card>
                ))}
              </div>
              <Card className="mt-3">
                <ActionForm action={addShareholder} resetOnSuccess>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("common.name")}><TextInput name="name" /></Field>
                    <Field label={t("company.sharePercent")}><TextInput name="share" inputMode="decimal" placeholder="100,00" /></Field>
                    <Field label={t("company.nominalAmount")}><TextInput name="nominal" inputMode="decimal" placeholder="2.500,00" /></Field>
                    <Field label={t("common.street")}><TextInput name="street" /></Field>
                    <Field label={t("common.postal")}><TextInput name="postalCode" /></Field>
                    <Field label={t("common.city")}><TextInput name="city" /></Field>
                  </div>
                  <SubmitButton>{t("company.addHolder")}</SubmitButton>
                </ActionForm>
              </Card>
            </Tab>
            <Tab id="reserve" label={t("company.reserve")}>
              <Card className="grid gap-4">
                <p className="text-sm leading-relaxed">
                  {t("company.reserveBalance", {
                    reserve: formatEuro(data.reserve),
                    minimum: formatEuro(GMBH_MINIMUM_CAPITAL_CENTS),
                    gap: formatEuro(data.gap.gapCents),
                  })}
                  {data.duty ? t("company.reserveOn") : t("company.reserveOff")}
                </p>
                <ReserveHint shareCapitalCents={company.shareCapitalCents} />
                <ActionForm action={recordReserve}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label={t("common.year")}><TextInput name="year" inputMode="numeric" defaultValue={String(Number(data.today.slice(0, 4)) - 1)} /></Field>
                    <Field label={t("common.date")}><TextInput name="movedOn" type="date" defaultValue={data.today} /></Field>
                    <Field label={t("common.amount")}><TextInput name="amount" inputMode="decimal" /></Field>
                  </div>
                  <Field label={t("company.note")}><TextInput name="note" /></Field>
                  <SubmitButton>{t("company.postAllocation")}</SubmitButton>
                </ActionForm>
                <ActionForm action={offsetReserve}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("company.offsetDate")}><TextInput name="movedOn" type="date" defaultValue={data.today} /></Field>
                    <Field label={t("company.offsetAmount")} hint={t("company.offsetHint")}><TextInput name="amount" inputMode="decimal" /></Field>
                  </div>
                  <Field label={t("company.note")}><TextInput name="note" /></Field>
                  <SubmitButton tone="quiet">{t("company.offsetLoss")}</SubmitButton>
                </ActionForm>
                {data.movements.length > 0 ? (
                  <ul className="grid gap-1 text-sm">
                    {data.movements.map((movement) => (
                      <li key={movement.id}>
                        {formatDate(movement.movedOn)} · {label(movement.kind)} · {formatEuro(movement.amountCents)} · {movement.note}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            </Tab>
            <Tab id="cover" label={t("company.cover")}>
              <div className="grid gap-2">
                {data.policies.map((policy) => (
                  <Card key={policy.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{policy.label}</p>
                      <p className="text-sm text-muted">
                        {policy.provider} {policy.policyNumber} · {formatEuro(policy.monthlyPremiumCents)} {t("company.perMonth")}
                        {policy.renewalDate ? ` · ${t("company.renews", { date: formatDate(policy.renewalDate) })}` : ""}
                      </p>
                      {policy.notes ? <p className="text-xs text-muted">{policy.notes}</p> : null}
                    </div>
                    <ActionForm action={deletePolicy} compact confirm={t("company.removePolicy")}>
                      <input type="hidden" name="id" value={policy.id} />
                      <SubmitButton tone="danger">{t("common.remove")}</SubmitButton>
                    </ActionForm>
                  </Card>
                ))}
              </div>
              <Card className="mt-3">
                <ActionForm action={addPolicy} resetOnSuccess>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("common.name")}><TextInput name="label" /></Field>
                    <Field label={t("common.kind")}>
                      <SelectInput name="kind" defaultValue="health">
                        <option value="health">{label("health")}</option>
                        <option value="liability">{label("liability")}</option>
                        <option value="contents">{label("contents")}</option>
                        <option value="legal">{label("legal")}</option>
                        <option value="other">{label("other")}</option>
                      </SelectInput>
                    </Field>
                    <Field label={t("common.provider")}><TextInput name="provider" /></Field>
                    <Field label={t("company.policyNumber")}><TextInput name="policyNumber" /></Field>
                    <Field label={t("company.premium")}><TextInput name="premium" inputMode="decimal" /></Field>
                    <Field label={t("company.renewal")}><TextInput name="renewalDate" type="date" /></Field>
                  </div>
                  <Field label={t("common.notes")}><TextArea name="notes" /></Field>
                  <SubmitButton>{t("company.addPolicy")}</SubmitButton>
                </ActionForm>
              </Card>
            </Tab>
            </Tabs>
            <div className="mt-8">
              <Disclaimer>{t("disclaimer.default")}</Disclaimer>
            </div>
          </>
        );
      }}
    </ViewGate>
  );
}
