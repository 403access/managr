"use client";

import { useMemo, useState } from "react";
import { saveInvoice } from "@/server/actions";
import { addDays } from "@/domain/calendar";
import { KLEINUNTERNEHMER_NOTE, reviewInvoice } from "@/domain/invoice";
import { formatEuro, parseEuroToCents, parseQuantityMilli } from "@/domain/money";
import { REDUCED_VAT_BPS, STANDARD_VAT_BPS } from "@/domain/rates-2026";
import { isSupportedVat, lineNetCents, summarizeVat } from "@/domain/vat";
import { ActionForm, SubmitButton } from "./action-form";
import { buttonClass, Field, inputClass } from "./ui";

export type CustomerOption = {
  id: number;
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  email: string;
  vatId: string;
};

export type Seller = {
  legalName: string;
  street: string;
  postalCode: string;
  city: string;
  taxNumber: string;
  vatId: string;
  registerCourt: string;
  registerNumber: string;
  managingDirector: string;
  iban: string;
  kleinunternehmer: boolean;
};

type Line = { description: string; quantity: string; unitNet: string; vatBps: number };

type Draft = {
  id: number;
  customerId: number;
  issueDate: string;
  serviceDate: string;
  dueDate: string;
  notes: string;
  lines: Line[];
};

const emptyCustomer = { name: "", street: "", postalCode: "", city: "", country: "Deutschland", email: "", vatId: "" };

export function InvoiceForm({
  seller,
  customers,
  today,
  termsDays,
  defaultVatBps,
  draft,
}: {
  seller: Seller;
  customers: CustomerOption[];
  today: string;
  termsDays: number;
  defaultVatBps: number;
  draft?: Draft;
}) {
  const [mode, setMode] = useState<"existing" | "new">(draft || customers.length > 0 ? "existing" : "new");
  const [customerId, setCustomerId] = useState<number | null>(draft?.customerId ?? customers[0]?.id ?? null);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [issueDate, setIssueDate] = useState(draft?.issueDate ?? today);
  const [serviceDate, setServiceDate] = useState(draft?.serviceDate ?? today);
  const [dueDate, setDueDate] = useState(draft?.dueDate ?? addDays(today, termsDays));
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(draft?.lines ?? [{ description: "", quantity: "1", unitNet: "", vatBps: seller.kleinunternehmer ? 0 : defaultVatBps }]);

  const chosen = customers.find((item) => item.id === customerId) ?? null;
  const buyer = mode === "existing" && chosen ? chosen : { ...customer, id: 0 };

  const preview = useMemo(() => {
    try {
      const priced = lines.map((line) => {
        const quantityMilli = parseQuantityMilli(line.quantity);
        const unitNetCents = parseEuroToCents(line.unitNet);
        if (quantityMilli === null || unitNetCents === null) return null;
        const vatBps = seller.kleinunternehmer ? 0 : line.vatBps;
        if (!isSupportedVat(vatBps) || quantityMilli <= 0 || unitNetCents < 0) return null;
        return { description: line.description, quantityMilli, netCents: lineNetCents(quantityMilli, unitNetCents), vatBps };
      });
      if (priced.some((line) => line === null)) return null;
      const ready = priced.filter((line): line is NonNullable<typeof line> => line !== null);
      return summarizeVat(ready.map((line) => ({ netCents: line.netCents, vatBps: line.vatBps })), seller.kleinunternehmer);
    } catch {
      return null;
    }
  }, [lines, seller.kleinunternehmer]);

  const review = reviewInvoice({
    legalName: seller.legalName,
    supplierStreet: seller.street,
    supplierPostalCode: seller.postalCode,
    supplierCity: seller.city,
    taxNumber: seller.taxNumber,
    vatId: seller.vatId,
    registerCourt: seller.registerCourt,
    registerNumber: seller.registerNumber,
    managingDirector: seller.managingDirector,
    iban: seller.iban,
    customerName: buyer.name,
    customerStreet: buyer.street,
    customerPostalCode: buyer.postalCode,
    customerCity: buyer.city,
    issueDate,
    serviceDate,
    lines: lines.map((line) => ({
      description: line.description,
      quantityMilli: parseQuantityMilli(line.quantity) ?? 0,
      netCents: 0,
    })),
    kleinunternehmer: seller.kleinunternehmer,
    exemptionNote: seller.kleinunternehmer ? KLEINUNTERNEHMER_NOTE : "",
    vatCents: preview?.vatCents ?? 0,
  });

  const payload = JSON.stringify({
    invoiceId: draft?.id ?? null,
    customerMode: mode,
    customerId,
    newCustomer: customer,
    issueDate,
    serviceDate,
    dueDate,
    notes,
    lines: lines.map((line) => ({ ...line, vatBps: seller.kleinunternehmer ? 0 : line.vatBps })),
  });

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  return (
    <ActionForm action={saveInvoice}>
      <input type="hidden" name="payload" value={payload} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Customer">
          <select className={inputClass} value={mode === "new" ? "new" : String(customerId ?? "")} onChange={(event) => {
            if (event.target.value === "new") setMode("new");
            else {
              setMode("existing");
              setCustomerId(Number(event.target.value));
            }
          }}>
            {customers.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
            <option value="new">New customer</option>
          </select>
        </Field>
      </div>
      {mode === "new" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><input className={inputClass} value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></Field>
          <Field label="Street"><input className={inputClass} value={customer.street} onChange={(event) => setCustomer({ ...customer, street: event.target.value })} /></Field>
          <Field label="Postal code"><input className={inputClass} value={customer.postalCode} onChange={(event) => setCustomer({ ...customer, postalCode: event.target.value })} /></Field>
          <Field label="City"><input className={inputClass} value={customer.city} onChange={(event) => setCustomer({ ...customer, city: event.target.value })} /></Field>
          <Field label="Country"><input className={inputClass} value={customer.country} onChange={(event) => setCustomer({ ...customer, country: event.target.value })} /></Field>
          <Field label="VAT id"><input className={inputClass} value={customer.vatId} onChange={(event) => setCustomer({ ...customer, vatId: event.target.value })} /></Field>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Issue date"><input className={inputClass} type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></Field>
        <Field label="Date of supply"><input className={inputClass} type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} /></Field>
        <Field label="Due date"><input className={inputClass} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field>
      </div>
      <div className="grid gap-3">
        {lines.map((line, index) => (
          <div key={index} className="grid gap-3 rounded-2xl border border-line bg-white p-3 sm:grid-cols-12">
            <label className="grid gap-1 text-sm sm:col-span-5">
              <span className="font-medium">Description</span>
              <input className={inputClass} value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-medium">Quantity</span>
              <input className={inputClass} inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-3">
              <span className="font-medium">Unit net</span>
              <input className={inputClass} inputMode="decimal" value={line.unitNet} onChange={(event) => updateLine(index, { unitNet: event.target.value })} placeholder="0,00" />
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              <span className="font-medium">VAT</span>
              <select className={inputClass} value={seller.kleinunternehmer ? 0 : line.vatBps} disabled={seller.kleinunternehmer} onChange={(event) => updateLine(index, { vatBps: Number(event.target.value) })}>
                <option value={0}>0%</option>
                <option value={REDUCED_VAT_BPS}>7%</option>
                <option value={STANDARD_VAT_BPS}>19%</option>
              </select>
            </label>
            {lines.length > 1 ? (
              <button type="button" className={`${buttonClass("quiet")} sm:col-span-12`} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>
                Remove line
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" className={buttonClass("quiet")} onClick={() => setLines((current) => [...current, { description: "", quantity: "1", unitNet: "", vatBps: seller.kleinunternehmer ? 0 : defaultVatBps }])}>
          Add line
        </button>
      </div>
      <Field label="Notes">
        <textarea className={`${inputClass} min-h-24 py-3`} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      {seller.kleinunternehmer ? <p className="text-sm text-muted">{KLEINUNTERNEHMER_NOTE}</p> : null}
      {preview ? (
        <p className="font-mono text-sm tabular-nums">
          Net {formatEuro(preview.netCents)} · VAT {formatEuro(preview.vatCents)} · Gross {formatEuro(preview.grossCents)}
        </p>
      ) : (
        <p className="text-sm text-muted">Enter quantities and prices to see the total. VAT is rounded once per rate.</p>
      )}
      {review.blockers.length > 0 ? (
        <ul className="grid gap-1 text-sm text-clay">
          {review.blockers.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      {review.warnings.length > 0 ? (
        <ul className="grid gap-1 text-sm text-amber">
          {review.warnings.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="intent" value="draft" tone="quiet">Save draft</SubmitButton>
        <SubmitButton name="intent" value="issue">Issue invoice</SubmitButton>
      </div>
    </ActionForm>
  );
}
