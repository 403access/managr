import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { CHART } from "@/domain/accounts";
import { addDays, todayIso } from "@/domain/calendar";
import { buildCustomerPayment, buildExpense, buildPayroll, buildReserveAllocation, buildSalesInvoice } from "@/domain/postings";
import { estimateContributions } from "@/domain/social";
import { lineNetCents, summarizeVat } from "@/domain/vat";
import { weekStart } from "@/domain/time";
import { statutoryObligations } from "@/domain/obligations";
import type { DB } from "@/db/client";
import { uploadsDir } from "@/db/paths";
import {
  absences,
  accounts,
  companies,
  complianceItems,
  customers,
  customDeadlines,
  documents,
  employees,
  invoiceLines,
  invoices,
  obligationStates,
  payments,
  policies,
  reserveMovements,
  resolutions,
  shareholders,
  tasks,
  timeEntries,
} from "@/db/schema";
import { payrollSourceId, postJournal } from "@/server/posting";

const compliance = [
  ["Formation", "Notarial formation and articles", "Keep the notarised deed with the company records.", true],
  ["Formation", "Commercial register entry", "HRB entry at the register court.", true],
  ["Formation", "Transparency register", "File the beneficial owner. Update it when shares change.", true],
  ["Tax", "Tax registration questionnaire", "Fragebogen zur steuerlichen Erfassung sent to the Finanzamt.", true],
  ["Tax", "ELSTER certificate", "Needed before a return can be sent.", true],
  ["Tax", "Business bank account", "Share capital and customer payments land here.", true],
  ["Trade", "IHK membership", "Commercial UGs are generally IHK members.", true],
  ["People", "Employers' liability insurance", "Registration with the Berufsgenossenschaft.", true],
  ["People", "Employment contracts", "Signed contracts for everyone on the payroll.", true],
  ["People", "Working-time records", "Start, end, and duration for each working day.", false],
  ["Corporate", "Impressum and privacy notice", "Required on the website and in customer-facing mail.", false],
  ["Corporate", "Shareholder list is current", "The list at the commercial register matches the cap table.", true],
  ["Corporate", "Draft the latest annual accounts", "Working step before the shareholder resolution.", false],
  ["Corporate", "Disclose the latest accounts", "Bundesanzeiger filing within twelve months of the year end.", false],
  ["Corporate", "Reserve resolution on file", "The allocation under §5a GmbHG needs a shareholder decision.", true],
] as const;

export function seedIfEmpty(db: DB) {
  if (db.select().from(companies).get()) return;
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const on = (offset: number) => addDays(today, offset);

  db.transaction((tx) => {
    tx.insert(companies)
      .values({
        legalName: "Atelier Nordlicht UG (haftungsbeschränkt)",
        street: "Sonnenallee 12",
        postalCode: "12045",
        city: "Berlin",
        stateCode: "BE",
        registerCourt: "Amtsgericht Berlin-Charlottenburg",
        registerNumber: "HRB 123456 B",
        taxNumber: "30/123/45678",
        vatId: "DE999999999",
        shareCapitalCents: 250_000,
        priorYearRevenueCents: 4_800_000,
        foundingDate: "2024-03-15",
        hebesatzPercent: 410,
        additionalKvBps: 290,
        iban: "DE89370400440532013000",
        bic: "COBADEFFXXX",
        bankName: "Commerzbank",
        email: "hallo@atelier-nordlicht.example",
        phone: "+49 30 12045670",
        website: "https://atelier-nordlicht.example",
        ihk: "IHK Berlin",
        berufsgenossenschaft: "BG ETEM",
        managingDirector: "Mara Elling",
        isSample: true,
        nextInvoiceSeq: 5,
      })
      .run();

    tx.insert(shareholders)
      .values({ name: "Mara Elling", street: "Sonnenallee 12", postalCode: "12045", city: "Berlin", shareBps: 10_000, nominalCents: 250_000 })
      .run();

    tx.insert(accounts)
      .values(CHART.map((account) => ({ ...account, system: true })))
      .run();

    const lichtfeld = insertId(tx.insert(customers).values({ name: "Lichtfeld GmbH", street: "Torstraße 1", postalCode: "10119", city: "Berlin", email: "finance@lichtfeld.example", vatId: "DE111111111" }).run());
    const kiez = insertId(tx.insert(customers).values({ name: "Kiezküche e.K.", street: "Weserstraße 40", postalCode: "12045", city: "Berlin", email: "hello@kiezkueche.example" }).run());
    const havel = insertId(tx.insert(customers).values({ name: "Havel & Sohn AG", street: "Havelchaussee 2", postalCode: "14193", city: "Berlin", email: "ap@havel.example", vatId: "DE222222222" }).run());

    post(tx, "2024-03-15", "Formation, share capital paid in", "opening", "capital", [
      { accountCode: "1200", debitCents: 250_000, creditCents: 0 },
      { accountCode: "0800", debitCents: 0, creditCents: 250_000 },
    ]);
    post(tx, `${year}-01-02`, "Sample opening balance brought forward", "opening", "retained", [
      { accountCode: "1200", debitCents: 8_000_000, creditCents: 0 },
      { accountCode: "0860", debitCents: 0, creditCents: 8_000_000 },
    ]);
    const reserveEntry = post(tx, `${year}-01-15`, "Statutory reserve from the prior-year surplus (sample)", "reserve", `${year - 1}`, buildReserveAllocation(160_000));
    tx.insert(reserveMovements)
      .values({ year: year - 1, movedOn: `${year}-01-15`, kind: "allocation", amountCents: 160_000, note: "Sample allocation of one quarter of a €6,400 surplus.", journalEntryId: reserveEntry })
      .run();

    bookInvoice(tx, { customerId: lichtfeld, number: `RE-${year}-0001`, issue: on(-120), due: on(-100), paid: on(-90), description: "Brand workshop", unitNetCents: 240_000 });
    bookInvoice(tx, { customerId: lichtfeld, number: `RE-${year}-0002`, issue: on(-40), due: on(-26), paid: on(-20), description: "Campaign art direction", unitNetCents: 320_000 });
    bookInvoice(tx, { customerId: havel, number: `RE-${year}-0003`, issue: on(-55), due: on(-35), description: "Pitch film", unitNetCents: 90_000 });
    bookInvoice(tx, { customerId: kiez, number: `RE-${year}-0004`, issue: on(-10), due: on(14), description: "Website care, October", unitNetCents: 140_000 });
    bookInvoice(tx, { customerId: lichtfeld, number: null, issue: today, due: on(14), description: "Proposal, spring lookbook", unitNetCents: 180_000, draft: true });

    for (const offset of [-100, -70, -40]) {
      post(tx, on(offset), "Studio rent", "expense", null, buildExpense({ expenseAccount: "4210", netCents: 85_000, vatBps: 1900, paidNow: true }));
    }
    post(tx, on(-25), "Design tool subscription", "expense", null, buildExpense({ expenseAccount: "4900", netCents: 4_900, vatBps: 1900, paidNow: true }));
    post(tx, on(-75), "Advice on the articles", "expense", null, buildExpense({ expenseAccount: "4950", netCents: 40_000, vatBps: 1900, paidNow: true }));

    const person = (values: typeof employees.$inferInsert) => insertId(tx.insert(employees).values(values).run());
    person({
      firstName: "Mara",
      lastName: "Elling",
      role: "Managing director",
      kind: "managing_director",
      svStatus: "automatic",
      ownershipBps: 10_000,
      street: "Sonnenallee 12",
      postalCode: "12045",
      city: "Berlin",
      email: "mara@atelier-nordlicht.example",
      startDate: "2024-03-15",
      weeklyMinutes: 2_400,
      workdaysPerWeek: 5,
      vacationDays: 20,
      grossMonthlyCents: 320_000,
      healthInsuranceName: "Voluntary cover, see policies",
      notes: "Controlling shareholder-director. Health insurance is private, not a payroll deduction.",
    });
    const jonasId = person({
      firstName: "Jonas",
      lastName: "Rehberg",
      role: "Designer",
      kind: "regular",
      svStatus: "subject",
      street: "Weserstraße 18",
      postalCode: "12047",
      city: "Berlin",
      email: "jonas@atelier-nordlicht.example",
      startDate: on(-180),
      weeklyMinutes: 1_200,
      workdaysPerWeek: 5,
      vacationDays: 20,
      grossMonthlyCents: 160_000,
      taxClass: "1",
      healthInsuranceName: "TK",
      notes: "Part-time. Pay sits in the Übergangsbereich.",
    });
    const aylinId = person({
      firstName: "Aylin",
      lastName: "Demir",
      role: "Studio assistant",
      kind: "minijob",
      svStatus: "subject",
      street: "Karl-Marx-Straße 80",
      postalCode: "12043",
      city: "Berlin",
      email: "aylin@atelier-nordlicht.example",
      startDate: on(-100),
      weeklyMinutes: 480,
      workdaysPerWeek: 2,
      vacationDays: 8,
      grossMonthlyCents: 45_000,
      healthInsuranceName: "Statutory health insurance",
      minijobPublicHealth: true,
      flatTax: true,
    });
    const jonasPay = estimateContributions({
      grossMonthlyCents: 160_000,
      kind: "regular",
      ownershipBps: 0,
      svStatus: "subject",
      stateCode: "BE",
      additionalKvBps: 290,
      childlessSurcharge: false,
      careDiscountSteps: 0,
      minijobPublicHealth: true,
      pensionOptOut: false,
      flatTax: true,
    });
    const aylinPay = estimateContributions({
      grossMonthlyCents: 45_000,
      kind: "minijob",
      ownershipBps: 0,
      svStatus: "subject",
      stateCode: "BE",
      additionalKvBps: 290,
      childlessSurcharge: false,
      careDiscountSteps: 0,
      minijobPublicHealth: true,
      pensionOptOut: false,
      flatTax: true,
    });
    const payrollMonth = on(-15).slice(0, 7);
    post(tx, on(-15), `Salary Jonas Rehberg ${payrollMonth}. Wage tax is a sample figure, not a calculation.`, "payroll", payrollSourceId(jonasId, payrollMonth), buildPayroll({
      minijob: false,
      grossCents: 160_000,
      withheldCents: jonasPay.employee.totalCents,
      wageTaxCents: 8_000,
      employerSocialCents: jonasPay.employer.totalCents,
      flatTaxCents: 0,
      payNow: true,
    }));
    post(tx, on(-15), `Minijob Aylin Demir ${payrollMonth}`, "payroll", payrollSourceId(aylinId, payrollMonth), buildPayroll({
      minijob: true,
      grossCents: 45_000,
      withheldCents: aylinPay.employee.totalCents,
      wageTaxCents: 0,
      employerSocialCents: aylinPay.employer.totalCents - aylinPay.employer.flatTaxCents,
      flatTaxCents: aylinPay.employer.flatTaxCents,
      payNow: true,
    }));

    tx.insert(absences).values({ employeeId: jonasId, startDate: on(10), endDate: on(12), kind: "vacation", status: "approved", notes: "Short break" }).run();

    tx.insert(policies).values([
      { label: "Mara health and care cover", kind: "health", provider: "Nordstern Kranken", policyNumber: "PKV-44021", monthlyPremiumCents: 48_600, renewalDate: on(120), notes: "Private cover for the managing director. Not a payroll deduction." },
      { label: "Business liability", kind: "liability", provider: "Nordstern Versicherung", policyNumber: "BH-1882", monthlyPremiumCents: 3_500, renewalDate: on(26), notes: "Sample policy. Confirm the real renewal." },
    ]).run();

    tx.insert(tasks).values([
      { title: "Chase the overdue Havel invoice", notes: "One reminder, then a second before considering a dunning letter.", dueDate: on(2), status: "open", area: "invoices" },
      { title: "Collect October VAT figures", notes: "Output VAT, input VAT, and the prepayment.", dueDate: on(12), status: "open", area: "tax" },
      { title: "Draft the shareholder pack", notes: "Accounts, reserve proposal, and the resolution.", dueDate: on(21), status: "doing", area: "legal" },
      { title: "File the studio insurance renewal", dueDate: on(20), status: "open", area: "cover" },
    ]).run();

    const monday = weekStart(today);
    const tuesday = addDays(monday, 1);
    tx.insert(timeEntries).values([
      { entryDate: monday, startedAt: "09:00", endedAt: "17:30", breakMinutes: 30, memo: "Client revisions", billable: true },
      { entryDate: tuesday <= today ? tuesday : monday, startedAt: "09:30", endedAt: "15:00", breakMinutes: 15, memo: "Studio admin and invoice draft", billable: false },
    ]).run();

    const settings = { fiscalYearStartMonth: 1, vatPermanentExtension: false, usesTaxAdvisor: false };
    const doneBefore = addDays(today, -20);
    const seen = new Set<string>();
    for (const dueYear of [year - 1, year, year + 1]) {
      for (const item of statutoryObligations(dueYear, settings)) {
        if (seen.has(item.key) || item.dueDate >= doneBefore) continue;
        if (item.when === "vat" || item.when === "payroll" || item.key.includes("advance")) {
          seen.add(item.key);
          tx.insert(obligationStates).values({ key: item.key, status: "done", note: "Sample, marked done", updatedAt: new Date().toISOString() }).run();
        }
      }
    }

    tx.insert(customDeadlines).values({ title: "Send the Havel reminder", category: "invoices", dueDate: on(3), recurrence: "none", status: "open", notes: "Keep the thread polite and specific." }).run();

    tx.insert(resolutions).values([
      { resolvedOn: "2024-03-15", title: "Formation", kind: "formation", body: "shareholders", summary: "Company formed. Mara Elling appointed managing director. Share capital €2,500 paid in." },
      { resolvedOn: `${year}-01-15`, title: `Adopt FY ${year - 1} accounts and allocate the reserve`, kind: "profit", body: "shareholders", summary: "Sample resolution. One quarter of the surplus, €1,600, goes to the statutory reserve." },
    ]).run();

    compliance.forEach((item, index) => {
      tx.insert(complianceItems).values({ area: item[0], title: item[1], detail: item[2], done: item[3], sortOrder: index + 1 }).run();
    });

    const storedName = "sample-shareholder-list.txt";
    const body = [
      "Gesellschafterliste",
      "Atelier Nordlicht UG (haftungsbeschränkt)",
      "Amtsgericht Berlin-Charlottenburg, HRB 123456 B",
      "",
      "Mara Elling, Sonnenallee 12, 12045 Berlin",
      "Anteil: 100 % — 2.500,00 EUR",
      "",
      "Sample document. Replace it with the list filed at the commercial register.",
      "",
    ].join("\n");
    fs.mkdirSync(uploadsDir(), { recursive: true });
    fs.writeFileSync(path.join(uploadsDir(), storedName), body);
    tx.insert(documents)
      .values({
        title: "Shareholder list (sample)",
        category: "corporate",
        fileName: storedName,
        storedName,
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength(body),
        notes: "Fictional list for the sample company.",
        uploadedAt: new Date().toISOString(),
      })
      .run();
  });

  }

function insertId(result: { lastInsertRowid: number | bigint }): number {
  return Number(result.lastInsertRowid);
}

function post(db: DB, date: string, memo: string, source: string, sourceId: string | null, lines: { accountCode: string; debitCents: number; creditCents: number }[]) {
  return postJournal(db, { date, memo, source, sourceId, lines });
}

function bookInvoice(
  db: DB,
  input: { customerId: number; number: string | null; issue: string; due: string; paid?: string; description: string; unitNetCents: number; draft?: boolean },
) {
  const id = insertId(
    db
      .insert(invoices)
      .values({
        customerId: input.customerId,
        number: input.number,
        status: input.draft ? "draft" : "issued",
        issueDate: input.issue,
        serviceDate: input.issue,
        dueDate: input.due,
        notes: "",
        exemptionNote: "",
      })
      .run(),
  );
  db.insert(invoiceLines)
    .values({ invoiceId: id, position: 1, description: input.description, quantityMilli: 1000, unitNetCents: input.unitNetCents, vatBps: 1900 })
    .run();
  if (input.draft || !input.number) return;
  const totals = summarizeVat([{ netCents: lineNetCents(1000, input.unitNetCents), vatBps: 1900 }], false);
  const entryId = post(db, input.issue, `Invoice ${input.number}`, "invoice", String(id), buildSalesInvoice({ kleinunternehmer: false, byRate: totals.byRate }));
  db.update(invoices).set({ journalEntryId: entryId, status: input.paid ? "paid" : "issued" }).where(eq(invoices.id, id)).run();
  if (input.paid) {
    const paymentId = insertId(db.insert(payments).values({ invoiceId: id, paidOn: input.paid, amountCents: totals.grossCents }).run());
    const paymentEntry = post(db, input.paid, `Payment ${input.number}`, "payment", String(paymentId), buildCustomerPayment(totals.grossCents));
    db.update(payments).set({ journalEntryId: paymentEntry }).where(eq(payments.id, paymentId)).run();
  }
}
