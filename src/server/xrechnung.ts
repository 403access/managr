import "server-only";
import { buildXRechnung, reviewXRechnung, xrechnungFilename, xrechnungStatusBlocker, type XRechnungInput } from "@/domain/xrechnung";
import { loadCompany, loadInvoice } from "./queries";

type Company = ReturnType<typeof loadCompany>;
type Loaded = NonNullable<ReturnType<typeof loadInvoice>>;

export function toXRechnungInput(company: Company, loaded: Loaded): XRechnungInput {
  const { invoice, customer } = loaded;
  return {
    number: invoice.number ?? "",
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    serviceDate: invoice.serviceDate,
    buyerReference: invoice.buyerReference,
    notes: invoice.notes,
    exemptionNote: invoice.exemptionNote,
    seller: {
      name: company.legalName,
      street: company.street,
      postalCode: company.postalCode,
      city: company.city,
      country: company.country,
      email: company.email,
      vatId: company.vatId,
      phone: company.phone,
      taxNumber: company.taxNumber,
      registerCourt: company.registerCourt,
      registerNumber: company.registerNumber,
      managingDirector: company.managingDirector,
      iban: company.iban,
      bic: company.bic,
    },
    buyer: {
      name: customer.name,
      street: customer.street,
      postalCode: customer.postalCode,
      city: customer.city,
      country: customer.country,
      email: customer.email,
      vatId: customer.vatId,
    },
    lines: loaded.lines.map((line) => ({
      description: line.description,
      quantityMilli: line.quantityMilli,
      unitNetCents: line.unitNetCents,
      netCents: line.netCents,
      vatBps: line.vatBps,
    })),
    byRate: loaded.byRate,
    netCents: loaded.netCents,
    vatCents: loaded.vatCents,
    grossCents: loaded.grossCents,
    prepaidCents: invoice.status === "void" ? 0 : loaded.paidCents,
  };
}

export function xrechnungFile(company: Company, loaded: Loaded): { filename: string; xml: string } | { blockers: string[] } {
  const status = xrechnungStatusBlocker(loaded.invoice.status);
  if (status) return { blockers: [status] };
  const input = toXRechnungInput(company, loaded);
  const review = reviewXRechnung(input);
  if (review.blockers.length > 0) return { blockers: review.blockers };
  return { filename: xrechnungFilename(input.number), xml: buildXRechnung(input) };
}
