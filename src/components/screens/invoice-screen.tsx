"use client";

import Link from "next/link";
import { deleteDraft, recordPayment, voidInvoice } from "@/server/actions";
import type { invoiceView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { formatEuro, formatPercentBps, formatQuantity } from "@/domain/money";
import { queryKeys, viewPath } from "@/client/query-keys";
import { euroInput } from "@/components/amounts";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Disclaimer, Field, LinkButton, Money, PageHeader, Pill, textLinkClass, TextInput } from "@/components/ui";

type Invoice = NonNullable<ReturnType<typeof invoiceView>>;

export function InvoiceScreen({ id }: { id: number }) {
  const query = useView<Invoice>(queryKeys.invoice(id), viewPath.invoice(id));
  return (
    <ViewGate query={query}>
      {(loaded) => {
        const { invoice, customer, lines, payments, grossCents, openCents, displayStatus: status } = loaded;
        return (
          <>
            <PageHeader
              title={invoice.number ?? "Draft"}
              lede={`${customer.name} · issued ${formatDate(invoice.issueDate)} · due ${formatDate(invoice.dueDate)}`}
              action={
                <span className="flex flex-wrap gap-2">
                  <Pill tone={status}>{status}</Pill>
                  <LinkButton href={`/invoices/${invoice.id}/print`} tone="quiet">Print</LinkButton>
                </span>
              }
            />
            <div className="grid gap-2">
              {lines.map((line) => (
                <Card key={line.id} className="grid gap-1 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                  <p className="text-sm">{line.description || "Untitled line"}</p>
                  <p className="text-sm text-muted">
                    {formatQuantity(line.quantityMilli)} × {formatEuro(line.unitNetCents)}
                  </p>
                  <p className="text-sm text-muted">{formatPercentBps(line.vatBps)}</p>
                  <Money cents={line.netCents} />
                </Card>
              ))}
            </div>
            <p className="mt-4 font-mono text-sm tabular-nums">
              Net {formatEuro(loaded.netCents)} · VAT {formatEuro(loaded.vatCents)} · Gross {formatEuro(grossCents)} · Open {formatEuro(openCents)}
            </p>
            {invoice.exemptionNote ? <p className="mt-2 text-sm">{invoice.exemptionNote}</p> : null}
            {invoice.notes ? <p className="mt-2 text-sm text-muted">{invoice.notes}</p> : null}
            {invoice.status === "draft" && loaded.blockers.length > 0 ? (
              <ul className="mt-4 grid gap-1 text-sm text-clay">
                {loaded.blockers.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {invoice.status === "draft" ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <LinkButton href={`/invoices/${invoice.id}/edit`}>Continue draft</LinkButton>
                <ActionForm action={deleteDraft} compact confirm="Delete this draft?">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <SubmitButton tone="danger">Delete draft</SubmitButton>
                </ActionForm>
              </div>
            ) : null}
            {invoice.status !== "draft" && invoice.status !== "void" && openCents > 0 ? (
              <Card className="mt-6">
                <h2 className="mb-3 text-xl">Payment</h2>
                <ActionForm action={recordPayment}>
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Amount" hint={`Open ${formatEuro(openCents)}`}>
                      <TextInput name="amount" inputMode="decimal" defaultValue={euroInput(openCents)} />
                    </Field>
                    <Field label="Date">
                      <TextInput name="paidOn" type="date" defaultValue={loaded.today} />
                    </Field>
                  </div>
                  <SubmitButton>Record payment</SubmitButton>
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
                <ActionForm action={voidInvoice} confirm="Void this invoice? The ledger is reversed. This does not create a credit note.">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                  <SubmitButton tone="danger">Void invoice</SubmitButton>
                </ActionForm>
              </div>
            ) : null}
            <p className="mt-6">
              <Link href="/invoices" className={textLinkClass}>
                All invoices
              </Link>
            </p>
            <div className="mt-6">
              <Disclaimer>A void reverses the journal. It is not a credit-note PDF and it does not reuse the number.</Disclaimer>
            </div>
          </>
        );
      }}
    </ViewGate>
  );
}
