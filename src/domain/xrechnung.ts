import { parseIso, formatDate } from "./calendar";
import { isCorporation, legalFormLabel } from "./company";
import { isKleinunternehmerNote, reviewInvoice } from "./invoice";
import { lineNetCents, isSupportedVat } from "./vat";
import { percentOf } from "./money";

/**
 * XRechnung 3.0.2 in UBL is the e-invoice this desk writes (§14 UStG, EN 16931).
 * It is not transmitted, and the KoSIT validator is not run.
 * Quantity is UNECE Rec 20 code C62 ("one"): the invoice has no unit of measure.
 * 19% and 7% are VAT category S, which needs a seller VAT id (BR-S-02).
 * 0% is category E. The exemption sentence is BT-120.
 * BR-DE-15 makes the buyer reference mandatory. A public authority uses the Leitweg-ID there.
 */
export const XRECHNUNG_CUSTOMIZATION_ID = "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0";
export const XRECHNUNG_PROFILE_ID = "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0";
export const XRECHNUNG_UNIT_CODE = "C62";
export const XRECHNUNG_NUMBER_BLOCKER = "The e-invoice needs an invoice number (BT-1).";

const BUYER_REFERENCE_REQUIRED = "The e-invoice needs a buyer reference (BT-10). For a public-sector customer this is the Leitweg-ID.";
const BUYER_REFERENCE_LENGTH = "The buyer reference is too long for BT-10.";
const BUYER_REFERENCE_CHAR = "The buyer reference contains a character the e-invoice cannot carry.";
const XML_ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

export type XRechnungParty = {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  email: string;
  vatId: string;
};

export type XRechnungInput = {
  number: string;
  issueDate: string;
  dueDate: string;
  serviceDate: string;
  buyerReference: string;
  notes: string;
  exemptionNote: string;
  seller: XRechnungParty & {
    legalForm?: string;
    phone: string;
    taxNumber: string;
    registerCourt: string;
    registerNumber: string;
    managingDirector: string;
    iban: string;
    bic: string;
  };
  buyer: XRechnungParty;
  lines: { description: string; quantityMilli: number; unitNetCents: number; netCents: number; vatBps: number }[];
  byRate: { vatBps: number; netCents: number; vatCents: number }[];
  netCents: number;
  vatCents: number;
  grossCents: number;
  prepaidCents: number;
};

export function xrechnungStatusBlocker(status: string): string | null {
  if (status === "draft") return "Issue the invoice before writing an e-invoice.";
  if (status === "void") return "A void invoice is a ledger reversal. The desk does not write a credit note.";
  if (status === "issued" || status === "paid" || status === "partial") return null;
  return "This invoice cannot be written as an e-invoice.";
}

export function buyerReferenceProblem(value: string): string | null {
  const reference = value.trim();
  if (reference.length > 100) return BUYER_REFERENCE_LENGTH;
  if (XML_ILLEGAL.test(reference)) return BUYER_REFERENCE_CHAR;
  return null;
}

export function countryCode(value: string): string | null {
  const trimmed = value.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const code = trimmed.toUpperCase();
    return ISO_ALPHA2.has(code) ? code : null;
  }
  const folded = trimmed
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
  return COUNTRY_NAMES[folded] ?? null;
}

export function isValidIban(value: string): boolean {
  const compact = value.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact) || compact.length > 34) return false;
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const chunk = char >= "A" && char <= "Z" ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of chunk) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

export function isValidBic(value: string): boolean {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value.replace(/\s/g, "").toUpperCase());
}

export function xrechnungFilename(number: string): string {
  const safe = number.trim().replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${safe || "rechnung"}-xrechnung.xml`;
}

export function reviewXRechnung(input: XRechnungInput): { blockers: string[] } {
  const blockers: string[] = [];
  const push = (message: string) => {
    if (!blockers.includes(message)) blockers.push(message);
  };
  const issue = reviewInvoice({
    legalName: input.seller.name,
    legalForm: input.seller.legalForm,
    supplierStreet: input.seller.street,
    supplierPostalCode: input.seller.postalCode,
    supplierCity: input.seller.city,
    taxNumber: input.seller.taxNumber,
    vatId: input.seller.vatId,
    registerCourt: input.seller.registerCourt,
    registerNumber: input.seller.registerNumber,
    managingDirector: input.seller.managingDirector,
    iban: input.seller.iban,
    customerName: input.buyer.name,
    customerStreet: input.buyer.street,
    customerPostalCode: input.buyer.postalCode,
    customerCity: input.buyer.city,
    issueDate: input.issueDate,
    serviceDate: input.serviceDate,
    lines: input.lines.map((line) => ({ description: line.description, quantityMilli: line.quantityMilli, netCents: line.netCents })),
    kleinunternehmer: isKleinunternehmerNote(input.exemptionNote),
    exemptionNote: input.exemptionNote,
    vatCents: input.vatCents,
  });
  for (const blocker of issue.blockers) push(blocker);

  if (!input.number.trim()) push(XRECHNUNG_NUMBER_BLOCKER);
  if (!realDate(input.issueDate) && input.issueDate.trim()) push("The issue date is not a real calendar day.");
  if (!realDate(input.serviceDate) && input.serviceDate.trim()) push("The date of supply is not a real calendar day.");
  if (!realDate(input.dueDate)) push("The e-invoice needs a due date (BT-9).");

  if (!input.buyerReference.trim()) push(BUYER_REFERENCE_REQUIRED);
  else {
    const problem = buyerReferenceProblem(input.buyerReference);
    if (problem) push(problem);
  }

  if (!isMail(input.seller.email)) push("The seller e-mail address is missing or not usable as an electronic address (BT-34).");
  if (!isMail(input.buyer.email)) push("The buyer e-mail address is missing or not usable as an electronic address (BT-49).");
  if (input.seller.phone.replace(/\D/g, "").length < 6) push("The seller contact needs a phone number (BT-42).");

  const sellerCountry = countryCode(input.seller.country);
  const buyerCountry = countryCode(input.buyer.country);
  if (!sellerCountry) push("The seller country cannot be written as an ISO code.");
  if (!buyerCountry) push("The buyer country cannot be written as an ISO code.");

  const sellerVat = input.seller.vatId.trim().toUpperCase();
  const buyerVat = input.buyer.vatId.trim().toUpperCase();
  const standardRated = input.lines.some((line) => line.vatBps !== 0);
  if (standardRated && !sellerVat) push("A standard-rated e-invoice needs the seller VAT id (USt-IdNr., BT-31).");
  if (sellerVat && sellerCountry === "DE" && !/^DE\d{9}$/.test(sellerVat)) {
    push("The seller VAT id must be a German USt-IdNr. (DE and nine digits).");
  } else if (sellerVat && !/^[A-Z]{2}[A-Z0-9]{2,12}$/.test(sellerVat)) {
    push("The seller VAT id must look like a VAT identifier.");
  }
  if (buyerVat && !/^[A-Z]{2}[A-Z0-9]{2,12}$/.test(buyerVat)) push("The buyer VAT id must look like a VAT identifier.");

  if (!isValidIban(input.seller.iban)) push("The e-invoice needs a valid IBAN for the SEPA credit transfer (BT-84).");
  if (input.seller.bic.trim() && !isValidBic(input.seller.bic)) push("The BIC is not usable (BT-86).");

  if (input.lines.some((line) => line.vatBps === 0) && !input.exemptionNote.trim()) {
    push("A 0% line needs an exemption sentence on the e-invoice (BT-120).");
  }

  const texts = [
    input.notes,
    input.exemptionNote,
    input.seller.name,
    input.seller.street,
    input.seller.city,
    input.seller.taxNumber,
    input.seller.registerCourt,
    input.seller.registerNumber,
    input.seller.managingDirector,
    input.buyer.name,
    input.buyer.street,
    input.buyer.city,
    ...input.lines.map((line) => line.description),
  ];
  if (texts.some((text) => XML_ILLEGAL.test(text))) push("A field contains a character the e-invoice cannot carry.");

  let lineNet = 0;
  for (const line of input.lines) {
    if (!isSupportedVat(line.vatBps)) {
      push("Unsupported VAT rate.");
      continue;
    }
    try {
      if (line.netCents !== lineNetCents(line.quantityMilli, line.unitNetCents)) push("The line totals do not match the invoice total.");
    } catch {
      push("The line totals do not match the invoice total.");
    }
    lineNet += line.netCents;
  }
  const rateNet = input.byRate.reduce((sum, rate) => sum + rate.netCents, 0);
  const rateVat = input.byRate.reduce((sum, rate) => sum + rate.vatCents, 0);
  if (lineNet !== input.netCents || rateNet !== input.netCents || input.netCents + input.vatCents !== input.grossCents || rateVat !== input.vatCents) {
    push("The line totals do not match the invoice total.");
  }
  for (const rate of input.byRate) {
    if (!isSupportedVat(rate.vatBps)) {
      push("Unsupported VAT rate.");
      continue;
    }
    if (!Number.isInteger(rate.netCents) || rate.netCents < 0 || rate.vatCents !== percentOf(rate.netCents, rate.vatBps)) {
      push("The VAT amount does not match the rate.");
    }
  }
  if (!Number.isInteger(input.prepaidCents) || input.prepaidCents < 0 || input.prepaidCents > input.grossCents) {
    push("Prepaid amount is larger than the invoice total.");
  }
  return { blockers };
}

export function buildXRechnung(input: XRechnungInput): string {
  const review = reviewXRechnung(input);
  if (review.blockers.length > 0) throw new Error(review.blockers.join(" "));
  const sellerCountry = countryCode(input.seller.country)!;
  const buyerCountry = countryCode(input.buyer.country)!;
  const sellerVat = input.seller.vatId.trim().toUpperCase();
  const buyerVat = input.buyer.vatId.trim().toUpperCase();
  const iban = input.seller.iban.replace(/\s/g, "").toUpperCase();
  const bic = input.seller.bic.replace(/\s/g, "").toUpperCase();
  const rates = [...input.byRate].sort((a, b) => a.vatBps - b.vatBps);
  const payable = input.grossCents - input.prepaidCents;
  const form = input.seller.legalForm ?? "ug";
  const legal = isCorporation(form)
    ? [
        input.seller.registerCourt.trim(),
        input.seller.registerNumber.trim(),
        `Geschäftsführer: ${input.seller.managingDirector.trim()}`,
      ].filter(Boolean).join(", ")
    : [
        legalFormLabel(form),
        input.seller.managingDirector.trim() ? `Inhaber: ${input.seller.managingDirector.trim()}` : "",
      ].filter(Boolean).join(", ");

  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">`,
    tag(1, "cbc:CustomizationID", XRECHNUNG_CUSTOMIZATION_ID),
    tag(1, "cbc:ProfileID", XRECHNUNG_PROFILE_ID),
    tag(1, "cbc:ID", input.number.trim()),
    tag(1, "cbc:IssueDate", input.issueDate),
    tag(1, "cbc:DueDate", input.dueDate),
    tag(1, "cbc:InvoiceTypeCode", "380"),
    ...(input.notes.trim() ? [tag(1, "cbc:Note", input.notes.trim())] : []),
    tag(1, "cbc:DocumentCurrencyCode", "EUR"),
    tag(1, "cbc:BuyerReference", input.buyerReference.trim()),
    party(1, "cac:AccountingSupplierParty", {
      name: input.seller.name.trim(),
      street: input.seller.street.trim(),
      postalCode: input.seller.postalCode.trim(),
      city: input.seller.city.trim(),
      country: sellerCountry,
      email: input.seller.email.trim(),
      vatId: sellerVat,
      taxNumber: input.seller.taxNumber.trim(),
      registerNumber: input.seller.registerNumber.trim(),
      legalForm: legal,
      contactName: input.seller.managingDirector.trim(),
      phone: input.seller.phone.trim(),
    }),
    party(1, "cac:AccountingCustomerParty", {
      name: input.buyer.name.trim(),
      street: input.buyer.street.trim(),
      postalCode: input.buyer.postalCode.trim(),
      city: input.buyer.city.trim(),
      country: buyerCountry,
      email: input.buyer.email.trim(),
      vatId: buyerVat,
      taxNumber: "",
      registerNumber: "",
      legalForm: "",
      contactName: "",
      phone: "",
    }),
    block(1, "cac:Delivery", [tag(2, "cbc:ActualDeliveryDate", input.serviceDate)]),
    block(1, "cac:PaymentMeans", [
      tag(2, "cbc:PaymentMeansCode", "58"),
      block(2, "cac:PayeeFinancialAccount", [
        tag(3, "cbc:ID", iban),
        tag(3, "cbc:Name", input.seller.name.trim()),
        ...(bic ? [block(3, "cac:FinancialInstitutionBranch", [tag(4, "cbc:ID", bic)])] : []),
      ]),
    ]),
    block(1, "cac:PaymentTerms", [tag(2, "cbc:Note", `Zahlbar bis ${formatDate(input.dueDate)} ohne Abzug.`)]),
    block(1, "cac:TaxTotal", [
      money(2, "cbc:TaxAmount", input.vatCents),
      ...rates.map((rate) =>
        block(2, "cac:TaxSubtotal", [
          money(3, "cbc:TaxableAmount", rate.netCents),
          money(3, "cbc:TaxAmount", rate.vatCents),
          taxCategory(3, rate.vatBps, input.exemptionNote.trim()),
        ]),
      ),
    ]),
    block(1, "cac:LegalMonetaryTotal", [
      money(2, "cbc:LineExtensionAmount", input.netCents),
      money(2, "cbc:TaxExclusiveAmount", input.netCents),
      money(2, "cbc:TaxInclusiveAmount", input.grossCents),
      ...(input.prepaidCents > 0 ? [money(2, "cbc:PrepaidAmount", input.prepaidCents)] : []),
      money(2, "cbc:PayableAmount", payable),
    ]),
    ...input.lines.map((line, index) =>
      block(1, "cac:InvoiceLine", [
        tag(2, "cbc:ID", String(index + 1)),
        tag(2, "cbc:InvoicedQuantity", formatQuantity(line.quantityMilli), { unitCode: XRECHNUNG_UNIT_CODE }),
        money(2, "cbc:LineExtensionAmount", line.netCents),
        block(2, "cac:Item", [
          tag(3, "cbc:Name", line.description.trim()),
          taxCategory(3, line.vatBps, "", "cac:ClassifiedTaxCategory"),
        ]),
        block(2, "cac:Price", [money(3, "cbc:PriceAmount", line.unitNetCents)]),
      ]),
    ),
    `</Invoice>`,
  ];
  return `${lines.join("\n")}\n`;
}

function party(
  level: number,
  wrapper: string,
  input: {
    name: string;
    street: string;
    postalCode: string;
    city: string;
    country: string;
    email: string;
    vatId: string;
    taxNumber: string;
    registerNumber: string;
    legalForm: string;
    contactName: string;
    phone: string;
  },
): string {
  const taxSchemes = [
    ...(input.vatId ? [taxScheme(level + 2, input.vatId, "VAT")] : []),
    ...(input.taxNumber ? [taxScheme(level + 2, input.taxNumber, "FC")] : []),
  ];
  const legal = [
    tag(level + 2, "cbc:RegistrationName", input.name),
    ...(input.registerNumber ? [tag(level + 2, "cbc:CompanyID", input.registerNumber)] : []),
    ...(input.legalForm ? [tag(level + 2, "cbc:CompanyLegalForm", input.legalForm)] : []),
  ];
  const contact = input.contactName
    ? [block(level + 2, "cac:Contact", [
        tag(level + 3, "cbc:Name", input.contactName),
        tag(level + 3, "cbc:Telephone", input.phone),
        tag(level + 3, "cbc:ElectronicMail", input.email),
      ])]
    : [];
  return block(level, wrapper, [
    block(level + 1, "cac:Party", [
      tag(level + 2, "cbc:EndpointID", input.email, { schemeID: "EM" }),
      block(level + 2, "cac:PartyName", [tag(level + 3, "cbc:Name", input.name)]),
      block(level + 2, "cac:PostalAddress", [
        tag(level + 3, "cbc:StreetName", input.street),
        tag(level + 3, "cbc:CityName", input.city),
        tag(level + 3, "cbc:PostalZone", input.postalCode),
        block(level + 3, "cac:Country", [tag(level + 4, "cbc:IdentificationCode", input.country)]),
      ]),
      ...taxSchemes,
      block(level + 2, "cac:PartyLegalEntity", legal),
      ...contact,
    ]),
  ]);
}

function taxScheme(level: number, companyId: string, scheme: "VAT" | "FC"): string {
  return block(level, "cac:PartyTaxScheme", [
    tag(level + 1, "cbc:CompanyID", companyId),
    block(level + 1, "cac:TaxScheme", [tag(level + 2, "cbc:ID", scheme)]),
  ]);
}

function taxCategory(level: number, vatBps: number, exemption: string, name = "cac:TaxCategory"): string {
  const exempt = vatBps === 0;
  return block(level, name, [
    tag(level + 1, "cbc:ID", exempt ? "E" : "S"),
    tag(level + 1, "cbc:Percent", formatPercent(vatBps)),
    ...(exempt && exemption ? [tag(level + 1, "cbc:TaxExemptionReason", exemption)] : []),
    block(level + 1, "cac:TaxScheme", [tag(level + 2, "cbc:ID", "VAT")]),
  ]);
}

function money(level: number, name: string, cents: number): string {
  return `${"  ".repeat(level)}<${name} currencyID="EUR">${formatCents(cents)}</${name}>`;
}

function tag(level: number, name: string, value: string, attrs?: Record<string, string>): string {
  const attr = attrs ? Object.entries(attrs).map(([key, item]) => ` ${key}="${xml(item)}"`).join("") : "";
  return `${"  ".repeat(level)}<${name}${attr}>${xml(value)}</${name}>`;
}

function block(level: number, name: string, children: string[]): string {
  const pad = "  ".repeat(level);
  return `${pad}<${name}>\n${children.join("\n")}\n${pad}</${name}>`;
}

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatCents(cents: number): string {
  const abs = Math.abs(cents);
  const text = `${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return cents < 0 ? `-${text}` : text;
}

function formatQuantity(quantityMilli: number): string {
  const whole = Math.trunc(quantityMilli / 1000);
  const frac = quantityMilli % 1000;
  if (frac === 0) return String(whole);
  return `${whole}.${String(frac).padStart(3, "0").replace(/0+$/, "")}`;
}

function formatPercent(bps: number): string {
  if (bps % 100 === 0) return String(bps / 100);
  return `${Math.trunc(bps / 100)}.${String(bps % 100).padStart(2, "0")}`;
}

function realDate(value: string): boolean {
  try {
    parseIso(value);
    return true;
  } catch {
    return false;
  }
}

function isMail(value: string): boolean {
  const mail = value.trim();
  return mail.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
}

const ISO_ALPHA2 = new Set(
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" "),
);

const COUNTRY_NAMES: Record<string, string> = {
  deutschland: "DE",
  germany: "DE",
  oesterreich: "AT",
  austria: "AT",
  schweiz: "CH",
  switzerland: "CH",
  frankreich: "FR",
  france: "FR",
  niederlande: "NL",
  netherlands: "NL",
  belgien: "BE",
  belgium: "BE",
  luxemburg: "LU",
  luxembourg: "LU",
  italien: "IT",
  italy: "IT",
  spanien: "ES",
  spain: "ES",
  polen: "PL",
  poland: "PL",
  daenemark: "DK",
  denmark: "DK",
  schweden: "SE",
  sweden: "SE",
  finnland: "FI",
  finland: "FI",
  irland: "IE",
  ireland: "IE",
  portugal: "PT",
  griechenland: "GR",
  greece: "GR",
  tschechien: "CZ",
  czechia: "CZ",
  "tschechische republik": "CZ",
  ungarn: "HU",
  hungary: "HU",
  slowakei: "SK",
  slovakia: "SK",
  slowenien: "SI",
  slovenia: "SI",
  kroatien: "HR",
  croatia: "HR",
  rumaenien: "RO",
  romania: "RO",
  bulgarien: "BG",
  bulgaria: "BG",
  estland: "EE",
  estonia: "EE",
  lettland: "LV",
  latvia: "LV",
  litauen: "LT",
  lithuania: "LT",
  malta: "MT",
  zypern: "CY",
  cyprus: "CY",
  "vereinigtes koenigreich": "GB",
  grossbritannien: "GB",
  "united kingdom": "GB",
  norwegen: "NO",
  norway: "NO",
  island: "IS",
  iceland: "IS",
  liechtenstein: "LI",
  "vereinigte staaten": "US",
  usa: "US",
  "united states": "US",
};
