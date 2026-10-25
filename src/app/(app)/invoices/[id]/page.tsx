import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDraft, recordPayment, voidInvoice } from "@/server/actions";
import { loadCompany, loadInvoice } from "@/server/queries";
import { formatDate, todayIso } from "@/domain/calendar";
import { reviewInvoice } from "@/domain/invoice";
import { formatEuro, formatPercentBps, formatQuantity } from "@/domain/money";
import { euroInput } from "@/components/amounts";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Disclaimer, Field, LinkButton, Money, PageHeader, Pill, textLinkClass, TextInput } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Invoice ${id}` };
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric < 1) notFound();
  const loaded = loadInvoice(numeric);
  if (!loaded) notFound();
  const company = loadCompany();
  const { invoice, customer, lines, payments, grossCents, openCents, displayStatus: status } = loaded;
  const review = reviewInvoice({
    legalName: company.legalName,
    supplierStreet: company.street,
    supplierPostalCode: company.postalCode,
    supplierCity: company.city,
    taxNumber: company.taxNumber,
    vatId: company.vatId,
    registerCourt: company.registerCourt,
    registerNumber: company.registerNumber,
    managingDirector: company.managingDirector,
    iban: company.iban,
    customerName: customer.name,
    customerStreet: customer.street,
    customerPostalCode: customer.postalCode,
    customerCity: customer.city,
    issueDate: invoice.issueDate,
    serviceDate: invoice.serviceDate,
    lines: lines.map((line) => ({ description: line.description, quantityMilli: line.quantityMilli, netCents: line.netCents })),
    kleinunternehmer: Boolean(invoice.exemptionNote),
    exemptionNote: invoice.exemptionNote,
    vatCents: loaded.vatCents,
  });

  return (
    <>
      <PageHeader
        title={invoice.number ?? "Draft"}
        lede={`${customer.name} · issued ${formatDate(invoice.issueDate)} · due ${formatDate(invoice.dueDate)}`}
        action={<span className="flex flex-wrap gap-2"><Pill tone={status}>{status}</Pill><LinkButton href={`/invoices/${invoice.id}/print`} tone="quiet">Print</LinkButton></span>}
      />
      <div className="grid gap-2">
        {lines.map((line) => (
          <Card key={line.id} className="grid gap-1 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
            <p className="text-sm">{line.description || "Untitled line"}</p>
            <p className="text-sm text-muted">{formatQuantity(line.quantityMilli)} × {formatEuro(line.unitNetCents)}</p>
            <p className="text-sm text-muted">{formatPercentBps(line.vatBps)}</p>
            <Money cents={line.netCents} />
          </Card>
        ))}
      </div>
      <p className="mt-4 font-mono text-sm tabular-nums">Net {formatEuro(loaded.netCents)} · VAT {formatEuro(loaded.vatCents)} · Gross {formatEuro(grossCents)} · Open {formatEuro(openCents)}</p>
      {invoice.exemptionNote ? <p className="mt-2 text-sm">{invoice.exemptionNote}</p> : null}
      {invoice.notes ? <p className="mt-2 text-sm text-muted">{invoice.notes}</p> : null}
      {invoice.status === "draft" && review.blockers.length > 0 ? (
        <ul className="mt-4 grid gap-1 text-sm text-clay">{review.blockers.map((item) => <li key={item}>{item}</li>)}</ul>
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
              <Field label="Amount" hint={`Open ${formatEuro(openCents)}`}><TextInput name="amount" inputMode="decimal" defaultValue={euroInput(openCents)} /></Field>
              <Field label="Date"><TextInput name="paidOn" type="date" defaultValue={todayIso()} /></Field>
            </div>
            <SubmitButton>Record payment</SubmitButton>
          </ActionForm>
        </Card>
      ) : null}
      {payments.length > 0 ? (
        <ul className="mt-4 grid gap-1 text-sm">
          {payments.map((payment) => <li key={payment.id}>{formatDate(payment.paidOn)} · {formatEuro(payment.amountCents)}</li>)}
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
      <p className="mt-6"><Link href="/invoices" className={textLinkClass}>All invoices</Link></p>
      <div className="mt-6"><Disclaimer>A void reverses the journal. It is not a credit-note PDF and it does not reuse the number.</Disclaimer></div>
    </>
  );
}
