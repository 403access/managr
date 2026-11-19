import { Fragment } from "react";
import { formatDate } from "@/domain/calendar";
import { isCorporation, legalFormLabel } from "@/domain/company";
import { groupInvoicePositions, isKleinunternehmerNote, sharedHourlyRateCents } from "@/domain/invoice";
import { fillInvoiceLetter, hasInvoiceLetter, invoicePaymentDays, type InvoiceLetter } from "@/domain/invoice-letter";
import { formatEuro, formatPercentBps, formatQuantity } from "@/domain/money";
import type { InvoiceLineGrouping } from "@/domain/settings";
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
  /** The day of the time behind the line; hand-typed lines have none. */
  entryDate?: string | null;
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
  /** The human letter around the positions; empty fields fall back to the plain invoice. */
  letter?: InvoiceLetter | null;
  /** Positions from time can be listed under the day of their work. */
  grouping?: InvoiceLineGrouping;
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
  const grouping = data.grouping ?? "none";
  const showGroups = grouping === "date";
  const documentLines = data.lines.map((line, index) => ({
    ...line,
    key: index,
    displayCents: grossDisplay ? lineAmounts[index]?.grossCents ?? line.netCents : line.netCents,
  }));
  const groups = groupInvoicePositions(documentLines, grouping);
  const hourlyRateCents = sharedHourlyRateCents(data.lines);
  const groupLabel = (entryDate: string | null) => (entryDate ? formatDay(entryDate) : "Ohne Datum");
  const displayStamp = stamp ?? (data.status === "void" ? "STORNIERT" : data.status === "draft" ? "ENTWURF" : "");
  const letter = data.letter && hasInvoiceLetter(data.letter) ? data.letter : null;
  const variables = {
    subject: letter?.subject ?? "",
    amount: formatEuro(data.grossCents),
    days: invoicePaymentDays(data.issueDate, data.dueDate),
    dueDate: formatDay(data.dueDate),
  };

  const totals = (
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
  );

  const bank = (title: string) => (
    <div>
      <p className="text-xs text-muted uppercase">{title}</p>
      <p>{data.seller.bankName}</p>
      <p>{data.seller.iban}</p>
      <p>{data.seller.bic}</p>
    </div>
  );

  const legal = (
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
  );

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

      {letter ? (
        <>
          <div className="mt-8 grid gap-4">
            {letter.subject ? (
              <p><span className="font-medium">Betreff:</span> {letter.subject}</p>
            ) : null}
            {letter.salutation ? <p className="whitespace-pre-line">{letter.salutation}</p> : null}
            {letter.intro ? <p className="whitespace-pre-line">{fillInvoiceLetter(letter.intro, variables)}</p> : null}
            <div>
              <p className="font-medium">Leistungsbeschreibung (Art und Umfang):</p>
              {hourlyRateCents !== null ? (
                <p className="mt-1 text-sm text-muted">
                  Stundensatz: {formatEuro(hourlyRateCents)}/h{grossDisplay ? " netto" : ""}
                </p>
              ) : null}
              <ul className="mt-2 grid gap-1.5">
                {data.lines.length === 0 ? (
                  <li className="text-muted">Noch keine Position.</li>
                ) : groups.map((group) => (
                  <Fragment key={group.key}>
                    {showGroups ? (
                      <li className="mt-2 text-xs font-medium tracking-wide text-muted uppercase">{groupLabel(group.entryDate)}</li>
                    ) : null}
                    {group.positions.map((line) => (
                      <li key={line.key} className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line/60 pb-1.5">
                        <span className="min-w-0">{line.description || "—"}</span>
                        <span className="font-mono text-xs whitespace-nowrap text-muted">
                          {hourlyRateCents !== null
                            ? `${formatQuantity(line.quantityMilli)} h`
                            : `${formatQuantity(line.quantityMilli)} × ${formatEuro(line.unitNetCents)}`}
                          {kleinunternehmer ? "" : ` · ${formatPercentBps(line.vatBps)} USt`}
                          {" · "}
                          <span className="text-ink">{formatEuro(line.displayCents)}</span>
                        </span>
                      </li>
                    ))}
                  </Fragment>
                ))}
              </ul>
            </div>
          </div>
          {totals}
          {data.exemptionNote ? <p className="mt-6">{data.exemptionNote}</p> : null}
          {data.notes ? <p className="mt-3">{data.notes}</p> : null}
          {letter.payment ? <p className="mt-6 whitespace-pre-line">{fillInvoiceLetter(letter.payment, variables)}</p> : null}
          <div className="mt-4">{bank("Bankverbindung")}</div>
          {letter.closing ? <p className="mt-6 whitespace-pre-line">{fillInvoiceLetter(letter.closing, variables)}</p> : null}
          {letter.signature || data.seller.managingDirector ? (
            <div className="mt-8">
              {letter.signature ? <p className="whitespace-pre-line">{fillInvoiceLetter(letter.signature, variables)}</p> : null}
              {data.seller.managingDirector ? <p className="mt-2 font-medium">{data.seller.managingDirector}</p> : null}
            </div>
          ) : null}
          <div className="mt-8 border-t border-line pt-3 text-xs leading-relaxed text-muted">{legal}</div>
        </>
      ) : (
        <>
          {hourlyRateCents !== null ? (
            <p className="mt-8 text-sm text-muted">
              Stundensatz: {formatEuro(hourlyRateCents)}/h{grossDisplay ? " netto" : ""}
            </p>
          ) : null}
          <table className={`${hourlyRateCents !== null ? "mt-2" : "mt-8"} w-full text-sm`}>
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-2 font-medium">Leistung</th>
                <th className="py-2 font-medium">Menge</th>
                {hourlyRateCents === null ? <th className="py-2 text-right font-medium">Einzelpreis</th> : null}
                {kleinunternehmer ? null : <th className="py-2 text-right font-medium">USt</th>}
                <th className="py-2 text-right font-medium">{kleinunternehmer ? "Betrag" : grossDisplay ? "Betrag (brutto)" : "Netto"}</th>
              </tr>
            </thead>
            <tbody>
              {data.lines.length === 0 ? (
                <tr className="border-b border-line">
                  <td className="py-2 text-muted" colSpan={kleinunternehmer ? (hourlyRateCents === null ? 4 : 3) : hourlyRateCents === null ? 5 : 4}>Noch keine Position.</td>
                </tr>
              ) : groups.map((group) => (
                <Fragment key={group.key}>
                  {showGroups ? (
                    <tr>
                      <td colSpan={kleinunternehmer ? (hourlyRateCents === null ? 4 : 3) : hourlyRateCents === null ? 5 : 4} className="pt-4 pb-1 text-xs font-medium tracking-wide text-muted uppercase">
                        {groupLabel(group.entryDate)}
                      </td>
                    </tr>
                  ) : null}
                  {group.positions.map((line) => (
                    <tr key={line.key} className="border-b border-line">
                      <td className="py-2">{line.description || "—"}</td>
                      <td className="py-2">{formatQuantity(line.quantityMilli)}{hourlyRateCents !== null ? " h" : ""}</td>
                      {hourlyRateCents === null ? <td className="py-2 text-right font-mono">{formatEuro(line.unitNetCents)}</td> : null}
                      {kleinunternehmer ? null : <td className="py-2 text-right">{formatPercentBps(line.vatBps)}</td>}
                      <td className="py-2 text-right font-mono">{formatEuro(line.displayCents)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
          {totals}
          {data.exemptionNote ? <p className="mt-6">{data.exemptionNote}</p> : null}
          {data.notes ? <p className="mt-3">{data.notes}</p> : null}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {bank("Zahlbar auf")}
            {legal}
          </div>
        </>
      )}
    </article>
  );
}