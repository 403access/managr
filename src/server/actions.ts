"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { getDb } from "@/db/client";
import {
  absences,
  companies,
  complianceItems,
  customers,
  customDeadlines,
  documents,
  employees,
  invoiceLines,
  invoices,
  journalEntries,
  obligationStates,
  payments,
  policies,
  reserveMovements,
  resolutions,
  shareholders,
  tasks,
  timeEntries,
} from "@/db/schema";
import { ACCOUNTS, CHART, type DraftLine } from "@/domain/accounts";
import { formatDate, nextDueDate, todayIso, type Recurrence } from "@/domain/calendar";
import { KLEINUNTERNEHMER_NOTE, formatInvoiceNumber, reviewInvoice } from "@/domain/invoice";
import { parseEuroToCents, parseQuantityMilli } from "@/domain/money";
import {
  buildCustomerPayment,
  buildExpense,
  buildPayroll,
  buildReserveAllocation,
  buildReserveLossOffset,
  buildSalesInvoice,
  buildVatPrepayment,
  reverseLines,
} from "@/domain/postings";
import { reserveDutyActive } from "@/domain/reserve";
import { estimateContributions, payrollAmounts } from "@/domain/social";
import { isStateCode } from "@/domain/states";
import { durationMinutes, timeWarnings } from "@/domain/time";
import { isSupportedVat, lineNetCents, summarizeVat } from "@/domain/vat";
import { removeUpload, saveUpload } from "./files";
import { type ActionState, basisPoints, checked, euros, hoursToMinutes, requireDate, text, wholeNumber } from "./form";
import { invoiceMoney } from "./invoice-math";
import { invoicePayloadSchema, journalPayloadSchema, type InvoicePayload } from "./payloads";
import { socialInput } from "./people";
import { entryLines, payrollSourceId, postJournal } from "./posting";
import { accountBalances, signedAccount } from "./queries";

const KINDS = ["regular", "minijob", "midijob", "apprentice", "managing_director"] as const;
const SV = ["automatic", "subject", "exempt"] as const;
const RECURRENCE = ["none", "monthly", "quarterly", "yearly"] as const;
const TASK_STATUS = ["open", "doing", "done"] as const;
const ABSENCE_KIND = ["vacation", "sick", "other"] as const;
const ABSENCE_STATUS = ["approved", "requested", "rejected"] as const;
const POLICY_KIND = ["health", "liability", "contents", "legal", "other"] as const;
const RESOLUTION_KIND = ["formation", "profit", "appointment", "other"] as const;
const DOCUMENT_CATEGORY = ["corporate", "tax", "invoice", "employment", "insurance", "other"] as const;

function saved(message: string): ActionState {
  revalidatePath("/", "layout");
  return { error: "", message };
}

function go(path: string): never {
  revalidatePath("/", "layout");
  redirect(path);
}

function failed(error: unknown): ActionState {
  unstable_rethrow(error);
  if (error instanceof Error) {
    if (/UNIQUE constraint failed/i.test(error.message)) return { error: "That record already exists.", message: "" };
    return { error: error.message, message: "" };
  }
  return { error: "Something went wrong.", message: "" };
}

function oneOf<T extends string>(value: string, allowed: readonly T[], label: string): T {
  const found = allowed.find((item) => item === value);
  if (!found) throw new Error(`${label} is not recognized.`);
  return found;
}

function requiredId(formData: FormData, name = "id"): number {
  const value = wholeNumber(formData, name);
  if (!value) throw new Error("That record was not found.");
  return value;
}

function optionalId(formData: FormData, name = "id"): number | null {
  if (!text(formData, name)) return null;
  return requiredId(formData, name);
}

function requireCompany() {
  const row = getDb().select().from(companies).get();
  if (!row) throw new Error("The company record is missing.");
  return row;
}

function readJson(formData: FormData): unknown {
  try {
    return JSON.parse(text(formData, "payload"));
  } catch {
    throw new Error("The form could not be read. Check the lines and try again.");
  }
}

function pricedLines(lines: InvoicePayload["lines"], klein: boolean) {
  return lines.map((line, index) => {
    const label = line.description || `line ${index + 1}`;
    const quantityMilli = parseQuantityMilli(line.quantity);
    const unitNetCents = parseEuroToCents(line.unitNet);
    if (quantityMilli === null || quantityMilli <= 0) throw new Error(`Quantity is not valid on ${label}.`);
    if (unitNetCents === null || unitNetCents < 0) throw new Error(`Price is not valid on ${label}.`);
    const vatBps = klein ? 0 : line.vatBps;
    if (!isSupportedVat(vatBps)) throw new Error("Unsupported VAT rate.");
    return { description: line.description, quantityMilli, unitNetCents, vatBps, netCents: lineNetCents(quantityMilli, unitNetCents) };
  });
}

export async function dismissSample(): Promise<ActionState> {
  getDb().update(companies).set({ isSample: false }).run();
  return saved("Sample label hidden.");
}

export async function updateIdentity(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const company = requireCompany();
    const legalName = text(formData, "legalName");
    if (!legalName) throw new Error("The company needs its legal name.");
    const shareCapitalCents = euros(formData, "shareCapital");
    if (shareCapitalCents === null || shareCapitalCents < 100) throw new Error("Share capital is in euros. A UG can be formed from €1.");
    const stateCode = text(formData, "stateCode");
    if (!isStateCode(stateCode)) throw new Error("Choose a federal state.");
    getDb()
      .update(companies)
      .set({
        legalName,
        street: text(formData, "street"),
        postalCode: text(formData, "postalCode"),
        city: text(formData, "city"),
        country: text(formData, "country") || "Deutschland",
        stateCode,
        registerCourt: text(formData, "registerCourt"),
        registerNumber: text(formData, "registerNumber"),
        managingDirector: text(formData, "managingDirector"),
        email: text(formData, "email"),
        phone: text(formData, "phone"),
        website: text(formData, "website"),
        ihk: text(formData, "ihk"),
        berufsgenossenschaft: text(formData, "berufsgenossenschaft"),
        foundingDate: requireDate(text(formData, "foundingDate"), "The founding date"),
        shareCapitalCents,
      })
      .where(eq(companies.id, company.id))
      .run();
    return saved("Company record saved. Changing the share capital does not register a capital increase.");
  } catch (error) {
    return failed(error);
  }
}

export async function updateTaxProfile(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const company = requireCompany();
    const hebesatzPercent = wholeNumber(formData, "hebesatz");
    if (hebesatzPercent === null || hebesatzPercent > 900) throw new Error("Hebesatz is a whole percent, such as 410.");
    const additionalKvBps = basisPoints(formData, "additionalKv");
    if (additionalKvBps === null || additionalKvBps > 5000) throw new Error("Additional contribution is a percent, such as 2,90.");
    const defaultVatBps = wholeNumber(formData, "defaultVat");
    if (defaultVatBps === null || !isSupportedVat(defaultVatBps)) throw new Error("Choose 0%, 7%, or 19%.");
    const priorYearRevenueCents = euros(formData, "priorYearRevenue");
    const lossCarryforwardCents = euros(formData, "lossCarryforward");
    if (priorYearRevenueCents === null || lossCarryforwardCents === null) {
      throw new Error("Enter prior-year turnover and the loss carryforward. Use 0 if there is none.");
    }
    const fiscalYearStartMonth = wholeNumber(formData, "fiscalYearStartMonth");
    if (!fiscalYearStartMonth || fiscalYearStartMonth > 12) throw new Error("Choose the first month of the financial year.");
    getDb()
      .update(companies)
      .set({
        taxNumber: text(formData, "taxNumber"),
        vatId: text(formData, "vatId").toUpperCase(),
        economicId: text(formData, "economicId"),
        kleinunternehmer: checked(formData, "kleinunternehmer"),
        vatPermanentExtension: checked(formData, "vatPermanentExtension"),
        usesTaxAdvisor: checked(formData, "usesTaxAdvisor"),
        hebesatzPercent,
        additionalKvBps,
        defaultVatBps,
        priorYearRevenueCents,
        lossCarryforwardCents,
        fiscalYearStartMonth,
      })
      .where(eq(companies.id, company.id))
      .run();
    return saved("Tax profile saved. Waiving or keeping the small-business exemption is a decision to confirm with an adviser.");
  } catch (error) {
    return failed(error);
  }
}

export async function updateBank(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const company = requireCompany();
    const invoicePrefix = text(formData, "invoicePrefix");
    if (!/^[\w./-]{1,12}$/.test(invoicePrefix)) throw new Error("The invoice prefix can use letters, digits, and - . /");
    const paymentTermsDays = wholeNumber(formData, "paymentTermsDays");
    if (paymentTermsDays === null || paymentTermsDays > 180) throw new Error("Payment terms are a number of days, up to 180.");
    getDb()
      .update(companies)
      .set({
        iban: text(formData, "iban").replace(/\s/g, "").toUpperCase(),
        bic: text(formData, "bic").replace(/\s/g, "").toUpperCase(),
        bankName: text(formData, "bankName"),
        invoicePrefix,
        paymentTermsDays,
      })
      .where(eq(companies.id, company.id))
      .run();
    return saved("Bank and invoice settings saved.");
  } catch (error) {
    return failed(error);
  }
}

export async function addShareholder(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const name = text(formData, "name");
    if (!name) throw new Error("The shareholder needs a name.");
    const shareBps = basisPoints(formData, "share");
    if (shareBps === null || shareBps > 10_000) throw new Error("The share is a percent, such as 100.");
    const nominalCents = euros(formData, "nominal");
    if (nominalCents === null) throw new Error("Enter the nominal amount. Use 0 if you only want to record the percent.");
    getDb()
      .insert(shareholders)
      .values({ name, street: text(formData, "street"), postalCode: text(formData, "postalCode"), city: text(formData, "city"), shareBps, nominalCents })
      .run();
    return saved("Shareholder added.");
  } catch (error) {
    return failed(error);
  }
}

export async function deleteShareholder(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    getDb().delete(shareholders).where(eq(shareholders.id, requiredId(formData))).run();
    return saved("Shareholder removed.");
  } catch (error) {
    return failed(error);
  }
}

export async function recordReserve(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const company = requireCompany();
    if (!reserveDutyActive(company.shareCapitalCents)) {
      throw new Error("The statutory reserve duty applies while share capital is below the GmbH minimum.");
    }
    const year = wholeNumber(formData, "year");
    if (!year || year < 2000 || year > 2100) throw new Error("Enter the financial year.");
    const amountCents = euros(formData, "amount");
    if (!amountCents) throw new Error("Enter the amount to allocate.");
    const db = getDb();
    const existing = db
      .select()
      .from(reserveMovements)
      .where(and(eq(reserveMovements.year, year), eq(reserveMovements.kind, "allocation")))
      .get();
    if (existing) throw new Error("That year already has a reserve allocation.");
    const movedOn = requireDate(text(formData, "movedOn"), "The allocation");
    const note = text(formData, "note");
    db.transaction(() => {
      const entryId = postJournal(db, {
        date: movedOn,
        memo: `Statutory reserve ${year}`,
        source: "reserve",
        sourceId: `allocation:${year}`,
        lines: buildReserveAllocation(amountCents),
      });
      db.insert(reserveMovements).values({ year, movedOn, kind: "allocation", amountCents, note, journalEntryId: entryId }).run();
    });
    return saved("Reserve allocation posted.");
  } catch (error) {
    return failed(error);
  }
}

export async function offsetReserve(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const amountCents = euros(formData, "amount");
    if (!amountCents) throw new Error("Enter the amount to offset.");
    const balance = signedAccount(accountBalances(), ACCOUNTS.reserve);
    if (amountCents > balance) throw new Error("The offset is larger than the statutory reserve.");
    const movedOn = requireDate(text(formData, "movedOn"), "The offset");
    const note = text(formData, "note");
    const db = getDb();
    db.transaction(() => {
      const created = db
        .insert(reserveMovements)
        .values({ year: Number(movedOn.slice(0, 4)), movedOn, kind: "offset", amountCents, note, journalEntryId: null })
        .run();
      const id = Number(created.lastInsertRowid);
      const entryId = postJournal(db, {
        date: movedOn,
        memo: note || "Offset statutory reserve against a loss",
        source: "reserve",
        sourceId: `offset:${id}`,
        lines: buildReserveLossOffset(amountCents),
      });
      db.update(reserveMovements).set({ journalEntryId: entryId }).where(eq(reserveMovements.id, id)).run();
    });
    return saved("Loss offset posted. This does not increase share capital.");
  } catch (error) {
    return failed(error);
  }
}

export async function addPolicy(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const label = text(formData, "label");
    if (!label) throw new Error("The policy needs a name.");
    const premiumRaw = text(formData, "premium");
    const monthlyPremiumCents = premiumRaw ? euros(formData, "premium") : 0;
    if (monthlyPremiumCents === null) throw new Error("Premium is an amount in euros. Use 0 if you do not pay monthly.");
    const renewalRaw = text(formData, "renewalDate");
    getDb()
      .insert(policies)
      .values({
        label,
        kind: oneOf(text(formData, "kind"), POLICY_KIND, "Cover"),
        provider: text(formData, "provider"),
        policyNumber: text(formData, "policyNumber"),
        monthlyPremiumCents,
        renewalDate: renewalRaw ? requireDate(renewalRaw, "The renewal") : null,
        notes: text(formData, "notes"),
      })
      .run();
    return saved("Policy saved.");
  } catch (error) {
    return failed(error);
  }
}

export async function deletePolicy(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    getDb().delete(policies).where(eq(policies.id, requiredId(formData))).run();
    return saved("Policy removed.");
  } catch (error) {
    return failed(error);
  }
}

export async function saveCustomer(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const name = text(formData, "name");
    if (!name) throw new Error("The customer needs a name.");
    const values = {
      name,
      street: text(formData, "street"),
      postalCode: text(formData, "postalCode"),
      city: text(formData, "city"),
      country: text(formData, "country") || "Deutschland",
      email: text(formData, "email"),
      vatId: text(formData, "vatId").toUpperCase(),
    };
    const id = optionalId(formData);
    const db = getDb();
    if (id) {
      const existing = db.select().from(customers).where(eq(customers.id, id)).get();
      if (!existing) throw new Error("Customer not found.");
      db.update(customers).set(values).where(eq(customers.id, id)).run();
      return saved("Customer saved.");
    }
    db.insert(customers).values(values).run();
    return saved("Customer added.");
  } catch (error) {
    return failed(error);
  }
}

export async function saveInvoice(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const parsed = invoicePayloadSchema.safeParse(readJson(formData));
    if (!parsed.success) return { error: "The invoice could not be read. Check the lines and dates.", message: "" };
    const payload = parsed.data;
    const intent = text(formData, "intent") === "issue" ? "issue" : "draft";
    const db = getDb();
    const company = requireCompany();
    const lines = pricedLines(payload.lines, company.kleinunternehmer);
    const summary = summarizeVat(
      lines.map((line) => ({ netCents: line.netCents, vatBps: line.vatBps })),
      company.kleinunternehmer,
    );
    const exemptionNote = company.kleinunternehmer ? KLEINUNTERNEHMER_NOTE : "";
    const invoiceId = db.transaction(() => {
      const customerId = resolveCustomer(db, payload);
      const customer = db.select().from(customers).where(eq(customers.id, customerId)).get();
      if (!customer) throw new Error("Choose a customer.");
      if (intent === "issue") {
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
          issueDate: payload.issueDate,
          serviceDate: payload.serviceDate,
          lines: lines.map((line) => ({ description: line.description, quantityMilli: line.quantityMilli, netCents: line.netCents })),
          kleinunternehmer: company.kleinunternehmer,
          exemptionNote,
          vatCents: summary.vatCents,
        });
        if (review.blockers.length > 0) throw new Error(review.blockers.join(" "));
      }
      const header = {
        customerId,
        issueDate: payload.issueDate,
        serviceDate: payload.serviceDate,
        dueDate: payload.dueDate,
        notes: payload.notes.trim(),
        exemptionNote,
      };
      let id = payload.invoiceId;
      if (id) {
        const existing = db.select().from(invoices).where(eq(invoices.id, id)).get();
        if (!existing) throw new Error("Invoice not found.");
        if (existing.status !== "draft") throw new Error("Only a draft can be edited.");
        db.update(invoices).set(header).where(eq(invoices.id, id)).run();
        db.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id)).run();
      } else {
        const created = db.insert(invoices).values({ ...header, number: null, status: "draft", journalEntryId: null }).run();
        id = Number(created.lastInsertRowid);
      }
      lines.forEach((line, index) => {
        db.insert(invoiceLines)
          .values({ invoiceId: id!, position: index + 1, description: line.description, quantityMilli: line.quantityMilli, unitNetCents: line.unitNetCents, vatBps: line.vatBps })
          .run();
      });
      if (intent === "issue") {
        const fresh = db.select().from(companies).where(eq(companies.id, company.id)).get();
        if (!fresh) throw new Error("The company record is missing.");
        const number = formatInvoiceNumber(fresh.invoicePrefix, Number(payload.issueDate.slice(0, 4)), fresh.nextInvoiceSeq);
        db.update(companies).set({ nextInvoiceSeq: fresh.nextInvoiceSeq + 1 }).where(eq(companies.id, fresh.id)).run();
        const entryId = postJournal(db, {
          date: payload.issueDate,
          memo: `Invoice ${number}`,
          source: "invoice",
          sourceId: String(id),
          lines: buildSalesInvoice({ kleinunternehmer: company.kleinunternehmer, byRate: summary.byRate }),
        });
        db.update(invoices).set({ number, status: "issued", journalEntryId: entryId, exemptionNote }).where(eq(invoices.id, id!)).run();
      }
      return id!;
    });
    go(`/invoices/${invoiceId}`);
  } catch (error) {
    return failed(error);
  }
}

function resolveCustomer(db: ReturnType<typeof getDb>, payload: InvoicePayload): number {
  if (payload.customerMode === "existing") {
    if (!payload.customerId) throw new Error("Choose a customer.");
    const customer = db.select().from(customers).where(eq(customers.id, payload.customerId)).get();
    if (!customer) throw new Error("Choose a customer.");
    return customer.id;
  }
  if (!payload.newCustomer.name) throw new Error("The customer needs a name.");
  const created = db
    .insert(customers)
    .values({
      name: payload.newCustomer.name,
      street: payload.newCustomer.street,
      postalCode: payload.newCustomer.postalCode,
      city: payload.newCustomer.city,
      country: payload.newCustomer.country || "Deutschland",
      email: payload.newCustomer.email,
      vatId: payload.newCustomer.vatId.toUpperCase(),
    })
    .run();
  return Number(created.lastInsertRowid);
}

export async function recordPayment(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const id = requiredId(formData, "invoiceId");
    const db = getDb();
    const invoice = db.select().from(invoices).where(eq(invoices.id, id)).get();
    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.status === "draft" || invoice.status === "void") throw new Error("This invoice cannot take a payment.");
    const amountCents = euros(formData, "amount");
    if (!amountCents) throw new Error("Enter the amount received.");
    const paidOn = requireDate(text(formData, "paidOn"), "The payment");
    const openCents = invoiceMoney(db, id).openCents;
    if (amountCents > openCents) throw new Error("That payment is more than the open amount.");
    db.transaction(() => {
      const created = db.insert(payments).values({ invoiceId: id, paidOn, amountCents, journalEntryId: null }).run();
      const paymentId = Number(created.lastInsertRowid);
      const entryId = postJournal(db, {
        date: paidOn,
        memo: `Payment ${invoice.number ?? id}`,
        source: "payment",
        sourceId: String(paymentId),
        lines: buildCustomerPayment(amountCents),
      });
      db.update(payments).set({ journalEntryId: entryId }).where(eq(payments.id, paymentId)).run();
      db.update(invoices)
        .set({ status: amountCents === openCents ? "paid" : "partial" })
        .where(eq(invoices.id, id))
        .run();
    });
    return saved("Payment posted.");
  } catch (error) {
    return failed(error);
  }
}

export async function voidInvoice(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const id = requiredId(formData, "invoiceId");
    const db = getDb();
    const invoice = db.select().from(invoices).where(eq(invoices.id, id)).get();
    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.status === "draft") throw new Error("Delete the draft instead of voiding it.");
    if (invoice.status === "void") throw new Error("This invoice is already void.");
    const today = todayIso();
    db.transaction(() => {
      const money = invoiceMoney(db, id);
      for (const payment of money.payments) {
        if (!payment.journalEntryId) continue;
        postJournal(db, {
          date: today,
          memo: `Reverse payment on ${invoice.number ?? id}`,
          source: "reversal",
          sourceId: `payment:${payment.id}`,
          lines: reverseLines(entryLines(db, payment.journalEntryId)),
        });
      }
      if (invoice.journalEntryId) {
        postJournal(db, {
          date: today,
          memo: `Reverse invoice ${invoice.number ?? id}`,
          source: "reversal",
          sourceId: `invoice:${invoice.id}`,
          lines: reverseLines(entryLines(db, invoice.journalEntryId)),
        });
      }
      db.update(invoices).set({ status: "void" }).where(eq(invoices.id, id)).run();
    });
    return saved("Voided. This is a reversal in the ledger, not a credit-note PDF.");
  } catch (error) {
    return failed(error);
  }
}

export async function deleteDraft(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const id = requiredId(formData, "invoiceId");
    const db = getDb();
    const invoice = db.select().from(invoices).where(eq(invoices.id, id)).get();
    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.status !== "draft" || invoice.journalEntryId) throw new Error("Only a draft can be deleted.");
    db.delete(invoices).where(eq(invoices.id, id)).run();
    go("/invoices");
  } catch (error) {
    return failed(error);
  }
}

export async function saveExpense(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const account = CHART.find((item) => item.code === text(formData, "account") && item.type === "expense");
    if (!account) throw new Error("Choose an expense account.");
    const netCents = euros(formData, "net");
    if (!netCents) throw new Error("Enter the net amount.");
    const vatBps = wholeNumber(formData, "vatBps");
    if (vatBps === null || !isSupportedVat(vatBps)) throw new Error("Choose a VAT rate.");
    const memo = text(formData, "memo");
    if (!memo) throw new Error("Add a short description.");
    const db = getDb();
    postJournal(db, {
      date: requireDate(text(formData, "date"), "The expense"),
      memo,
      source: "expense",
      sourceId: null,
      lines: buildExpense({ expenseAccount: account.code, netCents, vatBps, paidNow: checked(formData, "paidNow") }),
    });
    return saved("Expense posted.");
  } catch (error) {
    return failed(error);
  }
}

export async function saveVatPayment(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const amountCents = euros(formData, "amount");
    if (!amountCents) throw new Error("Enter the amount paid to the tax office.");
    const db = getDb();
    postJournal(db, {
      date: requireDate(text(formData, "date"), "The payment"),
      memo: text(formData, "memo") || "VAT prepayment",
      source: "vat-prepayment",
      sourceId: null,
      lines: buildVatPrepayment(amountCents),
    });
    return saved("VAT prepayment posted to account 1780.");
  } catch (error) {
    return failed(error);
  }
}

export async function saveJournal(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const parsed = journalPayloadSchema.safeParse(readJson(formData));
    if (!parsed.success) return { error: "The journal entry could not be read.", message: "" };
    const lines: DraftLine[] = parsed.data.lines.map((line) => {
      const debitCents = line.debit.trim() ? parseEuroToCents(line.debit) : 0;
      const creditCents = line.credit.trim() ? parseEuroToCents(line.credit) : 0;
      if (debitCents === null || creditCents === null) throw new Error("Check the amounts. Use euros, such as 49,90.");
      return { accountCode: line.accountCode, debitCents, creditCents };
    });
    postJournal(getDb(), { date: parsed.data.date, memo: parsed.data.memo, source: "manual", sourceId: null, lines });
    return saved("Journal entry posted.");
  } catch (error) {
    return failed(error);
  }
}

export async function saveEmployee(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const firstName = text(formData, "firstName");
    const lastName = text(formData, "lastName");
    if (!firstName || !lastName) throw new Error("First and last name are required.");
    const weeklyMinutes = hoursToMinutes(text(formData, "weeklyHours"));
    if (weeklyMinutes === null || weeklyMinutes < 60 || weeklyMinutes > 80 * 60) throw new Error("Weekly hours look wrong.");
    const workdaysPerWeek = wholeNumber(formData, "workdays");
    if (!workdaysPerWeek || workdaysPerWeek > 6) throw new Error("Workdays per week are from 1 to 6.");
    const vacationDays = wholeNumber(formData, "vacationDays");
    if (vacationDays === null || vacationDays > 60) throw new Error("Vacation days are a whole number up to 60.");
    const grossMonthlyCents = euros(formData, "gross");
    if (!grossMonthlyCents) throw new Error("Enter the monthly gross.");
    const ownershipBps = basisPoints(formData, "ownership");
    if (ownershipBps === null || ownershipBps > 10_000) throw new Error("Ownership is a percent, such as 50 or 100.");
    const careDiscountSteps = text(formData, "careSteps") ? wholeNumber(formData, "careSteps") : 0;
    if (careDiscountSteps === null || careDiscountSteps > 4) throw new Error("Care discount steps are from 0 to 4.");
    const additionalRaw = text(formData, "additionalKv");
    let additionalKvBps: number | null = null;
    if (additionalRaw) {
      additionalKvBps = basisPoints(formData, "additionalKv");
      if (additionalKvBps === null || additionalKvBps > 5000) throw new Error("Additional contribution is a percent, such as 2,90.");
    }
    const startDate = requireDate(text(formData, "startDate"), "The start");
    const endRaw = text(formData, "endDate");
    const endDate = endRaw ? requireDate(endRaw, "The end") : null;
    if (endDate && endDate < startDate) throw new Error("The end date is before the start date.");
    const values = {
      firstName,
      lastName,
      role: text(formData, "role"),
      kind: oneOf(text(formData, "kind"), KINDS, "Employment"),
      svStatus: oneOf(text(formData, "svStatus"), SV, "Social-insurance status"),
      ownershipBps,
      street: text(formData, "street"),
      postalCode: text(formData, "postalCode"),
      city: text(formData, "city"),
      email: text(formData, "email"),
      phone: text(formData, "phone"),
      startDate,
      endDate,
      weeklyMinutes,
      workdaysPerWeek,
      vacationDays,
      grossMonthlyCents,
      taxClass: text(formData, "taxClass"),
      taxId: text(formData, "taxId"),
      svNumber: text(formData, "svNumber"),
      churchTax: checked(formData, "churchTax"),
      healthInsuranceName: text(formData, "healthInsuranceName"),
      additionalKvBps,
      childlessSurcharge: checked(formData, "childless"),
      careDiscountSteps,
      minijobPublicHealth: checked(formData, "minijobPublicHealth"),
      pensionOptOut: checked(formData, "pensionOptOut"),
      flatTax: checked(formData, "flatTax"),
      notes: text(formData, "notes"),
    };
    const db = getDb();
    const id = optionalId(formData);
    if (id) {
      const existing = db.select().from(employees).where(eq(employees.id, id)).get();
      if (!existing) throw new Error("Person not found.");
      db.update(employees).set(values).where(eq(employees.id, id)).run();
      go(`/people/${id}`);
    }
    const created = db.insert(employees).values(values).run();
    go(`/people/${Number(created.lastInsertRowid)}`);
  } catch (error) {
    return failed(error);
  }
}

export async function addAbsence(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const employeeId = requiredId(formData, "employeeId");
    const employee = getDb().select().from(employees).where(eq(employees.id, employeeId)).get();
    if (!employee) throw new Error("Person not found.");
    const startDate = requireDate(text(formData, "startDate"), "The start");
    const endDate = requireDate(text(formData, "endDate"), "The end");
    if (endDate < startDate) throw new Error("The end date is before the start date.");
    getDb()
      .insert(absences)
      .values({
        employeeId,
        startDate,
        endDate,
        kind: oneOf(text(formData, "kind"), ABSENCE_KIND, "Absence"),
        status: oneOf(text(formData, "status"), ABSENCE_STATUS, "Status"),
        notes: text(formData, "notes"),
      })
      .run();
    return saved("Absence saved.");
  } catch (error) {
    return failed(error);
  }
}

export async function deleteAbsence(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    getDb().delete(absences).where(eq(absences.id, requiredId(formData))).run();
    return saved("Absence removed.");
  } catch (error) {
    return failed(error);
  }
}

export async function postPayroll(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const employeeId = requiredId(formData, "employeeId");
    const db = getDb();
    const employee = db.select().from(employees).where(eq(employees.id, employeeId)).get();
    if (!employee) throw new Error("Person not found.");
    const company = requireCompany();
    const month = text(formData, "month");
    if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Choose the payroll month.");
    const payDate = requireDate(text(formData, "payDate"), "The pay date");
    const gross = text(formData, "gross") ? euros(formData, "gross") : employee.grossMonthlyCents;
    if (!gross) throw new Error("Enter the monthly gross.");
    const sourceId = payrollSourceId(employeeId, month);
    const duplicate = db.select().from(journalEntries).where(and(eq(journalEntries.source, "payroll"), eq(journalEntries.sourceId, sourceId))).get();
    if (duplicate) throw new Error("Payroll for this person and month is already posted.");
    const estimate = estimateContributions(socialInput(employee, company, gross));
    let wageTax = 0;
    if (estimate.regime !== "minijob") {
      if (!text(formData, "wageTax")) throw new Error("Enter the wage tax from the Lohnabrechnung. Use 0 if none was withheld.");
      const parsed = euros(formData, "wageTax");
      if (parsed === null) throw new Error("Wage tax is not a valid amount.");
      wageTax = parsed;
    }
    const amounts = payrollAmounts(estimate, wageTax);
    postJournal(db, {
      date: payDate,
      memo: `Payroll ${employee.lastName} ${month}`,
      source: "payroll",
      sourceId,
      lines: buildPayroll({ ...amounts, grossCents: gross, payNow: checked(formData, "payNow") }),
    });
    return saved(`Payroll for ${month} posted. Wage tax was entered, not calculated.`);
  } catch (error) {
    return failed(error);
  }
}

export async function saveTask(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const title = text(formData, "title");
    if (!title) throw new Error("The task needs a title.");
    const dueRaw = text(formData, "dueDate");
    getDb()
      .insert(tasks)
      .values({
        title,
        notes: text(formData, "notes"),
        dueDate: dueRaw ? requireDate(dueRaw, "The due date") : null,
        status: oneOf(text(formData, "status") || "open", TASK_STATUS, "Status"),
        area: text(formData, "area") || "general",
      })
      .run();
    return saved("Task added.");
  } catch (error) {
    return failed(error);
  }
}

export async function toggleTask(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const id = requiredId(formData);
    const db = getDb();
    const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
    if (!task) throw new Error("Task not found.");
    const status = task.status === "open" ? "doing" : task.status === "doing" ? "done" : "open";
    db.update(tasks).set({ status }).where(eq(tasks.id, id)).run();
    return saved("Task updated.");
  } catch (error) {
    return failed(error);
  }
}

export async function deleteTask(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    getDb().delete(tasks).where(eq(tasks.id, requiredId(formData))).run();
    return saved("Task removed.");
  } catch (error) {
    return failed(error);
  }
}

export async function saveTime(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const entryDate = requireDate(text(formData, "entryDate"), "The day");
    const breakRaw = text(formData, "breakMinutes");
    const breakMinutes = breakRaw ? wholeNumber(formData, "breakMinutes") : 0;
    if (breakMinutes === null) throw new Error("Break is a number of minutes.");
    const minutes = durationMinutes(text(formData, "startedAt"), text(formData, "endedAt"), breakMinutes);
    const warnings = timeWarnings(minutes, breakMinutes);
    const stop = warnings.find((warning) => warning.level === "stop");
    if (stop) throw new Error(stop.message);
    const db = getDb();
    const employeeId = optionalId(formData, "employeeId");
    if (employeeId && !db.select().from(employees).where(eq(employees.id, employeeId)).get()) throw new Error("Person not found.");
    const taskId = optionalId(formData, "taskId");
    if (taskId && !db.select().from(tasks).where(eq(tasks.id, taskId)).get()) throw new Error("Task not found.");
    db.insert(timeEntries)
      .values({
        entryDate,
        startedAt: text(formData, "startedAt"),
        endedAt: text(formData, "endedAt"),
        breakMinutes,
        memo: text(formData, "memo"),
        taskId,
        employeeId,
        billable: checked(formData, "billable"),
      })
      .run();
    const watch = warnings.map((warning) => warning.message).join(" ");
    return saved(watch ? `Time saved. ${watch}` : "Time saved.");
  } catch (error) {
    return failed(error);
  }
}

export async function deleteTime(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    getDb().delete(timeEntries).where(eq(timeEntries.id, requiredId(formData))).run();
    return saved("Time entry removed.");
  } catch (error) {
    return failed(error);
  }
}

export async function saveDocument(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("Choose a file.");
    const stored = await saveUpload(file);
    try {
      getDb()
        .insert(documents)
        .values({
          title: text(formData, "title") || stored.fileName,
          category: oneOf(text(formData, "category") || "other", DOCUMENT_CATEGORY, "Category"),
          fileName: stored.fileName,
          storedName: stored.storedName,
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          notes: text(formData, "notes"),
          uploadedAt: new Date().toISOString(),
        })
        .run();
    } catch (error) {
      removeUpload(stored.storedName);
      throw error;
    }
    return saved("Document stored.");
  } catch (error) {
    return failed(error);
  }
}

export async function deleteDocument(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const id = requiredId(formData);
    const db = getDb();
    const document = db.select().from(documents).where(eq(documents.id, id)).get();
    if (!document) throw new Error("Document not found.");
    removeUpload(document.storedName);
    db.delete(documents).where(eq(documents.id, id)).run();
    return saved("Document removed.");
  } catch (error) {
    return failed(error);
  }
}

export async function setObligation(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const key = text(formData, "key");
    if (!/^[\w-]+$/.test(key) || key.length > 80) throw new Error("Unknown obligation.");
    const status = oneOf(text(formData, "status"), ["open", "done", "skipped"] as const, "Status");
    const updatedAt = new Date().toISOString();
    getDb()
      .insert(obligationStates)
      .values({ key, status, note: "", updatedAt })
      .onConflictDoUpdate({ target: obligationStates.key, set: { status, updatedAt } })
      .run();
    return saved("Date updated.");
  } catch (error) {
    return failed(error);
  }
}

export async function saveDeadline(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const title = text(formData, "title");
    if (!title) throw new Error("The deadline needs a title.");
    getDb()
      .insert(customDeadlines)
      .values({
        title,
        category: text(formData, "category") || "general",
        dueDate: requireDate(text(formData, "dueDate"), "The due date"),
        recurrence: oneOf(text(formData, "recurrence") || "none", RECURRENCE, "Repeat"),
        status: "open",
        notes: text(formData, "notes"),
      })
      .run();
    return saved("Deadline added.");
  } catch (error) {
    return failed(error);
  }
}

export async function completeDeadline(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const id = requiredId(formData);
    const db = getDb();
    const row = db.select().from(customDeadlines).where(eq(customDeadlines.id, id)).get();
    if (!row) throw new Error("Deadline not found.");
    const recurrence = oneOf(row.recurrence, RECURRENCE, "Repeat");
    if (recurrence === "none") {
      db.update(customDeadlines).set({ status: "done" }).where(eq(customDeadlines.id, id)).run();
      return saved("Marked done.");
    }
    const next = nextDueDate(row.dueDate, recurrence as Recurrence);
    if (!next) throw new Error("No next date.");
    db.update(customDeadlines).set({ dueDate: next, status: "open" }).where(eq(customDeadlines.id, id)).run();
    return saved(`Next due date is ${formatDate(next)}.`);
  } catch (error) {
    return failed(error);
  }
}

export async function deleteDeadline(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    getDb().delete(customDeadlines).where(eq(customDeadlines.id, requiredId(formData))).run();
    return saved("Deadline removed.");
  } catch (error) {
    return failed(error);
  }
}

export async function toggleCompliance(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const id = requiredId(formData);
    const db = getDb();
    const item = db.select().from(complianceItems).where(eq(complianceItems.id, id)).get();
    if (!item) throw new Error("Item not found.");
    db.update(complianceItems).set({ done: !item.done }).where(eq(complianceItems.id, id)).run();
    return saved(item.done ? "Marked open." : "Marked done.");
  } catch (error) {
    return failed(error);
  }
}

export async function saveResolution(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const title = text(formData, "title");
    const body = text(formData, "body");
    if (!title || !body) throw new Error("A resolution needs a title and the decision.");
    getDb()
      .insert(resolutions)
      .values({
        resolvedOn: requireDate(text(formData, "resolvedOn"), "The resolution"),
        title,
        kind: oneOf(text(formData, "kind") || "other", RESOLUTION_KIND, "Kind"),
        body,
        summary: text(formData, "summary"),
      })
      .run();
    return saved("Resolution recorded. This is your note of the decision, not a generated document.");
  } catch (error) {
    return failed(error);
  }
}
