"use client";

import { useState } from "react";
import { postPayroll } from "@/server/actions";
import { formatEuro, parseEuroToCents } from "@/domain/money";
import { estimateContributions, payslip } from "@/domain/social";
import { socialInput, type SocialPerson } from "@/server/people";
import { useI18n } from "./locale-provider";
import { ActionForm, SubmitButton } from "./action-form";
import { PayslipTable } from "./payslip-table";
import { Disclaimer, Field, inputClass } from "./ui";

export function PayrollForm({
  person,
  company,
  postedMonths,
  today,
}: {
  person: SocialPerson & { id: number; grossMonthlyCents: number; firstName: string; lastName: string };
  company: { stateCode: string; additionalKvBps: number };
  postedMonths: string[];
  today: string;
}) {
  const { t, tx, label } = useI18n();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [payDate, setPayDate] = useState(today);
  const [gross, setGross] = useState("");
  const [wageTax, setWageTax] = useState("");
  const [payNow, setPayNow] = useState(true);
  const typedGross = gross.trim() ? parseEuroToCents(gross) : person.grossMonthlyCents;
  const estimate = typedGross !== null && typedGross >= 0 ? estimateContributions(socialInput(person, company, typedGross)) : null;
  const wageTaxCents = !estimate || estimate.regime === "minijob" ? 0 : wageTax.trim() ? parseEuroToCents(wageTax) : 0;
  const slip = estimate && wageTaxCents !== null ? payslip(estimate, wageTaxCents) : null;

  return (
    <ActionForm action={postPayroll}>
      <input type="hidden" name="employeeId" value={person.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("people.month")}><input className={inputClass} type="month" name="month" value={month} onChange={(event) => setMonth(event.target.value)} /></Field>
        <Field label={t("people.payDate")}><input className={inputClass} type="date" name="payDate" value={payDate} onChange={(event) => setPayDate(event.target.value)} /></Field>
        <Field label={t("people.grossMonth")} hint={t("people.grossHint")}>
          <input className={inputClass} name="gross" inputMode="decimal" value={gross} onChange={(event) => setGross(event.target.value)} placeholder={t("people.contractGross")} />
        </Field>
        {estimate?.regime === "minijob" ? (
          <p className="self-end text-sm text-muted">{t("people.miniFlat")}</p>
        ) : (
          <Field label={t("people.wageTax")} hint={t("people.wageTaxHint")}>
            <input className={inputClass} name="wageTax" inputMode="decimal" value={wageTax} onChange={(event) => setWageTax(event.target.value)} placeholder="0,00" />
          </Field>
        )}
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="payNow" checked={payNow} onChange={(event) => setPayNow(event.target.checked)} className="size-5 accent-pine" />
        {t("people.payNow")}
      </label>
      {postedMonths.includes(month) ? <p className="text-sm text-clay">{t("people.alreadyPosted")}</p> : null}
      {gross.trim() && typedGross === null ? <p className="text-sm text-clay">{t("people.grossInvalid")}</p> : null}
      {estimate ? (
        <div className="grid gap-2 text-sm">
          <p>{t("people.regimeLine", { regime: label(estimate.regime), payout: slip ? formatEuro(slip.netCents) : "—", cost: formatEuro(estimate.employerCashCents) })}</p>
          {slip ? <PayslipTable payslip={slip} /> : null}
          {estimate.warnings.map((warning) => <p key={warning} className="text-amber">{tx(warning)}</p>)}
        </div>
      ) : null}
      {slip !== null && slip.netCents <= 0 ? <p className="text-sm text-clay">{t("people.netBlocked")}</p> : null}
      <Disclaimer>{t("disclaimer.default")}</Disclaimer>
      <SubmitButton>{t("people.postPayroll")}</SubmitButton>
    </ActionForm>
  );
}
