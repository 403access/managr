import "server-only";
import {
  CURRENCY_CODES,
  DOCUMENT_TYPE_CODES,
  EAS_SCHEME_CODES,
  FacturX,
  PAYMENT_MEANS_CODES,
  TAX_CATEGORY_CODES,
  UNIT_CODES,
  totalsCalculator,
  type COUNTRY_ID_CODES,
  type ComfortProfile,
  type SupportedLocales,
  type TotalsCalculatorInputType,
} from "factur-x-kit";
import { parseIso } from "@/domain/calendar";
import { isCorporation, legalFormLabel } from "@/domain/company";
import { normalizeCustomerKind } from "@/domain/customers";
import {
  BUYER_REFERENCE_FALLBACK,
  countryCode,
  reviewXRechnung,
  xrechnungStatusBlocker,
  type XRechnungInput,
} from "@/domain/xrechnung";
import { loadInvoice } from "./queries";
import { toXRechnungInput } from "./xrechnung";
import { zugferdPdfTemplate } from "./zugferd-pdf";

type Company = NonNullable<ReturnType<typeof loadInvoice>>["company"];
type Loaded = NonNullable<ReturnType<typeof loadInvoice>>;

/** Factur-X/ZUGFeRD is the same EN 16931 invoice as the XRechnung, in CII instead of UBL. */
export function toZugferdInput(input: XRechnungInput, locale: SupportedLocales = "de-DE"): TotalsCalculatorInputType {
  const kind = normalizeCustomerKind(input.customerKind);
  const reference = input.buyerReference.trim() || (kind === "business" ? BUYER_REFERENCE_FALLBACK : "");
  const sellerVat = input.seller.vatId.trim().toUpperCase();
  const sellerTaxNumber = input.seller.taxNumber.trim();
  // BR-CO-26: without a VAT id or a register entry, the tax number must also be the seller identifier (BT-29).
  const sellerId = !sellerVat && !input.seller.registerNumber.trim() && sellerTaxNumber ? [sellerTaxNumber] : [];
  const buyerVat = input.buyer.vatId.trim().toUpperCase();
  const exemptionRates = input.byRate.filter((rate) => rate.vatBps === 0);
  const legal = legalInformation(input);
  const taxExemptionReason: { reason: string; categoryCode: typeof TAX_CATEGORY_CODES.EXEMPT_FROM_TAX }[] =
    exemptionRates.length > 0 && input.exemptionNote.trim()
      ? exemptionRates.map(() => ({
          reason: input.exemptionNote.trim(),
          categoryCode: TAX_CATEGORY_CODES.EXEMPT_FROM_TAX,
        }))
      : [];

  return {
    document: {
      id: input.number.trim(),
      type: DOCUMENT_TYPE_CODES.COMMERCIAL_INVOICE,
      dateOfIssue: ciiDate(input.issueDate),
      currency: CURRENCY_CODES.Euro,
      ...(input.notes.trim() ? { notes: [{ content: input.notes.trim() }] } : {}),
    },
    seller: {
      name: input.seller.name.trim(),
      postalAddress: {
        addressLineOne: input.seller.street.trim(),
        postcode: input.seller.postalCode.trim(),
        city: input.seller.city.trim(),
        country: isoCountry(input.seller.country),
      },
      universalCommunicationAddressURI: {
        id: input.seller.email.trim(),
        scheme: EAS_SCHEME_CODES.Electronic_mail_SMPT,
      },
      ...(sellerId.length > 0 ? { id: sellerId } : {}),
      ...(sellerVat || sellerTaxNumber
        ? {
            taxIdentification: {
              ...(sellerVat ? { vatId: sellerVat } : {}),
              ...(sellerTaxNumber ? { localTaxId: sellerTaxNumber } : {}),
            },
          }
        : {}),
      ...(input.seller.registerNumber.trim()
        ? { specifiedLegalOrganization: { id: { id: input.seller.registerNumber.trim() } } }
        : {}),
      ...(legal ? { otherLegalInformation: legal } : {}),
      ...(input.seller.managingDirector.trim() || input.seller.phone.trim()
        ? {
            tradeContact: [
              {
                ...(input.seller.managingDirector.trim() ? { personName: input.seller.managingDirector.trim() } : {}),
                ...(input.seller.phone.trim() ? { telephoneNumber: input.seller.phone.trim() } : {}),
                email: input.seller.email.trim(),
              },
            ],
          }
        : {}),
    },
    buyer: {
      name: input.buyer.name.trim(),
      postalAddress: {
        addressLineOne: input.buyer.street.trim(),
        postcode: input.buyer.postalCode.trim(),
        city: input.buyer.city.trim(),
        country: isoCountry(input.buyer.country),
      },
      universalCommunicationAddressURI: {
        id: input.buyer.email.trim(),
        scheme: EAS_SCHEME_CODES.Electronic_mail_SMPT,
      },
      ...(reference ? { reference } : {}),
      ...(buyerVat ? { taxIdentification: { vatId: buyerVat } } : {}),
    },
    paymentInformation: {
      paymentMeans: [
        {
          paymentType: PAYMENT_MEANS_CODES.SEPA_credit_transfer,
          payeeBankAccount: {
            iban: input.seller.iban.replace(/\s/g, "").toUpperCase(),
            ...(input.seller.bic.trim() ? { bic: input.seller.bic.replace(/\s/g, "").toUpperCase() } : {}),
            accountName: input.seller.name.trim(),
          },
        },
      ],
      paymentTerms: {
        description: paymentTerms(input.dueDate, locale),
        dueDate: ciiDate(input.dueDate),
      },
    },
    invoiceLines: input.lines.map((line, index) => ({
      generalLineData: { lineId: String(index + 1) },
      productDescription: { name: line.description.trim() },
      delivery: { itemQuantity: { quantity: line.quantityMilli / 1000, unit: UNIT_CODES.ONE } },
      productPriceAgreement: { productPricing: { basisPricePerItem: line.unitNetCents / 100 } },
      settlement: {
        tax:
          line.vatBps === 0
            ? { categoryCode: TAX_CATEGORY_CODES.EXEMPT_FROM_TAX }
            : { categoryCode: TAX_CATEGORY_CODES.STANDARD_RATE, rateApplicablePercent: line.vatBps / 100 },
      },
    })),
    totals: {
      ...(input.prepaidCents > 0 ? { prepaidAmount: input.prepaidCents / 100 } : {}),
      ...(taxExemptionReason.length > 0 ? { taxExemptionReason } : {}),
    },
  };
}

export function zugferdFilename(number: string): string {
  const safe = number.trim().replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${safe || "rechnung"}-zugferd.pdf`;
}

export type ZugferdResult = { filename: string; pdf: Uint8Array } | { blockers: string[] };

/** Renders the CII XML and the PDF/A-3 invoice that carries it. */
export async function zugferdPdf(input: XRechnungInput, locale: SupportedLocales): Promise<ZugferdResult> {
  const review = reviewXRechnung(input);
  if (review.blockers.length > 0) return { blockers: review.blockers };
  const profile = totalsCalculator(toZugferdInput(input, locale));
  const mismatch = totalsMismatch(input, profile);
  if (mismatch) return { blockers: [mismatch] };
  const facturX = await FacturX.fromObject(profile);
  const pdf = await facturX.getPDF({ locale, pdfTemplate: zugferdPdfTemplate });
  return { filename: zugferdFilename(input.number), pdf };
}

export async function zugferdFile(company: Company, loaded: Loaded, locale: SupportedLocales): Promise<ZugferdResult> {
  const status = xrechnungStatusBlocker(loaded.invoice.status);
  if (status) return { blockers: [status] };
  return zugferdPdf(toXRechnungInput(company, loaded), locale);
}

function paymentTerms(dueDate: string, locale: SupportedLocales): string {
  switch (locale) {
    case "de-DE":
      return `Zahlbar bis ${dueDate} ohne Abzug.`;
    case "fr-FR":
      return `Payable jusqu'au ${dueDate} sans escompte.`;
    default:
      return `Payable by ${dueDate} without deduction.`;
  }
}

function ciiDate(value: string): { year: number; month: number; day: number } {
  const { y, m, d } = parseIso(value);
  return { year: y, month: m, day: d };
}

function isoCountry(value: string): COUNTRY_ID_CODES {
  const code = countryCode(value);
  if (!code) throw new Error(`The country ${value} cannot be written as an ISO code.`);
  return code as COUNTRY_ID_CODES;
}

function legalInformation(input: XRechnungInput): string {
  const form = input.seller.legalForm ?? "ug";
  if (isCorporation(form)) {
    return [
      input.seller.registerCourt.trim(),
      input.seller.registerNumber.trim(),
      input.seller.managingDirector.trim() ? `Geschäftsführer: ${input.seller.managingDirector.trim()}` : "",
    ]
      .filter(Boolean)
      .join(", ");
  }
  return [
    legalFormLabel(form),
    input.seller.managingDirector.trim() ? `Inhaber: ${input.seller.managingDirector.trim()}` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/** The rendered totals must match the stored invoice cent for cent, or no file is written. */
function totalsMismatch(input: XRechnungInput, profile: ComfortProfile): string | null {
  const cents = (value: number) => Math.round(value * 100);
  const taxCents = (profile.totals.taxTotal ?? []).reduce((sum, item) => sum + cents(item.amount), 0);
  if (
    cents(profile.totals.netTotal) !== input.netCents ||
    cents(profile.totals.grossTotal) !== input.grossCents ||
    taxCents !== input.vatCents ||
    cents(profile.totals.openAmount) !== input.grossCents - input.prepaidCents
  ) {
    return "The line totals do not match the invoice total.";
  }
  return null;
}
