"use client";

import Link from "next/link";
import { deleteDraft, recordPayment, saveBuyerReference, voidInvoice } from "@/server/actions";
import type { invoiceView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { isKleinunternehmerNote } from "@/domain/invoice";
import { xrechnungStatusBlocker } from "@/domain/xrechnung";
import { formatEuro, formatPercentBps, formatQuantity } from "@/domain/money";
import { queryKeys, viewPath } from "@/client/query-keys";
import { euroInput } from "@/components/amounts";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { buttonClass, Card, Disclaimer, Field, LinkButton, Money, PageHeader, Pill, textLinkClass, TextInput } from "@/components/ui";

type Invoice = NonNullable<ReturnType<typeof invoiceView>>;

export function InvoiceScreen({ id }: { id: number }) {
  const query = useView<Invoice>(queryKeys.invoice(id), viewPath.invoice(id));
  const { t, tx, label } = useI18n();
  return (
    <ViewGate query={query}>
      {(loaded) => {
        const { invoice, customer, lines, payments, grossCents, openCents, displayStatus: status } = loaded;
        const kleinunternehmer = isKleinunternehmerNote(invoice.exemptionNote);
        return (
          <>
            <PageHeader
              title={invoice.number ?? t("common.draft")}
              lede={`${customer.name} · ${t("invoices.issued", { date: formatDate(invoice.issueDate) })} · ${t("invoices.dueShort", { date: formatDate(invoice.dueDate) })}`}
              action={
                <span className="flex flex-wrap gap-2">
                  <Pill tone={status}>{label(status)}</Pill>
                  <LinkButton href={`/invoices/${invoice.id}/print`} tone="quiet">{t("common.print")}</LinkButton>
                </span>
              }
            />
            <div className="grid gap-2">
              {lines.map((line) => (
                <Card key={line.id} className={`grid gap-1 sm:items-center ${kleinunternehmer ? "sm:grid-cols-[1fr_auto_auto]" : "sm:grid-cols-[1fr_auto_auto_auto]"}`}>
                  <p className="text-sm">{line.description || t("invoices.untitled")}</p>
                  <p className="text-sm text-muted">
                    {formatQuantity(line.quantityMilli)} × {formatEuro(line.unitNetCents)}
                  </p>
                  {kleinunternehmer ? null : <p className="text-sm text-muted">{formatPercentBps(line.vatBps)}</p>}
                  <Money cents={line.netCents} />
                </Card>
              ))}
            </div>
            <p className="mt-4 font-mono text-sm tabular-nums">
              {kleinunternehmer
                ? t("invoices.totalsKlein", { gross: formatEuro(grossCents), open: formatEuro(openCents) })
                : t("invoices.totals", { net: formatEuro(loaded.netCents), vat: formatEuro(loaded.vatCents), gross: formatEuro(grossCents), open: formatEuro(openCents) })}
            </p>
            {invoice.exemptionNote ? <p className="mt-2 text-sm">{invoice.exemptionNote}</p> : null}
            {invoice.notes ? <p className="mt-2 text-sm text-muted">{invoice.notes}</p> : null}
            {invoice.status === "void" ? (
              <p className="mt-4 text-sm text-muted">{tx(xrechnungStatusBlocker("void") ?? "")}</p>
            ) : (
              <Card className="mt-6">
                <h2 className="text-xl">{t("invoices.xrechnungTitle")}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t("invoices.xrechnungBody")}</p>
                {invoice.status === "draft" ? <p className="mt-3 text-sm">{t("invoices.xrechnungAfterIssue")}</p> : (
                  <ActionForm action={saveBuyerReference} className="mt-4 grid gap-3">
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <Field label={t("invoices.buyerReference")} hint={t("invoices.buyerReferenceHint")}>
                      <TextInput name="buyerReference" defaultValue={invoice.buyerReference} maxLength={100} />
                    </Field>
                    <SubmitButton tone="quiet">{t("invoices.saveBuyerReference")}</SubmitButton>
                  </ActionForm>
                )}
                {loaded.eInvoiceBlockers.length > 0 ? (
                  <ul className="mt-3 grid gap-1 text-sm text-amber">
                    {loaded.eInvoiceBlockers.map((item) => (
                      <li key={item}>{tx(item)}</li>
                    ))}
                  </ul>
                ) : invoice.status !== "draft" ? (
                  <a className={`${buttonClass()} mt-3`} href={`/invoices/${invoice.id}/xrechnung`} download>
                    {t("invoices.downloadXrechnung")}
                  </a>
                ) : null}
                <div className="mt-4">
                  <Disclaimer>{t("invoices.xrechnungDisclaimer")}</Disclaimer>
                </div>
              </Card>
            )}
            {invoice.status === "draft" && loaded.blockers.length > 0 ? (
              <ul className="mt-4 grid gap-1 text-sm text-clay">
                {loaded.blockers.map((item) => (
                  <li key={item}>{tx(item)}</li>
                ))}
              </ul>
            ) : null}
            {invoice.status === "draft" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <LinkButton href={`/invoices/${invoice.id}/edit`}>{t("invoices.continue")}</LinkButton>
                <ActionForm action={deleteDraft} compact confirm={t("invoices.deleteConfirm")}>
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <SubmitButton tone="danger">{t("invoices.deleteDraft")}</SubmitButton>
                </ActionForm>
              </div>
            ) : null}
            {invoice.status !== "draft" && invoice.status !== "void" && openCents > 0 ? (
              <Card className="mt-6">
                <h2 className="mb-3 text-xl">{t("invoices.payment")}</h2>
                <ActionForm action={recordPayment}>
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t("common.amount")} hint={t("invoices.openHint", { amount: formatEuro(openCents) })}>
                      <TextInput name="amount" inputMode="decimal" defaultValue={euroInput(openCents)} />
                    </Field>
                    <Field label={t("common.date")}>
                      <TextInput name="paidOn" type="date" defaultValue={loaded.today} />
                    </Field>
                  </div>
                  <SubmitButton>{t("invoices.recordPayment")}</SubmitButton>
                </ActionForm>
              </Card>
            ) : null}
            {payments.length > 0 ? (
              <ul className="mt-4 grid gap-1 text-sm">
                {payments.map((payment) => (
                  <li key={payment.id}>
                    {formatDate(payment.paidOn)} · {formatEuro(payment.amountCents)}
                  </li>
                ))}
              </ul>
            ) : null}
            {invoice.status !== "draft" && invoice.status !== "void" ? (
              <div className="mt-6">
                <ActionForm action={voidInvoice} confirm={t("invoices.voidConfirm")}>
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <SubmitButton tone="danger">{t("invoices.void")}</SubmitButton>
                </ActionForm>
              </div>
            ) : null}
            <p className="mt-6">
              <Link href="/invoices" className={textLinkClass}>
                {t("invoices.all")}
              </Link>
            </p>
            <div className="mt-6">
              <Disclaimer>{t("disclaimer.void")}</Disclaimer>
            </div>
          </>
        );
      }}
    </ViewGate>
  );
}
