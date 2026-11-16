"use client";

import { formatEuro } from "@/domain/money";
import type { Payslip } from "@/domain/social";
import { useI18n } from "./locale-provider";

const rows = [
  ["people.health", "healthCents"],
  ["people.additional", "additionalHealthCents"],
  ["people.care", "careCents"],
  ["people.pension", "pensionCents"],
  ["people.unemployment", "unemploymentCents"],
  ["people.insolvency", "insolvencyCents"],
  ["people.flatTaxRow", "flatTaxCents"],
] as const;

/** Every line of a payslip, employee and employer side. A missing wage tax is shown as open, not as zero. */
export function PayslipTable({ payslip, wageTaxKnown = true }: { payslip: Payslip; wageTaxKnown?: boolean }) {
  const { t } = useI18n();
  const amount = (cents: number) => (cents === 0 ? "—" : formatEuro(cents));
  const shownTax = wageTaxKnown ? payslip.wageTaxCents : 0;
  const netCents = payslip.grossCents - payslip.employee.totalCents - shownTax;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="py-2 font-medium">{t("people.payslip")}</th>
            <th className="py-2 text-right font-medium">{t("people.employee")}</th>
            <th className="py-2 text-right font-medium">{t("people.employer")}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-line">
            <td className="py-2 font-medium">{t("people.grossPay")}</td>
            <td className="py-2 text-right font-mono">{formatEuro(payslip.grossCents)}</td>
            <td className="py-2" />
          </tr>
          {rows.map(([key, field]) => (
            <tr key={field} className="border-b border-line">
              <td className="py-2">{t(key)}</td>
              <td className="py-2 text-right font-mono">{amount(payslip.employee[field])}</td>
              <td className="py-2 text-right font-mono">{amount(payslip.employer[field])}</td>
            </tr>
          ))}
          <tr className="border-b border-line">
            <td className="py-2 font-medium">{t("people.socialTotal")}</td>
            <td className="py-2 text-right font-mono">{amount(payslip.employee.totalCents)}</td>
            <td className="py-2 text-right font-mono">{amount(payslip.employer.totalCents)}</td>
          </tr>
          <tr className="border-b border-line">
            <td className="py-2">{t("people.wageTaxRow")}</td>
            <td className="py-2 text-right font-mono">{wageTaxKnown ? amount(payslip.wageTaxCents) : "—"}</td>
            <td className="py-2" />
          </tr>
          <tr className="border-b border-line">
            <td className="py-2 font-medium">{wageTaxKnown ? t("people.netPay") : t("people.netPayBeforeTax")}</td>
            <td className="py-2 text-right font-mono">{formatEuro(netCents)}</td>
            <td className="py-2" />
          </tr>
          <tr>
            <td className="py-2 font-medium">{t("people.employerCostRow")}</td>
            <td className="py-2" />
            <td className="py-2 text-right font-mono">{formatEuro(payslip.employerCostCents)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}