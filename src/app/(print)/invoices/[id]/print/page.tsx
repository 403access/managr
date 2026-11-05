import { notFound } from "next/navigation";
import { loadInvoice } from "@/server/queries";
import { formatDate } from "@/domain/calendar";
import { isCorporation, legalFormLabel } from "@/domain/company";
import { isKleinunternehmerNote } from "@/domain/invoice";
import { formatEuro, formatPercentBps, formatQuantity } from "@/domain/money";
import { PrintButton } from "@/components/print-button";

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric < 1) notFound();
  const loaded = loadInvoice(numeric);
  if (!loaded) notFound();
  const company = loaded.company;
  const { invoice, customer, lines } = loaded;
  const kleinunternehmer = isKleinunternehmerNote(invoice.exemptionNote);
  const stamp = invoice.status === "void" ? "STORNIERT" : invoice.status === "draft" ? "ENTWURF" : "";

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="no-print mb-6 flex gap-2">
        <PrintButton invoiceId={invoice.id} />
      </div>
      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs tracking-wide text-muted uppercase">Rechnung</p>
          <h1 className="text-3xl">{invoice.number ?? "Entwurf"}</h1>
          {stamp ? <p className="mt-1 text-sm font-medium">{stamp}</p> : null}
        </div>
        <div className="text-right text-sm">
          <p className="font-medium">{company.legalName}</p>
          <p>{company.street}</p>
          <p>{company.postalCode} {company.city}</p>
          <p>{company.email}</p>
        </div>
      </header>
      <div className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted uppercase">An</p>
          <p className="font-medium">{customer.name}</p>
          <p>{customer.street}</p>
          <p>{customer.postalCode} {customer.city}</p>
          {customer.vatId ? <p>USt-IdNr. {customer.vatId}</p> : null}
        </div>
        <dl className="grid grid-cols-2 gap-y-1">
          <dt className="text-muted">Rechnungsdatum</dt><dd>{formatDate(invoice.issueDate)}</dd>
          <dt className="text-muted">Leistungsdatum</dt><dd>{formatDate(invoice.serviceDate)}</dd>
          <dt className="text-muted">Fällig</dt><dd>{formatDate(invoice.dueDate)}</dd>
          {invoice.buyerReference ? <><dt className="text-muted">Käuferreferenz</dt><dd>{invoice.buyerReference}</dd></> : null}
        </dl>
      </div>
      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="py-2 font-medium">Leistung</th>
            <th className="py-2 font-medium">Menge</th>
            <th className="py-2 text-right font-medium">Einzelpreis</th>
            {kleinunternehmer ? null : <th className="py-2 text-right font-medium">USt</th>}
            <th className="py-2 text-right font-medium">{kleinunternehmer ? "Betrag" : "Netto"}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id} className="border-b border-line">
              <td className="py-2">{line.description}</td>
              <td className="py-2">{formatQuantity(line.quantityMilli)}</td>
              <td className="py-2 text-right font-mono">{formatEuro(line.unitNetCents)}</td>
              {kleinunternehmer ? null : <td className="py-2 text-right">{formatPercentBps(line.vatBps)}</td>}
              <td className="py-2 text-right font-mono">{formatEuro(line.netCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 ml-auto grid max-w-xs gap-1 text-sm">
        {kleinunternehmer ? (
          <p className="flex justify-between text-base font-medium"><span>Rechnungsbetrag</span><span className="font-mono">{formatEuro(loaded.grossCents)}</span></p>
        ) : (
          <>
            <p className="flex justify-between"><span>Netto</span><span className="font-mono">{formatEuro(loaded.netCents)}</span></p>
            <p className="flex justify-between"><span>Umsatzsteuer</span><span className="font-mono">{formatEuro(loaded.vatCents)}</span></p>
            <p className="flex justify-between text-base font-medium"><span>Brutto</span><span className="font-mono">{formatEuro(loaded.grossCents)}</span></p>
          </>
        )}
      </div>
      {invoice.exemptionNote ? <p className="mt-6 text-sm">{invoice.exemptionNote}</p> : null}
      {invoice.notes ? <p className="mt-3 text-sm">{invoice.notes}</p> : null}
      <div className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted uppercase">Zahlbar auf</p>
          <p>{company.bankName}</p>
          <p>{company.iban}</p>
          <p>{company.bic}</p>
        </div>
        <div>
          {isCorporation(company.legalForm) ? (
            <>
              <p>{company.registerCourt}, {company.registerNumber}</p>
              <p>Geschäftsführer: {company.managingDirector}</p>
            </>
          ) : (
            <>
              <p>{legalFormLabel(company.legalForm)}</p>
              {company.managingDirector ? <p>Inhaber: {company.managingDirector}</p> : null}
            </>
          )}
          <p>{company.taxNumber ? `Steuernummer ${company.taxNumber}` : ""}</p>
          <p>{company.vatId ? `USt-IdNr. ${company.vatId}` : ""}</p>
        </div>
      </div>
    </main>
  );
}
