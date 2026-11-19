"use client";

import { addPolicy, addShareholder, addShareholderLoan, addShareholderLoanMovement, createCompany, deletePolicy, deleteShareholder, offsetReserve, payProfitDistribution, recordReserve, switchCompany, updateBank, updateIdentity, updateTaxProfile } from "@/server/actions";
import type { companyView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { LEGAL_FORMS, legalFormLabel } from "@/domain/company";
import { formatEuro, formatPercentBps } from "@/domain/money";
import { KLEINUNTERNEHMER_NOTE } from "@/domain/invoice";
import { GMBH_MINIMUM_CAPITAL_CENTS } from "@/domain/rates-2026";
import { FEDERAL_STATES } from "@/domain/states";
import { queryKeys, viewPath } from "@/client/query-keys";
import { euroInput, percentInput } from "@/components/amounts";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AddSheet } from "@/components/add-sheet";
import { InfoButton } from "@/components/info-sheet";
import { useI18n } from "@/components/locale-provider";
import { ReserveHint } from "@/components/reserve-hint";
import { useView, ViewGate } from "@/components/use-view";
import { Tab, Tabs } from "@/components/tabs";
import { Card, Check, Disclaimer, Field, PageHeader, SelectInput, TextArea, TextInput } from "@/components/ui";

type Company = ReturnType<typeof companyView>;

function LegalFormSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <SelectInput name="legalForm" defaultValue={defaultValue}>
      {LEGAL_FORMS.map((form) => (
        <option key={form} value={form}>
          {legalFormLabel(form)}
        </option>
      ))}
    </SelectInput>
  );
}

export function CompanyScreen() {
  const query = useView<Company>(queryKeys.company, viewPath.company);
  const { t, tx, label, monthName } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => {
        const { company } = data;
        return (
          <>
            <PageHeader
              title={t("company.title")}
              lede={t("company.lede")}
              info={<InfoButton topic="company" />}
              action={
                <AddSheet label={t("common.add")} title={t("common.add")}>
                  <Tabs label={t("tabs.sections")} inline>
                    <Tab id="company" label={t("company.newCompany")}>
                      <p className="mb-3 text-sm leading-relaxed text-muted">{t("company.newCompanyHint")}</p>
                      <ActionForm action={createCompany} reloadOnSuccess>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label={t("company.legalName")}><TextInput name="legalName" /></Field>
                          <Field label={t("company.legalForm")}><LegalFormSelect defaultValue="ug" /></Field>
                          <Field label={t("company.director")}><TextInput name="managingDirector" /></Field>
                          <Field label={t("common.street")}><TextInput name="street" /></Field>
                          <Field label={t("common.postal")}><TextInput name="postalCode" /></Field>
                          <Field label={t("common.city")}><TextInput name="city" /></Field>
                          <Field label={t("company.state")}>
                            <SelectInput name="stateCode" defaultValue="BE">
                              {FEDERAL_STATES.map((state) => (
                                <option key={state.code} value={state.code}>
                                  {state.name}
                                </option>
                              ))}
                            </SelectInput>
                          </Field>
                          <Field label={t("company.founded")}><TextInput name="foundingDate" type="date" defaultValue={data.today} /></Field>
                          <Field label={t("company.taxNumber")}><TextInput name="taxNumber" /></Field>
                          <Field label={t("company.vatId")}><TextInput name="vatId" /></Field>
                          <Field label={t("company.capital")}><TextInput name="shareCapital" inputMode="decimal" /></Field>
                        </div>
                        <SubmitButton>{t("company.addCompany")}</SubmitButton>
                      </ActionForm>
                    </Tab>
                    <Tab id="holder" label={t("company.addHolder")}>
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
                    </Tab>
                    <Tab id="loan" label={t("company.loanAdd")}>
                      <ActionForm action={addShareholderLoan} resetOnSuccess>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label={t("company.loanShareholder")}>
                            <SelectInput name="shareholderId">
                              {data.holders.map((holder) => (
                                <option key={holder.id} value={holder.id}>{holder.name}</option>
                              ))}
                            </SelectInput>
                          </Field>
                          <Field label={t("company.loanLabel")}><TextInput name="label" defaultValue="Gesellschafterdarlehen" /></Field>
                          <Field label={t("common.amount")}><TextInput name="amount" inputMode="decimal" /></Field>
                          <Field label={t("company.loanOpened")}><TextInput name="openedOn" type="date" defaultValue={data.today} /></Field>
                          <Field label={t("company.loanInterest")} hint={t("company.loanInterestHint")}><TextInput name="interest" inputMode="decimal" placeholder="0,00" /></Field>
                        </div>
                        <Field label={t("common.notes")}><TextInput name="notes" /></Field>
                        <SubmitButton>{t("company.loanAddButton")}</SubmitButton>
                      </ActionForm>
                      {data.loans.length > 0 ? (
                        <>
                          <h3 className="mt-5 text-lg">{t("company.loanMovement")}</h3>
                          <ActionForm action={addShareholderLoanMovement} resetOnSuccess>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field label={t("company.loanWhich")}>
                                <SelectInput name="loanId">
                                  {data.loans.map((loan) => (
                                    <option key={loan.id} value={loan.id}>{loan.label} · {loan.shareholderName}</option>
                                  ))}
                                </SelectInput>
                              </Field>
                              <Field label={t("common.kind")}>
                                <SelectInput name="kind" defaultValue="repayment">
                                  <option value="repayment">{label("repayment")}</option>
                                  <option value="drawdown">{label("drawdown")}</option>
                                  <option value="interest">{label("interest")}</option>
                                </SelectInput>
                              </Field>
                              <Field label={t("common.amount")} hint={t("company.loanAmountHint")}><TextInput name="amount" inputMode="decimal" /></Field>
                              <Field label={t("common.date")}><TextInput name="movedOn" type="date" defaultValue={data.today} /></Field>
                            </div>
                            <Check name="paidNow" label={t("company.loanInterestPaid")} hint={t("company.loanInterestPaidHint")} />
                            <Field label={t("common.notes")}><TextInput name="note" /></Field>
                            <SubmitButton>{t("company.loanPost")}</SubmitButton>
                          </ActionForm>
                        </>
                      ) : null}
                    </Tab>
                    <Tab id="policy" label={t("company.addPolicy")}>
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
                    </Tab>
                  </Tabs>
                </AddSheet>
              }
            />
            <Tabs label={t("tabs.sections")}>
            <Tab id="companies" label={t("company.companies")}>
              <div className="grid gap-2">
                {data.companies.map((item) => (
                  <Card key={item.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.legalName}</p>
                      <p className="text-sm text-muted">
                        {legalFormLabel(item.legalForm)}
                        {item.isActive ? ` · ${t("company.active")}` : ""}
                      </p>
                    </div>
                    {item.isActive ? null : (
                      <ActionForm action={switchCompany} compact reloadOnSuccess>
                        <input type="hidden" name="companyId" value={item.id} />
                        <SubmitButton tone="quiet">{t("company.switch")}</SubmitButton>
                      </ActionForm>
                    )}
                  </Card>
                ))}
              </div>
            </Tab>
            <Tab id="identity" label={t("company.identity")}>
              <Card>
                <ActionForm action={updateIdentity}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("company.legalName")} hint={t("company.legalNameHint")}><TextInput name="legalName" defaultValue={company.legalName} /></Field>
                    <Field label={t("company.legalForm")}><LegalFormSelect defaultValue={company.legalForm} /></Field>
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
              <Card className="mb-3">
                <h2 className="text-xl">{t("company.kleinTitle")}</h2>
                <p className="mt-2 text-sm leading-relaxed">
                  {data.klein.eligible ? t("company.kleinEligible") : t("company.kleinIneligible")}
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  {t("company.kleinPrior", {
                    amount: formatEuro(data.klein.priorYearTurnoverCents),
                    limit: formatEuro(data.klein.priorLimitCents),
                  })}
                </p>
                <p className="mt-1 text-sm leading-relaxed">
                  {t("company.kleinCurrent", {
                    year: data.klein.year,
                    amount: formatEuro(data.klein.currentYearTurnoverCents),
                    limit: formatEuro(data.klein.currentLimitCents),
                  })}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{t("company.kleinProxy")}</p>
                {data.klein.notes.length > 0 ? (
                  <div className="mt-3 grid gap-1">
                    {data.klein.notes.map((note) => (
                      <p key={note} className="text-sm leading-relaxed">{tx(note)}</p>
                    ))}
                  </div>
                ) : null}
                <p className="mt-3 text-sm leading-relaxed">{t("company.kleinSentence", { note: KLEINUNTERNEHMER_NOTE })}</p>
                <p className="mt-2 text-sm leading-relaxed">{t("company.kleinProfit")}</p>
              </Card>
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
              <p className="mt-3 text-sm text-muted">{t("company.shareholdersPayable", { amount: formatEuro(data.shareholdersPayable) })}</p>
              <Card className="mt-3">
                <h2 className="text-xl">{t("company.loans")}</h2>
                <p className="mt-1 text-sm text-muted">{t("company.loanTotal", { amount: formatEuro(data.loanTotalCents) })}</p>
                {data.loans.length === 0 ? <p className="mt-3 text-sm text-muted">{t("company.loanNone")}</p> : null}
                {data.loans.map((loan) => (
                  <div key={loan.id} className="mt-3 rounded-xl border border-line bg-white p-3">
                    <p className="font-medium">{loan.label}</p>
                    <p className="text-sm text-muted">
                      {loan.shareholderName} · {t("company.loanLine", {
                        principal: formatEuro(loan.principalCents),
                        outstanding: formatEuro(loan.outstandingCents),
                        interest: formatPercentBps(loan.interestBps),
                      })}
                    </p>
                    <p className="text-xs text-muted">{t("company.loanOpened", { date: formatDate(loan.openedOn) })}</p>
                    {loan.movements.map((movement) => (
                      <p key={movement.id} className="mt-1 text-xs text-muted">
                        {formatDate(movement.movedOn)} · {label(movement.kind)} · {formatEuro(movement.amountCents)}
                        {movement.note ? ` · ${movement.note}` : ""}
                      </p>
                    ))}
                    {loan.review.warnings.map((warning) => (
                      <p key={warning} className="mt-2 text-sm text-amber">{tx(warning)}</p>
                    ))}
                  </div>
                ))}
              </Card>
              <Card className="mt-3">
                <h2 className="text-xl">{t("company.distribution")}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{t("company.distributionBody", { amount: formatEuro(data.retained) })}</p>
                <ActionForm action={payProfitDistribution}>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label={t("common.amount")}><TextInput name="amount" inputMode="decimal" placeholder="0,00" /></Field>
                    <Field label={t("common.date")}><TextInput name="date" type="date" defaultValue={data.today} /></Field>
                  </div>
                  <Field label={t("common.memo")}><TextInput name="memo" /></Field>
                  <Check name="resolved" label={t("company.distributionResolved")} hint={t("company.distributionResolvedHint")} />
                  <SubmitButton>{t("company.distributionPost")}</SubmitButton>
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
