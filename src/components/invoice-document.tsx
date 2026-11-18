import { formatDate } from "@/domain/calendar";
import { isCorporation, legalFormLabel } from "@/domain/company";
import { isKleinunternehmerNote } from "@/domain/invoice";
import { formatEuro, formatPercentBps, formatQuantity } from "@/domain/money";
import { allocateLineVat, type VatBreakdown } from "@/domain/vat";

export type InvoiceDocumentSeller = {
  legalName: string;
  legalForm: string;
  street: string;
  postalCode: string;
  city: string;
  email: string;
  taxNumber: string;
  vatId: string;
  registerCourt: string;
  registerNumber: string;
  managingDirector: string;
  iban: string;
  bic: string;
  bankName: string;
};

export type InvoiceDocumentBuyer = {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  vatId: string;
};

export type InvoiceDocumentLine = {
  description: string;
  quantityMilli: number;
  unitNetCents: number;
  vatBps: number;
  netCents: number;
};

export type InvoiceDocumentData = {
  number: string | null;
  status: string;
  seller: InvoiceDocumentSeller;
  buyer: InvoiceDocumentBuyer;
  issueDate: string;
  serviceDate: string;
  dueDate: string;
  notes: string;
  exemptionNote: string;
  buyerReference: string;
  amountDisplay: string;
  lines: InvoiceDocumentLine[];
  netCents: number;
  vatCents: number;
  grossCents: number;
  byRate: VatBreakdown[];
};

function formatDay(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : "—";
}

/**
 * The invoice as the customer will see it. Used by the print page and by the
 * live preview in the form, so both stay identical.
 */
export function InvoiceDocument({ data, stamp, className = "" }: { data: InvoiceDocumentData; stamp?: string; className?: string }) {
  const kleinunternehmer = isKleinunternehmerNote(data.exemptionNote);
  const grossDisplay = data.amountDisplay === "gross" && !kleinunternehmer;
  const lineAmounts = allocateLineVat(data.lines.map((line) => ({ netCents: line.netCents, vatBps: line.vatBps })));
  const displayStamp = stamp ?? (data.status === "void" ? "STORNIERT" : data.status === "draft" ? "ENTWURF" : "");

  return (
    <article className={`text-sm text-ink ${className}`}>
      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs tracking-wide text-muted uppercase">Rechnung</p>
          <h1 className="text-3xl">{data.number ?? "Entwurf"}</h1>
          {displayStamp ? <p className="mt-1 text-sm font-medium">{displayStamp}</p> : null}
        </div>
        <div className="text-right">
          <p className="font-medium">{data.seller.legalName}</p>
          <p>{data.seller.street}</p>
          <p>{data.seller.postalCode} {data.seller.city}</p>
          <p>{data.seller.email}</p>
        </div>
      </header>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted uppercase">An</p>
          <p className="font-medium">{data.buyer.name || "—"}</p>
          <p>{data.buyer.street}</p>
          <p>{data.buyer.postalCode} {data.buyer.city}</p>
          {data.buyer.vatId ? <p>USt-IdNr. {data.buyer.vatId}</p> : null}
        </div>
        <dl className="grid grid-cols-2 gap-y-1">
          <dt className="text-muted">Rechnungsdatum</dt><dd>{formatDay(data.issueDate)}</dd>
          <dt className="text-muted">Leistungsdatum</dt><dd>{formatDay(data.serviceDate)}</dd>
          <dt className="text-muted">Fällig</dt><dd>{formatDay(data.dueDate)}</dd>
          {data.buyerReference ? <><dt className="text-muted">Käuferreferenz</dt><dd>{data.buyerReference}</dd></> : null}
        </dl>
      </div>
      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="py-2 font-medium">Leistung</th>
            <th className="py-2 font-medium">Menge</th>
            <th className="py-2 text-right font-medium">Einzelpreis</th>
            {kleinunternehmer ? null : <th className="py-2 text-right font-medium">USt</th>}
            <th className="py-2 text-right font-medium">{kleinunternehmer ? "Betrag" : grossDisplay ? "Betrag (brutto)" : "Netto"}</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.length === 0 ? (
            <tr className="border-b border-line">
              <td className="py-2 text-muted" colSpan={kleinunternehmer ? 4 : 5}>Noch keine Position.</td>
            </tr>
          ) : data.lines.map((line, index) => (
            <tr key={index} className="border-b border-line">
              <td className="py-2">{line.description || "—"}</td>
              <td className="py-2">{formatQuantity(line.quantityMilli)}</td>
              <td className="py-2 text-right font-mono">{formatEuro(line.unitNetCents)}</td>
              {kleinunternehmer ? null : <td className="py-2 text-right">{formatPercentBps(line.vatBps)}</td>}
              <td className="py-2 text-right font-mono">{formatEuro(grossDisplay ? lineAmounts[index]?.grossCents ?? line.netCents : line.netCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 ml-auto grid max-w-xs gap-1">
        {kleinunternehmer ? (
          <p className="flex justify-between text-base font-medium"><span>Rechnungsbetrag</span><span className="font-mono">{formatEuro(data.grossCents)}</span></p>
        ) : grossDisplay ? (
          <>
            <p className="flex justify-between text-base font-medium"><span>Rechnungsbetrag (brutto)</span><span className="font-mono">{formatEuro(data.grossCents)}</span></p>
            <p className="flex justify-between text-muted"><span>davon Netto</span><span className="font-mono">{formatEuro(data.netCents)}</span></p>
            {data.byRate.filter((rate) => rate.vatCents > 0).map((rate) => (
              <p key={rate.vatBps} className="flex justify-between text-muted">
                <span>davon Umsatzsteuer {formatPercentBps(rate.vatBps)}</span>
                <span className="font-mono">{formatEuro(rate.vatCents)}</span>
              </p>
            ))}
          </>
        ) : (
          <>
            <p className="flex justify-between"><span>Netto</span><span className="font-mono">{formatEuro(data.netCents)}</span></p>
            <p className="flex justify-between"><span>Umsatzsteuer</span><span className="font-mono">{formatEuro(data.vatCents)}</span></p>
            <p className="flex justify-between text-base font-medium"><span>Brutto</span><span className="font-mono">{formatEuro(data.grossCents)}</span></p>
          </>
        )}
      </div>
      {data.exemptionNote ? <p className="mt-6">{data.exemptionNote}</p> : null}
      {data.notes ? <p className="mt-3">{data.notes}</p> : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted uppercase">Zahlbar auf</p>
          <p>{data.seller.bankName}</p>
          <p>{data.seller.iban}</p>
          <p>{data.seller.bic}</p>
        </div>
        <div>
          {isCorporation(data.seller.legalForm) ? (
            <>
              <p>{data.seller.registerCourt}, {data.seller.registerNumber}</p>
              <p>Geschäftsführer: {data.seller.managingDirector}</p>
            </>
          ) : (
            <>
              <p>{legalFormLabel(data.seller.legalForm)}</p>
              {data.seller.managingDirector ? <p>Inhaber: {data.seller.managingDirector}</p> : null}
            </>
          )}
          <p>{data.seller.taxNumber ? `Steuernummer ${data.seller.taxNumber}` : ""}</p>
          <p>{data.seller.vatId ? `USt-IdNr. ${data.seller.vatId}` : ""}</p>
        </div>
      </div>
    </article>
  );
}
