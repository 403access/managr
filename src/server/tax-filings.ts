import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, count, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  elsterSettings,
  elsterTransmissions,
  journalEntries,
  obligationStates,
  taxFilings,
  taxFilingEvents,
} from "@/db/schema";
import { ACCOUNTS } from "@/domain/accounts";
import { todayIso } from "@/domain/calendar";
import {
  buildFilingCsv,
  buildFilingExport,
  buildUstvaImportXml,
  buildUstvaKennzahlenCsv,
  exportFilename,
  formatVersionFor,
  type FilingFigures,
  type ProfitFigures,
  type VatFigures,
} from "@/domain/elster-format";
import { summarizeProfit } from "@/domain/reporting";
import { estimateCorporateTax } from "@/domain/tax";
import {
  assertTransition,
  canRelease,
  canonicalJson,
  filingDueDate,
  filingPeriod,
  isAnnualKind,
  isEditable,
  isSubmitted,
  isTaxFilingKind,
  obligationKeyFor,
  runFilingChecks,
  type FilingCheck,
  type FilingCheckInput,
  type TaxFilingKind,
  type TaxFilingStatus,
} from "@/domain/tax-filing";
import { accountBalances, listInvoices, loadCompany, signedAccount } from "./queries";

export type TaxFiling = typeof taxFilings.$inferSelect;
export type TaxFilingEvent = typeof taxFilingEvents.$inferSelect;
export type ElsterSetting = typeof elsterSettings.$inferSelect;
export type ElsterTransmission = typeof elsterTransmissions.$inferSelect;

export function parseFigures(json: string): FilingFigures | null {
  if (!json || json === "{}") return null;
  try {
    const value = JSON.parse(json) as FilingFigures;
    return value && typeof value === "object" && "kind" in value ? value : null;
  } catch {
    return null;
  }
}

export function parseChecks(json: string): FilingCheck[] {
  try {
    const value = JSON.parse(json) as FilingCheck[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function listTaxFilings(year: number): TaxFiling[] {
  return getDb()
    .select()
    .from(taxFilings)
    .where(and(eq(taxFilings.companyId, loadCompany().id), eq(taxFilings.year, year), isNull(taxFilings.deletedAt)))
    .orderBy(taxFilings.kind, taxFilings.periodKey, desc(taxFilings.id))
    .all();
}

export function loadTaxFiling(id: number): TaxFiling | null {
  return (
    getDb()
      .select()
      .from(taxFilings)
      .where(and(eq(taxFilings.id, id), eq(taxFilings.companyId, loadCompany().id), isNull(taxFilings.deletedAt)))
      .get() ?? null
  );
}

function figuresHash(figures: FilingFigures): string {
  return crypto.createHash("sha256").update(canonicalJson(figures)).digest("hex");
}

function periodFor(filing: Pick<TaxFiling, "kind" | "year" | "periodKey">) {
  const company = loadCompany();
  return filingPeriod(filing.kind as TaxFilingKind, filing.year, filing.periodKey, company.fiscalYearStartMonth);
}

/** The figures always come from the journal, never from a second entry field. */
export function computeFilingFigures(kind: TaxFilingKind, year: number, periodKey: string): FilingFigures {
  const company = loadCompany();
  const period = filingPeriod(kind, year, periodKey, company.fiscalYearStartMonth);
  const rows = accountBalances(period.from, period.to);
  if (kind === "ustva" || kind === "ust-annual") {
    const outputVat19Cents = signedAccount(rows, ACCOUNTS.vat19);
    const outputVat7Cents = signedAccount(rows, ACCOUNTS.vat7);
    const inputVat19Cents = signedAccount(rows, ACCOUNTS.inputVat19);
    const inputVat7Cents = signedAccount(rows, ACCOUNTS.inputVat7);
    const prepaymentsCents = signedAccount(rows, ACCOUNTS.vatPrepayments) + signedAccount(rows, ACCOUNTS.vatSpecialPrepayment);
    return {
      kind,
      from: period.from,
      to: period.to,
      taxable19Cents: signedAccount(rows, ACCOUNTS.revenue19),
      taxable7Cents: signedAccount(rows, ACCOUNTS.revenue7),
      exemptCents: signedAccount(rows, ACCOUNTS.revenueExempt) + signedAccount(rows, ACCOUNTS.revenueKlein),
      outputVat19Cents,
      outputVat7Cents,
      inputVat19Cents,
      inputVat7Cents,
      prepaymentsCents,
      payableCents: outputVat19Cents + outputVat7Cents - inputVat19Cents - inputVat7Cents - prepaymentsCents,
    } satisfies VatFigures;
  }
  const profit = summarizeProfit(rows);
  const estimate = estimateCorporateTax(profit.profitBeforeTaxCents, company.hebesatzPercent, company.lossCarryforwardCents);
  return {
    kind,
    from: period.from,
    to: period.to,
    revenueCents: profit.revenueCents,
    expenseCents: profit.expenseCents,
    profitBeforeTaxCents: profit.profitBeforeTaxCents,
    lossCarryforwardCents: company.lossCarryforwardCents,
    ...estimate,
    hebesatzPercent: company.hebesatzPercent,
  } satisfies ProfitFigures;
}



function journalEntryCount(from: string, to: string): number {
  const row = getDb()
    .select({ value: count() })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.companyId, loadCompany().id),
        gte(journalEntries.entryDate, from),
        lte(journalEntries.entryDate, to),
      ),
    )
    .get();
  return Number(row?.value ?? 0);
}

function invoiceStats(from: string, to: string): { openInvoices: number; invoiceVatCents: number } {
  const rows = listInvoices().filter((invoice) => invoice.issueDate >= from && invoice.issueDate <= to);
  const openInvoices = rows.filter((invoice) => invoice.status === "draft").length;
  const invoiceVatCents = rows
    .filter((invoice) => invoice.status !== "draft" && invoice.status !== "void")
    .reduce((sum, invoice) => sum + invoice.vatCents, 0);
  return { openInvoices, invoiceVatCents };
}

function hasDuplicate(filing: Pick<TaxFiling, "id" | "kind" | "year" | "periodKey" | "replacesId">): boolean {
  if (filing.replacesId) return false;
  return (
    getDb()
      .select({ id: taxFilings.id })
      .from(taxFilings)
      .where(
        and(
          eq(taxFilings.companyId, loadCompany().id),
          eq(taxFilings.kind, filing.kind),
          eq(taxFilings.year, filing.year),
          eq(taxFilings.periodKey, filing.periodKey),
          isNull(taxFilings.replacesId),
          isNull(taxFilings.deletedAt),
        ),
      )
      .all()
      .some((row) => row.id !== filing.id)
  );
}

function addEvent(
  filing: TaxFiling,
  type: string,
  fromStatus: TaxFilingStatus,
  toStatus: TaxFilingStatus,
  actor = "desk",
  detail: Record<string, unknown> = {},
): void {
  getDb()
    .insert(taxFilingEvents)
    .values({
      taxFilingId: filing.id,
      at: new Date().toISOString(),
      type,
      actor,
      fromStatus,
      toStatus,
      detailJson: JSON.stringify(detail),
      payloadHash: filing.figuresHash,
    })
    .run();
}

export function createTaxFiling(input: {
  kind: string;
  year: number;
  periodKey: string;
}, actor = "desk"): TaxFiling {
  if (!isTaxFilingKind(input.kind)) throw new Error("Choose a tax-return kind.");
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) throw new Error("Choose a year between 2000 and 2100.");
  const company = loadCompany();
  if (input.kind === "ustva" && company.kleinunternehmer) {
    throw new Error("VAT advance returns are hidden while the §19 exemption is active.");
  }
  const periodKey = isAnnualKind(input.kind) ? String(input.year) : input.periodKey;
  const period = filingPeriod(input.kind, input.year, periodKey, company.fiscalYearStartMonth);
  const duplicate = getDb()
    .select({ id: taxFilings.id })
    .from(taxFilings)
    .where(
      and(
        eq(taxFilings.companyId, company.id),
        eq(taxFilings.kind, input.kind),
        eq(taxFilings.year, input.year),
        eq(taxFilings.periodKey, periodKey),
        isNull(taxFilings.replacesId),
        isNull(taxFilings.deletedAt),
      ),
    )
    .get();
  if (duplicate) throw new Error("An active return already exists for this period.");
  const now = new Date().toISOString();
  const dueDate = filingDueDate(input.kind, input.year, periodKey, company);
  const created = getDb()
    .insert(taxFilings)
    .values({
      companyId: company.id,
      kind: input.kind,
      year: input.year,
      periodKey,
      status: "draft",
      dueDate,
      figuresJson: "{}",
      figuresHash: "",
      checksJson: "[]",
      formatVersion: formatVersionFor(input.kind, input.year),
      createdAt: now,
      updatedAt: now,
    })
    .run();
  const id = Number(created.lastInsertRowid);
  const filing = loadTaxFiling(id);
  if (!filing) throw new Error("The return could not be created.");
  addEvent(filing, "created", "draft", "draft", actor, { from: period.from, to: period.to });
  return filing;
}

export function calculateTaxFiling(id: number, actor = "desk"): TaxFiling {
  const filing = requireFiling(id);
  if (isSubmitted(filing.status as TaxFilingStatus)) throw new Error("A submitted return cannot be recalculated. Create a correction.");
  const figures = computeFilingFigures(filing.kind as TaxFilingKind, filing.year, filing.periodKey);
  const hash = figuresHash(figures);
  const company = loadCompany();
  const dueDate = filingDueDate(filing.kind as TaxFilingKind, filing.year, filing.periodKey, company);
  const now = new Date().toISOString();
  getDb()
    .update(taxFilings)
    .set({
      figuresJson: JSON.stringify(figures),
      figuresHash: hash,
      checksJson: "[]",
      dueDate,
      formatVersion: formatVersionFor(filing.kind as TaxFilingKind, filing.year),
      status: "calculated",
      updatedAt: now,
    })
    .where(eq(taxFilings.id, filing.id))
    .run();
  const updated = requireFiling(filing.id);
  addEvent(updated, "calculated", filing.status as TaxFilingStatus, "calculated", actor, { hash, from: figures.from, to: figures.to });
  return updated;
}

export function refreshTaxFilingChecks(id: number, actor = "desk"): { filing: TaxFiling; checks: FilingCheck[] } {
  const filing = requireFiling(id);
  if (isSubmitted(filing.status as TaxFilingStatus)) throw new Error("A submitted return keeps its recorded checks.");
  const company = loadCompany();
  const figures = computeFilingFigures(filing.kind as TaxFilingKind, filing.year, filing.periodKey);
  const currentHash = figuresHash(figures);
  const period = periodFor(filing);
  const stats = invoiceStats(period.from, period.to);
  const rows = accountBalances(period.from, period.to);
  const input: FilingCheckInput = {
    kind: filing.kind as TaxFilingKind,
    year: filing.year,
    periodKey: filing.periodKey,
    status: filing.status as TaxFilingStatus,
    dueDate: filing.dueDate,
    today: todayIso(),
    stale: filing.figuresHash !== "" && filing.figuresHash !== currentHash,
    company: {
      legalName: company.legalName,
      street: company.street,
      postalCode: company.postalCode,
      city: company.city,
      taxNumber: company.taxNumber,
      vatId: company.vatId,
      kleinunternehmer: company.kleinunternehmer,
    },
    figuresEmpty: !filing.figuresHash || parseFigures(filing.figuresJson) === null,
    stats: {
      journalEntries: journalEntryCount(period.from, period.to),
      openInvoices: stats.openInvoices,
      invoiceVatCents: stats.invoiceVatCents,
      journalVatCents:
        signedAccount(rows, ACCOUNTS.vat19) +
        signedAccount(rows, ACCOUNTS.vat7) -
        signedAccount(rows, ACCOUNTS.inputVat19) -
        signedAccount(rows, ACCOUNTS.inputVat7),
    },
    duplicate: hasDuplicate(filing),
  };
  const checks = runFilingChecks(input);
  const status = filing.status as TaxFilingStatus;
  const nextStatus: TaxFilingStatus =
    status === "checked" || status === "ready" ? (checks.some((check) => check.severity === "block") ? "calculated" : status) : status;
  const now = new Date().toISOString();
  getDb()
    .update(taxFilings)
    .set({ checksJson: JSON.stringify(checks), status: nextStatus, updatedAt: now })
    .where(eq(taxFilings.id, filing.id))
    .run();
  const updated = requireFiling(filing.id);
  if (nextStatus !== status) {
    addEvent(updated, "checks-reset", status, nextStatus, actor, { blocks: checks.filter((check) => check.severity === "block").length });
  }
  return { filing: updated, checks };
}

export function checkTaxFiling(id: number, actor = "desk"): { filing: TaxFiling; checks: FilingCheck[] } {
  const result = refreshTaxFilingChecks(id, actor);
  const status = result.filing.status as TaxFilingStatus;
  if (status !== "calculated" && status !== "checked") return result;
  const blocks = result.checks.filter((check) => check.severity === "block");
  const nextStatus: TaxFilingStatus = blocks.length === 0 ? "checked" : "calculated";
  if (nextStatus !== status) {
    assertTransition(status, nextStatus);
    getDb()
      .update(taxFilings)
      .set({ status: nextStatus, updatedAt: new Date().toISOString() })
      .where(eq(taxFilings.id, result.filing.id))
      .run();
    const updated = requireFiling(result.filing.id);
    addEvent(updated, "checked", status, nextStatus, actor, { blocks: blocks.length, warnings: result.checks.filter((check) => check.severity === "warn").length });
    return { filing: updated, checks: result.checks };
  }
  return result;
}

export function releaseTaxFiling(id: number, warningsConfirmed: boolean): TaxFiling {
  const result = refreshTaxFilingChecks(id);
  const status = result.filing.status as TaxFilingStatus;
  const problem = canRelease(result.checks, warningsConfirmed);
  if (problem) throw new Error(problem);
  if (status === "ready") return result.filing;
  assertTransition(status, "ready");
  getDb()
    .update(taxFilings)
    .set({ status: "ready", updatedAt: new Date().toISOString() })
    .where(eq(taxFilings.id, result.filing.id))
    .run();
  const updated = requireFiling(result.filing.id);
  addEvent(updated, "released", status, "ready", "desk", { warningsConfirmed });
  return updated;
}

export function reopenTaxFiling(id: number): TaxFiling {
  const filing = requireFiling(id);
  const status = filing.status as TaxFilingStatus;
  if (isSubmitted(status)) throw new Error("A submitted return is corrected, not reopened.");
  assertTransition(status, "calculated");
  getDb()
    .update(taxFilings)
    .set({ status: "calculated", updatedAt: new Date().toISOString() })
    .where(eq(taxFilings.id, filing.id))
    .run();
  const updated = requireFiling(filing.id);
  addEvent(updated, "reopened", status, "calculated");
  return updated;
}

export function saveTaxFilingNote(id: number, note: string, actor = "desk"): TaxFiling {
  const filing = requireFiling(id);
  if (note.length > 4000) throw new Error("The note is too long.");
  getDb()
    .update(taxFilings)
    .set({ notes: note, updatedAt: new Date().toISOString() })
    .where(eq(taxFilings.id, filing.id))
    .run();
  const updated = requireFiling(filing.id);
  addEvent(updated, "note", updated.status as TaxFilingStatus, updated.status as TaxFilingStatus, actor);
  return updated;
}

export function deleteTaxFiling(id: number): number {
  const filing = requireFiling(id);
  if (!isEditable(filing.status as TaxFilingStatus)) throw new Error("Only an unfiled return can be removed.");
  getDb()
    .update(taxFilings)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(taxFilings.id, filing.id))
    .run();
  return filing.year;
}

export function createCorrection(id: number): TaxFiling {
  const filing = requireFiling(id);
  const status = filing.status as TaxFilingStatus;
  if (!isSubmitted(status) && status !== "rejected" && status !== "failed") {
    throw new Error("Only a submitted or rejected return needs a correction.");
  }
  const company = loadCompany();
  const now = new Date().toISOString();
  const created = getDb()
    .insert(taxFilings)
    .values({
      companyId: company.id,
      kind: filing.kind,
      year: filing.year,
      periodKey: filing.periodKey,
      status: "draft",
      dueDate: filing.dueDate,
      figuresJson: "{}",
      figuresHash: "",
      checksJson: "[]",
      formatVersion: filing.formatVersion,
      replacesId: filing.id,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  const correction = requireFiling(Number(created.lastInsertRowid));
  addEvent(correction, "correction-created", "draft", "draft", "desk", { replacesId: filing.id });
  return correction;
}

export async function submitTaxFilingManually(
  id: number,
  input: { ticket: string; submittedOn: string; confirmed: boolean; protocol?: File | null },
): Promise<TaxFiling> {
  const filing = requireFiling(id);
  if (filing.status !== "ready") throw new Error("Release the return before recording a submission.");
  if (!input.confirmed) throw new Error("Confirm that the return was actually submitted.");
  if (!input.ticket.trim()) throw new Error("Record the transmission ticket or protocol number.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.submittedOn)) throw new Error("The submission needs a date.");
  const protocol = input.protocol && input.protocol.size > 0 ? await saveTaxProtocol(filing, input.protocol) : null;
  const now = new Date().toISOString();
  getDb().transaction((tx) => {
    tx.update(taxFilings)
      .set({ status: "submitted_manually", submittedAt: `${input.submittedOn}T${now.slice(11)}`, updatedAt: now })
      .where(eq(taxFilings.id, filing.id))
      .run();
    tx.insert(elsterTransmissions)
      .values({
        taxFilingId: filing.id,
        environment: "manual",
        transport: "manual",
        startedAt: now,
        finishedAt: now,
        status: "submitted",
        requestSha256: filing.figuresHash,
        ticket: input.ticket.trim(),
        protocolJson: JSON.stringify({ submittedOn: input.submittedOn }),
        protocolPath: protocol?.relativePath ?? "",
        protocolName: protocol?.name ?? "",
        protocolMime: protocol?.mimeType ?? "",
        protocolSizeBytes: protocol?.sizeBytes ?? 0,
      })
      .run();
    tx.insert(obligationStates)
      .values({
        companyId: filing.companyId,
        key: obligationKeyFor(filing.kind as TaxFilingKind, filing.year, filing.periodKey),
        status: "done",
        note: `Filed manually · ${input.ticket.trim()}`,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [obligationStates.companyId, obligationStates.key],
        set: { status: "done", note: `Filed manually · ${input.ticket.trim()}`, updatedAt: now },
      })
      .run();
  });
  const updated = requireFiling(filing.id);
  addEvent(updated, "submitted-manually", "ready", "submitted_manually", "desk", {
    ticket: input.ticket.trim(),
    submittedOn: input.submittedOn,
    protocol: protocol?.name ?? "",
  });
  return updated;
}

export function getElsterSettings(companyId = loadCompany().id): ElsterSetting | null {
  return getDb().select().from(elsterSettings).where(eq(elsterSettings.companyId, companyId)).get() ?? null;
}

export function saveElsterSettings(input: {
  environment: string;
  herstellerId: string;
  softwareName: string;
  privacyAcknowledged: boolean;
}): ElsterSetting {
  const company = loadCompany();
  if (input.environment !== "test" && input.environment !== "production") throw new Error("Choose the test or production environment.");
  const herstellerId = input.herstellerId.trim();
  if (herstellerId && !/^\d{5}$/.test(herstellerId)) throw new Error("The Hersteller-ID is five digits.");
  const softwareName = input.softwareName.trim() || "managr";
  if (softwareName.length > 80) throw new Error("The software name is too long.");
  const existing = getElsterSettings(company.id);
  const now = new Date().toISOString();
  const privacyAcknowledgedAt = input.privacyAcknowledged ? (existing?.privacyAcknowledgedAt ?? now) : null;
  getDb()
    .insert(elsterSettings)
    .values({
      companyId: company.id,
      environment: input.environment,
      herstellerId,
      softwareName,
      softwareVersion: existing?.softwareVersion ?? "",
      certificateName: existing?.certificateName ?? "",
      certificateCiphertext: existing?.certificateCiphertext ?? "",
      certificateValidUntil: existing?.certificateValidUntil ?? null,
      certificateFingerprint: existing?.certificateFingerprint ?? "",
      privacyAcknowledgedAt,
      ericVersion: existing?.ericVersion ?? "",
      lastCheckedAt: existing?.lastCheckedAt ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: elsterSettings.companyId,
      set: {
        environment: input.environment,
        herstellerId,
        softwareName,
        privacyAcknowledgedAt,
        updatedAt: now,
      },
    })
    .run();
  const saved = getElsterSettings(company.id);
  if (!saved) throw new Error("The ELSTER settings could not be saved.");
  return saved;
}

function protocolDir(filing: Pick<TaxFiling, "companyId" | "year" | "id">): string {
  return path.join(process.cwd(), "data", "elster", String(filing.companyId), String(filing.year), String(filing.id));
}

async function saveTaxProtocol(
  filing: TaxFiling,
  file: File,
): Promise<{ relativePath: string; name: string; mimeType: string; sizeBytes: number } | null> {
  if (!file || file.size === 0) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error("The protocol file is larger than 5 MB.");
  const name = path.basename(file.name || "protocol");
  if (!/\.(pdf|xml|zip)$/i.test(name)) throw new Error("The protocol must be a PDF, XML, or ZIP file.");
  const dir = protocolDir(filing);
  fs.mkdirSync(dir, { recursive: true });
  const stored = `${Date.now()}-${name.replace(/[^\w.\-]/g, "_")}`;
  fs.writeFileSync(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));
  const relativePath = path.relative(process.cwd(), path.join(dir, stored));
  return { relativePath, name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size };
}

export function readTaxProtocol(transmissionId: number, filingId?: number): { buffer: Buffer; name: string; mimeType: string } | null {
  const row = getDb()
    .select()
    .from(elsterTransmissions)
    .where(eq(elsterTransmissions.id, transmissionId))
    .get();
  if (!row || !row.protocolPath) return null;
  if (filingId !== undefined && row.taxFilingId !== filingId) return null;
  const filing = loadTaxFiling(row.taxFilingId);
  if (!filing) return null;
  const root = path.join(process.cwd(), "data", "elster");
  const absolute = path.resolve(/* turbopackIgnore: true */ process.cwd(), row.protocolPath);
  if (!absolute.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error("The protocol path is outside the upload directory.");
  if (!fs.existsSync(absolute)) return null;
  return { buffer: fs.readFileSync(absolute), name: row.protocolName || "protocol.pdf", mimeType: row.protocolMime || "application/octet-stream" };
}

export function listFilingEvents(filingId: number): TaxFilingEvent[] {
  return getDb()
    .select()
    .from(taxFilingEvents)
    .where(eq(taxFilingEvents.taxFilingId, filingId))
    .orderBy(desc(taxFilingEvents.at), desc(taxFilingEvents.id))
    .all();
}

export function listFilingTransmissions(filingId: number): ElsterTransmission[] {
  return getDb()
    .select()
    .from(elsterTransmissions)
    .where(eq(elsterTransmissions.taxFilingId, filingId))
    .orderBy(desc(elsterTransmissions.startedAt), desc(elsterTransmissions.id))
    .all();
}

export function taxFilingExport(id: number, format: "json" | "csv" | "xml"): { body: string; contentType: string; filename: string } {
  const filing = requireFiling(id);
  const figures = parseFigures(filing.figuresJson);
  if (!figures) throw new Error("Calculate the return before exporting it.");
  const company = loadCompany();
  const checks = parseChecks(filing.checksJson);
  if (format === "xml") {
    if (filing.kind !== "ustva") throw new Error("An ELSTER upload file exists only for the VAT advance return. Use the data export for the annual returns.");
    const settings = getElsterSettings(company.id);
    const body = buildUstvaImportXml({
      figures: figures as VatFigures,
      year: filing.year,
      periodKey: filing.periodKey,
      taxNumber: company.taxNumber,
      vatId: company.vatId,
      herstellerId: settings?.herstellerId ?? "",
      corrected: filing.replacesId !== null,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    return {
      body,
      contentType: "application/xml; charset=iso-8859-15",
      filename: exportFilename(filing.kind as TaxFilingKind, filing.year, filing.periodKey, "xml"),
    };
  }
  if (format === "csv") {
    return {
      body: filing.kind === "ustva" ? buildUstvaKennzahlenCsv(figures as VatFigures) : buildFilingCsv(figures),
      contentType: "text/csv; charset=utf-8",
      filename: exportFilename(filing.kind as TaxFilingKind, filing.year, filing.periodKey, "csv"),
    };
  }
  const data = buildFilingExport({
    filing: {
      id: filing.id,
      kind: filing.kind as TaxFilingKind,
      year: filing.year,
      periodKey: filing.periodKey,
      status: filing.status as TaxFilingStatus,
      dueDate: filing.dueDate,
      figuresHash: filing.figuresHash,
      submittedAt: filing.submittedAt,
      notes: filing.notes,
      replacesId: filing.replacesId,
    },
    company: {
      legalName: company.legalName,
      street: company.street,
      postalCode: company.postalCode,
      city: company.city,
      taxNumber: company.taxNumber,
      vatId: company.vatId,
    },
    figures,
    checks,
    generatedAt: new Date().toISOString(),
  });
  return {
    body: JSON.stringify(data, null, 2),
    contentType: "application/json; charset=utf-8",
    filename: exportFilename(filing.kind as TaxFilingKind, filing.year, filing.periodKey, "json"),
  };
}

function requireFiling(id: number): TaxFiling {
  const filing = loadTaxFiling(id);
  if (!filing) throw new Error("That tax return was not found.");
  return filing;
}