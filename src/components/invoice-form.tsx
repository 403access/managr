"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { saveInvoice } from "@/server/actions";
import { addDays, formatDate } from "@/domain/calendar";
import { KLEINUNTERNEHMER_NOTE, reviewInvoice, sortInvoicePositions } from "@/domain/invoice";
import { formatEuro, parseEuroToCents, parseQuantityMilli } from "@/domain/money";
import { REDUCED_VAT_BPS, STANDARD_VAT_BPS } from "@/domain/rates-2026";
import { isSupportedVat, lineNetCents, summarizeVat } from "@/domain/vat";
import { XRECHNUNG_NUMBER_BLOCKER, reviewXRechnung, type XRechnungInput } from "@/domain/xrechnung";
import { InvoiceDocument, type InvoiceDocumentData } from "./invoice-document";
import { useI18n } from "./locale-provider";
import { useUiSettings } from "./settings-provider";
import { ActionForm, SubmitButton } from "./action-form";
import { buttonClass, Card, Field, inputClass, SelectInput } from "./ui";

export type CustomerOption = {
  id: number;
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  email: string;
  vatId: string;
  buyerReference: string;
};

export type Seller = {
  legalName: string;
  legalForm: string;
  street: string;
  postalCode: string;
  city: string;
  taxNumber: string;
  vatId: string;
  registerCourt: string;
  registerNumber: string;
  managingDirector: string;
  iban: string;
  bic: string;
  bankName: string;
  email: string;
  phone: string;
  country: string;
  kleinunternehmer: boolean;
};

export type TimeActivityOption = {
  id: number;
  timeEntryId: number;
  customerId: number;
  entryDate: string;
  projectName: string;
  description: string;
  lineDescription: string;
  quantity: string;
  unitNet: string;
  hourlyRateCents: number | null;
  vatBps: number;
};

type Line = {
  description: string;
  quantity: string;
  unitNet: string;
  vatBps: number;
  timeEntryId?: number | null;
  timeActivityId?: number | null;
  /** The day of the time behind this line; hand-typed lines have none. */
  entryDate?: string | null;
};

type Draft = {
  id: number;
  customerId: number;
  issueDate: string;
  serviceDate: string;
  dueDate: string;
  notes: string;
  buyerReference: string;
  amountDisplay: string;
  lines: Line[];
};

const emptyCustomer = { name: "", street: "", postalCode: "", city: "", country: "Deutschland", email: "", vatId: "" };

export function InvoiceForm({
  seller,
  customers,
  timeActivities,
  today,
  termsDays,
  defaultVatBps,
  draft,
}: {
  seller: Seller;
  customers: CustomerOption[];
  timeActivities: TimeActivityOption[];
  today: string;
  termsDays: number;
  defaultVatBps: number;
  draft?: Draft;
}) {
  const { t, tx } = useI18n();
  const { invoiceLineOrder } = useUiSettings();
  const [mode, setMode] = useState<"existing" | "new">(draft || customers.length > 0 ? "existing" : "new");
  const [customerId, setCustomerId] = useState<number | null>(draft?.customerId ?? customers[0]?.id ?? null);
  const [customer, setCustomer] = useState(emptyCustomer);
  const [issueDate, setIssueDate] = useState(draft?.issueDate ?? today);
  const [serviceDate, setServiceDate] = useState(draft?.serviceDate ?? today);
  const [dueDate, setDueDate] = useState(draft?.dueDate ?? addDays(today, termsDays));
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [buyerReference, setBuyerReference] = useState(draft ? draft.buyerReference : (customers[0]?.buyerReference ?? ""));
  const [amountDisplay, setAmountDisplay] = useState<"net" | "gross">(draft?.amountDisplay === "gross" ? "gross" : "net");
  const [lines, setLines] = useState<Line[]>(() =>
    sortInvoicePositions(
      draft?.lines ?? [{ description: "", quantity: "1", unitNet: "", vatBps: seller.kleinunternehmer ? 0 : defaultVatBps }],
      invoiceLineOrder,
    ),
  );
  const [pendingIntent, setPendingIntent] = useState<"draft" | "issue" | null>(null);
  const confirmedSubmit = useRef(false);
  const previewDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = previewDialog.current;
    if (!dialog) return;
    if (pendingIntent && !dialog.open) dialog.showModal();
    if (!pendingIntent && dialog.open) dialog.close();
  }, [pendingIntent]);

  const chosen = customers.find((item) => item.id === customerId) ?? null;
  const buyer = mode === "existing" && chosen ? chosen : { ...customer, id: 0 };
  const customerActivities = useMemo(
    () => (mode === "existing" && customerId !== null ? timeActivities.filter((item) => item.customerId === customerId) : []),
    [customerId, mode, timeActivities],
  );
  const selectedActivityIds = useMemo(
    () => new Set(lines.map((line) => line.timeActivityId).filter((id): id is number => typeof id === "number")),
    [lines],
  );

  const pricedLines = useMemo(
    () =>
      lines.map((line) => {
        const quantityMilli = parseQuantityMilli(line.quantity);
        const unitNetCents = parseEuroToCents(line.unitNet);
        const vatBps = seller.kleinunternehmer ? 0 : line.vatBps;
        const valid = quantityMilli !== null && quantityMilli > 0 && unitNetCents !== null && unitNetCents >= 0 && isSupportedVat(vatBps);
        return {
          description: line.description,
          quantityMilli: quantityMilli ?? 0,
          unitNetCents: unitNetCents ?? 0,
          vatBps,
          netCents: valid ? lineNetCents(quantityMilli!, unitNetCents!) : 0,
          valid,
        };
      }),
    [lines, seller.kleinunternehmer],
  );

  const preview = useMemo(() => {
    if (!pricedLines.every((line) => line.valid)) return null;
    try {
      return summarizeVat(pricedLines.map((line) => ({ netCents: line.netCents, vatBps: line.vatBps })), seller.kleinunternehmer);
    } catch {
      return null;
    }
  }, [pricedLines, seller.kleinunternehmer]);

  const previewDocument = useMemo<InvoiceDocumentData>(() => {
    const documentLines = pricedLines.map(({ description, quantityMilli, unitNetCents, vatBps, netCents }) => ({
      description,
      quantityMilli,
      unitNetCents,
      vatBps: isSupportedVat(vatBps) ? vatBps : 0,
      netCents,
    }));
    const totals = summarizeVat(
      documentLines.map((line) => ({ netCents: line.netCents, vatBps: line.vatBps })),
      seller.kleinunternehmer,
    );
    return {
      number: null,
      status: "draft",
      seller: {
        legalName: seller.legalName,
        legalForm: seller.legalForm,
        street: seller.street,
        postalCode: seller.postalCode,
        city: seller.city,
        email: seller.email,
        taxNumber: seller.taxNumber,
        vatId: seller.vatId,
        registerCourt: seller.registerCourt,
        registerNumber: seller.registerNumber,
        managingDirector: seller.managingDirector,
        iban: seller.iban,
        bic: seller.bic,
        bankName: seller.bankName,
      },
      buyer: {
        name: buyer.name,
        street: buyer.street,
        postalCode: buyer.postalCode,
        city: buyer.city,
        vatId: buyer.vatId,
      },
      issueDate,
      serviceDate,
      dueDate,
      notes,
      exemptionNote: seller.kleinunternehmer ? KLEINUNTERNEHMER_NOTE : "",
      buyerReference,
      amountDisplay,
      lines: documentLines,
      ...totals,
    };
  }, [amountDisplay, buyer.name, buyer.postalCode, buyer.street, buyer.city, buyer.vatId, buyerReference, dueDate, issueDate, notes, pricedLines, seller, serviceDate]);

  const review = reviewInvoice({
    legalName: seller.legalName,
    legalForm: seller.legalForm,
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

  const eInvoiceWarnings = useMemo(() => {
    if (!preview) return [];
    const linesForFile = lines.flatMap((line) => {
      const quantityMilli = parseQuantityMilli(line.quantity);
      const unitNetCents = parseEuroToCents(line.unitNet);
      if (quantityMilli === null || unitNetCents === null || quantityMilli <= 0 || unitNetCents < 0) return [];
      const vatBps = seller.kleinunternehmer ? 0 : line.vatBps;
      if (!isSupportedVat(vatBps)) return [];
      return [{ description: line.description, quantityMilli, unitNetCents, netCents: lineNetCents(quantityMilli, unitNetCents), vatBps }];
    });
    if (linesForFile.length !== lines.length) return [];
    const input: XRechnungInput = {
      number: "",
      issueDate,
      dueDate,
      serviceDate,
      buyerReference,
      notes,
      exemptionNote: seller.kleinunternehmer ? KLEINUNTERNEHMER_NOTE : "",
      seller: {
        name: seller.legalName,
        legalForm: seller.legalForm,
        street: seller.street,
        postalCode: seller.postalCode,
        city: seller.city,
        country: seller.country,
        email: seller.email,
        vatId: seller.vatId,
        phone: seller.phone,
        taxNumber: seller.taxNumber,
        registerCourt: seller.registerCourt,
        registerNumber: seller.registerNumber,
        managingDirector: seller.managingDirector,
        iban: seller.iban,
        bic: seller.bic,
      },
      buyer: {
        name: buyer.name,
        street: buyer.street,
        postalCode: buyer.postalCode,
        city: buyer.city,
        country: buyer.country,
        email: buyer.email,
        vatId: buyer.vatId,
      },
      lines: linesForFile,
      byRate: preview.byRate,
      netCents: preview.netCents,
      vatCents: preview.vatCents,
      grossCents: preview.grossCents,
      prepaidCents: 0,
    };
    return reviewXRechnung(input).blockers.filter((item) => item !== XRECHNUNG_NUMBER_BLOCKER && !review.blockers.includes(item));
  }, [buyer, buyerReference, dueDate, issueDate, lines, notes, preview, review.blockers, seller, serviceDate]);

  const payload = JSON.stringify({
    invoiceId: draft?.id ?? null,
    customerMode: mode,
    customerId,
    newCustomer: customer,
    issueDate,
    serviceDate,
    dueDate,
    notes,
    buyerReference,
    amountDisplay,
    lines: lines.map((line) => ({ ...line, vatBps: seller.kleinunternehmer ? 0 : line.vatBps })),
  });

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function addActivity(activity: TimeActivityOption) {
    setLines((current) => {
      if (current.some((line) => line.timeActivityId === activity.id)) return current;
      const onlyBlank = current.length === 1 && !current[0].description.trim() && !current[0].unitNet.trim();
      const base = onlyBlank ? [] : current;
      return sortInvoicePositions(
        [
          ...base,
          {
            description: activity.lineDescription,
            quantity: activity.quantity,
            unitNet: activity.unitNet,
            vatBps: activity.vatBps,
            timeEntryId: activity.timeEntryId,
            timeActivityId: activity.id,
            entryDate: activity.entryDate,
          },
        ],
        invoiceLineOrder,
      );
    });
  }

  function removeActivity(id: number) {
    setLines((current) => current.filter((line) => line.timeActivityId !== id));
  }

  function toggleActivity(activity: TimeActivityOption) {
    if (selectedActivityIds.has(activity.id)) removeActivity(activity.id);
    else addActivity(activity);
  }

  function selectAllActivities() {
    customerActivities.filter((activity) => !selectedActivityIds.has(activity.id)).forEach(addActivity);
  }

  function clearActivities() {
    const ids = new Set(customerActivities.map((activity) => activity.id));
    setLines((current) => current.filter((line) => line.timeActivityId == null || !ids.has(line.timeActivityId)));
  }

  return (
    <ActionForm
      action={saveInvoice}
      className="@container grid gap-4"
      onSubmit={() => {
        if (confirmedSubmit.current) {
          confirmedSubmit.current = false;
          setPendingIntent(null);
          return true;
        }
        setPendingIntent("draft");
        return false;
      }}
    >
      <input type="hidden" name="payload" value={payload} />
      {seller.kleinunternehmer ? (
        <Card className="border-pine/30 bg-pine/5">
          <p className="text-sm font-medium">{t("invoices.kleinActive")}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">{t("invoices.kleinActiveHint")}</p>
        </Card>
      ) : (
        <p className="text-xs leading-relaxed text-muted">
          {t("invoices.kleinInactiveHint")}{" "}
          <Link href="/company#tax" className="font-medium text-pine underline underline-offset-2">{t("invoices.kleinSettings")}</Link>
        </p>
      )}
      <div className="grid gap-3 @[30rem]:grid-cols-2">
        <Field label={t("invoices.customer")}>
          <select className={inputClass} value={mode === "new" ? "new" : String(customerId ?? "")} onChange={(event) => {
            if (event.target.value === "new") setMode("new");
            else {
              setMode("existing");
              const nextId = Number(event.target.value);
              setCustomerId(nextId);
              const next = customers.find((item) => item.id === nextId);
              if (next) setBuyerReference(next.buyerReference);
            }
          }}>
            {customers.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
            <option value="new">{t("invoices.newCustomer")}</option>
          </select>
        </Field>
      </div>
      {mode === "new" ? (
        <div className="grid gap-3 @[30rem]:grid-cols-2">
          <Field label={t("common.name")}><input className={inputClass} value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} /></Field>
          <Field label={t("common.street")}><input className={inputClass} value={customer.street} onChange={(event) => setCustomer({ ...customer, street: event.target.value })} /></Field>
          <Field label={t("common.postal")}><input className={inputClass} value={customer.postalCode} onChange={(event) => setCustomer({ ...customer, postalCode: event.target.value })} /></Field>
          <Field label={t("common.city")}><input className={inputClass} value={customer.city} onChange={(event) => setCustomer({ ...customer, city: event.target.value })} /></Field>
          <Field label={t("common.country")}><input className={inputClass} value={customer.country} onChange={(event) => setCustomer({ ...customer, country: event.target.value })} /></Field>
          <Field label={t("company.vatId")}><input className={inputClass} value={customer.vatId} onChange={(event) => setCustomer({ ...customer, vatId: event.target.value })} /></Field>
        </div>
      ) : null}
      <Field label={t("invoices.buyerReference")} hint={t("invoices.buyerReferenceHint")}>
        <input className={inputClass} value={buyerReference} maxLength={100} onChange={(event) => setBuyerReference(event.target.value)} />
      </Field>
      <div className="grid gap-3 @[30rem]:grid-cols-3">
        <Field label={t("invoices.issueDate")}><input className={inputClass} type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></Field>
        <Field label={t("invoices.serviceDate")}><input className={inputClass} type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} /></Field>
        <Field label={t("invoices.dueDate")}><input className={inputClass} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field>
      </div>
      {seller.kleinunternehmer ? null : (
        <Field label={t("invoices.amountDisplay")} hint={t("invoices.amountDisplayHint")}>
          <SelectInput value={amountDisplay} onChange={(event) => setAmountDisplay(event.target.value === "gross" ? "gross" : "net")}>
            <option value="net">{t("invoices.amountDisplayNet")}</option>
            <option value="gross">{t("invoices.amountDisplayGross")}</option>
          </SelectInput>
        </Field>
      )}
      {mode === "existing" ? (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-xl">{t("invoices.timeTitle")}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t("invoices.timeHint")}</p>
            </div>
            {customerActivities.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonClass("quiet")} onClick={selectAllActivities}>
                  {t("invoices.timeSelectAll")}
                </button>
                {customerActivities.some((activity) => selectedActivityIds.has(activity.id)) ? (
                  <button type="button" className={buttonClass("quiet")} onClick={clearActivities}>
                    {t("invoices.timeClear")}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {customerActivities.length === 0 ? (
            <p className="mt-3 text-sm text-muted">{t("invoices.timeEmpty")}</p>
          ) : (
            <div className="mt-3 grid max-h-96 gap-2 overflow-y-auto pr-1">
              {customerActivities.map((activity) => {
                const checked = selectedActivityIds.has(activity.id);
                return (
                  <label
                    key={activity.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${checked ? "border-pine/40 bg-pine/5" : "border-line bg-white hover:border-ink/30"}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 accent-pine"
                      checked={checked}
                      onChange={() => toggleActivity(activity)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{activity.description}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted">
                        {formatDate(activity.entryDate)}
                        {activity.projectName ? ` · ${activity.projectName}` : ""}
                        {` · ${activity.quantity} h`}
                        {` · ${activity.hourlyRateCents === null ? t("invoices.timeNoRate") : `${formatEuro(activity.hourlyRateCents)}/h`}`}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </Card>
      ) : null}
      <div className="grid gap-3">
        {lines.map((line, index) => (
          <div key={index} className="grid gap-3 rounded-2xl border border-line bg-white p-3 @[34rem]:grid-cols-12">
            <label className={`grid gap-1 text-sm ${seller.kleinunternehmer ? "@[34rem]:col-span-6" : "@[34rem]:col-span-5"}`}>
              <span className="font-medium">{t("invoices.description")}</span>
              <input className={inputClass} value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} />
            </label>
            <label className="grid gap-1 text-sm @[34rem]:col-span-2">
              <span className="font-medium">{t("invoices.quantity")}</span>
              <input className={inputClass} inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />
            </label>
            <label className={`grid gap-1 text-sm ${seller.kleinunternehmer ? "@[34rem]:col-span-4" : "@[34rem]:col-span-3"}`}>
              <span className="font-medium">{seller.kleinunternehmer ? t("invoices.unitAmount") : t("invoices.unitNet")}</span>
              <input className={inputClass} inputMode="decimal" value={line.unitNet} onChange={(event) => updateLine(index, { unitNet: event.target.value })} placeholder="0,00" />
            </label>
            {seller.kleinunternehmer ? null : (
              <label className="grid gap-1 text-sm @[34rem]:col-span-2">
                <span className="font-medium">{t("common.vat")}</span>
                <select className={inputClass} value={line.vatBps} onChange={(event) => updateLine(index, { vatBps: Number(event.target.value) })}>
                  <option value={0}>0%</option>
                  <option value={REDUCED_VAT_BPS}>7%</option>
                  <option value={STANDARD_VAT_BPS}>19%</option>
                </select>
              </label>
            )}
            {lines.length > 1 ? (
              <button type="button" className={`${buttonClass("quiet")} @[34rem]:col-span-12`} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>
                {t("invoices.removeLine")}
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" className={buttonClass("quiet")} onClick={() => setLines((current) => [...current, { description: "", quantity: "1", unitNet: "", vatBps: seller.kleinunternehmer ? 0 : defaultVatBps }])}>
          {t("invoices.addLine")}
        </button>
      </div>
      <Field label={t("common.notes")}>
        <textarea className={`${inputClass} min-h-24 py-3`} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      {preview ? (
        <p className="font-mono text-sm tabular-nums">
          {seller.kleinunternehmer
            ? t("invoices.previewKlein", { gross: formatEuro(preview.grossCents) })
            : amountDisplay === "gross"
              ? t("invoices.previewGross", { net: formatEuro(preview.netCents), vat: formatEuro(preview.vatCents), gross: formatEuro(preview.grossCents) })
              : t("invoices.preview", { net: formatEuro(preview.netCents), vat: formatEuro(preview.vatCents), gross: formatEuro(preview.grossCents) })}
        </p>
      ) : (
        <p className="text-sm text-muted">{seller.kleinunternehmer ? t("invoices.previewEmptyKlein") : t("invoices.previewEmpty")}</p>
      )}
      <Card className="bg-card/60">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl">{t("invoices.previewTitle")}</h2>
          <p className="text-xs leading-relaxed text-muted">{t("invoices.previewHint")}</p>
        </div>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white p-4">
          <InvoiceDocument data={previewDocument} stamp="VORSCHAU" className="mx-auto max-w-3xl" />
        </div>
      </Card>
      {review.blockers.length > 0 ? (
        <ul className="grid gap-1 text-sm text-clay">
          {review.blockers.map((item) => <li key={item}>{tx(item)}</li>)}
        </ul>
      ) : null}
      {review.warnings.length > 0 ? (
        <ul className="grid gap-1 text-sm text-amber">
          {review.warnings.map((item) => <li key={item}>{tx(item)}</li>)}
        </ul>
      ) : null}
      {eInvoiceWarnings.length > 0 ? (
        <div className="grid gap-1">
          <p className="text-sm text-amber">{t("invoices.xrechnungWarnings")}</p>
          <ul className="grid gap-1 text-sm text-amber">
            {eInvoiceWarnings.map((item) => <li key={item}>{tx(item)}</li>)}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass("quiet")} onClick={() => setPendingIntent("draft")}>{t("invoices.saveDraft")}</button>
        <button type="button" className={buttonClass()} onClick={() => setPendingIntent("issue")}>{t("invoices.issue")}</button>
      </div>
      <dialog
        ref={previewDialog}
        onClose={() => setPendingIntent(null)}
        aria-labelledby="invoice-preview-heading"
        className="m-auto max-h-[90dvh] w-[min(56rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-paper p-0 text-ink backdrop:bg-ink/40"
      >
        {pendingIntent ? (
          <div className="grid gap-4 p-5 md:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted uppercase">{t("invoices.previewEyebrow")}</p>
                <h2 id="invoice-preview-heading" className="mt-1 text-2xl leading-tight text-ink">
                  {pendingIntent === "issue" ? t("invoices.previewBeforeIssue") : t("invoices.previewBeforeDraft")}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{t("invoices.previewCheck")}</p>
              </div>
              <button
                type="button"
                aria-label={t("common.close")}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink hover:border-ink"
                onClick={() => setPendingIntent(null)}
              >
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-line bg-white p-4">
              <InvoiceDocument data={previewDocument} stamp="VORSCHAU" className="mx-auto max-w-3xl" />
            </div>
            {pendingIntent === "issue" && review.blockers.length > 0 ? (
              <div className="grid gap-1 rounded-2xl border border-clay/30 bg-clay/5 p-3">
                <p className="text-sm font-medium text-clay">{t("invoices.issueBlocked")}</p>
                <ul className="grid gap-1 text-sm text-clay">
                  {review.blockers.map((item) => <li key={item}>{tx(item)}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={buttonClass("quiet")} onClick={() => setPendingIntent(null)}>{t("common.back")}</button>
              {pendingIntent === "issue" && review.blockers.length > 0 ? null : (
                <SubmitButton
                  name="intent"
                  value={pendingIntent}
                  onClick={() => {
                    confirmedSubmit.current = true;
                  }}
                >
                  {pendingIntent === "issue" ? t("invoices.confirmIssue") : t("invoices.confirmDraft")}
                </SubmitButton>
              )}
            </div>
          </div>
        ) : null}
      </dialog>
    </ActionForm>
  );
}
