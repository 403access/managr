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
  journalEntries,
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
  ["formation", "Notarielle Gründung und Gesellschaftsvertrag", "Die notarielle Urkunde bei den Unterlagen der Gesellschaft aufbewahren.", true],
  ["formation", "Eintragung im Handelsregister", "HRB-Eintragung beim Registergericht.", true],
  ["formation", "Transparenzregister", "Den wirtschaftlich Berechtigten eintragen. Bei Änderung der Anteile aktualisieren.", true],
  ["tax", "Fragebogen zur steuerlichen Erfassung", "An das Finanzamt übermittelt.", true],
  ["tax", "ELSTER-Zertifikat", "Wird gebraucht, bevor eine Erklärung übermittelt werden kann.", true],
  ["tax", "Geschäftskonto", "Hier gehen Stammkapital und Kundenzahlungen ein.", true],
  ["trade", "IHK-Mitgliedschaft", "Gewerbliche UGs sind in der Regel IHK-Mitglied.", true],
  ["people", "Berufsgenossenschaft", "Anmeldung bei der Berufsgenossenschaft.", true],
  ["people", "Arbeitsverträge", "Unterschriebene Verträge für alle auf der Lohnabrechnung.", true],
  ["people", "Arbeitszeitnachweise", "Beginn, Ende und Dauer jedes Arbeitstages.", false],
  ["corporate", "Impressum und Datenschutzerklärung", "Erforderlich auf der Website und in Schreiben an Kunden.", false],
  ["corporate", "Gesellschafterliste ist aktuell", "Die Liste beim Handelsregister entspricht der Beteiligung.", true],
  ["corporate", "Jahresabschluss im Entwurf", "Arbeitsschritt vor dem Gesellschafterbeschluss.", false],
  ["corporate", "Offenlegung des letzten Jahresabschlusses", "Offenlegung im Bundesanzeiger innerhalb von zwölf Monaten nach Ablauf des Geschäftsjahres.", false],
  ["corporate", "Beschluss über die Rücklage liegt vor", "Die Einstellung nach § 5a GmbHG braucht einen Gesellschafterbeschluss.", true],
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

    post(tx, "2024-03-15", "Gründung, Stammkapital eingezahlt", "opening", "capital", [
      { accountCode: "1200", debitCents: 250_000, creditCents: 0 },
      { accountCode: "0800", debitCents: 0, creditCents: 250_000 },
    ]);
    post(tx, `${year}-01-02`, "Beispiel: Gewinnvortrag", "opening", "retained", [
      { accountCode: "1200", debitCents: 8_000_000, creditCents: 0 },
      { accountCode: "0860", debitCents: 0, creditCents: 8_000_000 },
    ]);
    const reserveEntry = post(tx, `${year}-01-15`, "Gesetzliche Rücklage aus dem Jahresüberschuss des Vorjahres (Beispiel)", "reserve", `${year - 1}`, buildReserveAllocation(160_000));
    tx.insert(reserveMovements)
      .values({ year: year - 1, movedOn: `${year}-01-15`, kind: "allocation", amountCents: 160_000, note: "Beispieleinstellung: ein Viertel eines Jahresüberschusses von 6.400 €.", journalEntryId: reserveEntry })
      .run();

    bookInvoice(tx, { customerId: lichtfeld, number: `RE-${year}-0001`, issue: on(-120), due: on(-100), paid: on(-90), description: "Markenworkshop", unitNetCents: 240_000 });
    bookInvoice(tx, { customerId: lichtfeld, number: `RE-${year}-0002`, issue: on(-40), due: on(-26), paid: on(-20), description: "Kampagnengestaltung", unitNetCents: 320_000 });
    bookInvoice(tx, { customerId: havel, number: `RE-${year}-0003`, issue: on(-55), due: on(-35), description: "Pitchfilm", unitNetCents: 90_000 });
    bookInvoice(tx, { customerId: kiez, number: `RE-${year}-0004`, issue: on(-10), due: on(14), description: "Websitebetreuung Oktober", unitNetCents: 140_000 });
    bookInvoice(tx, { customerId: lichtfeld, number: null, issue: today, due: on(14), description: "Angebot, Lookbook Frühjahr", unitNetCents: 180_000, draft: true });

    for (const offset of [-100, -70, -40]) {
      post(tx, on(offset), "Studiomiete", "expense", null, buildExpense({ expenseAccount: "4210", netCents: 85_000, vatBps: 1900, paidNow: true }));
    }
    post(tx, on(-25), "Abo für Gestaltungssoftware", "expense", null, buildExpense({ expenseAccount: "4900", netCents: 4_900, vatBps: 1900, paidNow: true }));
    post(tx, on(-75), "Beratung zum Gesellschaftsvertrag", "expense", null, buildExpense({ expenseAccount: "4950", netCents: 40_000, vatBps: 1900, paidNow: true }));

    const person = (values: typeof employees.$inferInsert) => insertId(tx.insert(employees).values(values).run());
    person({
      firstName: "Mara",
      lastName: "Elling",
      role: "Geschäftsführerin",
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
      healthInsuranceName: "Private Krankenversicherung, siehe Versicherungen",
      notes: "Beherrschende Gesellschafter-Geschäftsführerin. Die Krankenversicherung ist privat und keine Lohnabzugsposition.",
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
      notes: "Teilzeit. Das Entgelt liegt im Übergangsbereich.",
    });
    const aylinId = person({
      firstName: "Aylin",
      lastName: "Demir",
      role: "Studioassistenz",
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
      healthInsuranceName: "Gesetzliche Krankenversicherung",
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
    post(tx, on(-15), `Gehalt Jonas Rehberg ${payrollMonth}. Die Lohnsteuer ist eine Beispielzahl, keine Berechnung.`, "payroll", payrollSourceId(jonasId, payrollMonth), buildPayroll({
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

    tx.insert(absences).values({ employeeId: jonasId, startDate: on(10), endDate: on(12), kind: "vacation", status: "approved", notes: "Kurze Pause" }).run();

    tx.insert(policies).values([
      { label: "Kranken- und Pflegeversicherung Mara", kind: "health", provider: "Nordstern Kranken", policyNumber: "PKV-44021", monthlyPremiumCents: 48_600, renewalDate: on(120), notes: "Private Krankenversicherung der Geschäftsführerin. Keine Lohnabzugsposition." },
      { label: "Betriebshaftpflicht", kind: "liability", provider: "Nordstern Versicherung", policyNumber: "BH-1882", monthlyPremiumCents: 3_500, renewalDate: on(26), notes: "Beispielpolice. Die echte Verlängerung prüfen." },
    ]).run();

    tx.insert(tasks).values([
      { title: "Überfällige Rechnung Havel nachfassen", notes: "Eine Erinnerung, dann eine zweite, bevor eine Mahnung in Betracht kommt.", dueDate: on(2), status: "open", area: "invoices" },
      { title: "Umsatzsteuerzahlen für Oktober zusammenstellen", notes: "Umsatzsteuer, Vorsteuer und die Vorauszahlung.", dueDate: on(12), status: "open", area: "tax" },
      { title: "Unterlagen für die Gesellschafter vorbereiten", notes: "Jahresabschluss, Vorschlag zur Rücklage und der Beschluss.", dueDate: on(21), status: "doing", area: "legal" },
      { title: "Verlängerung der Studioversicherung einreichen", dueDate: on(20), status: "open", area: "cover" },
    ]).run();

    const monday = weekStart(today);
    const tuesday = addDays(monday, 1);
    tx.insert(timeEntries).values([
      { entryDate: monday, startedAt: "09:00", endedAt: "17:30", breakMinutes: 30, memo: "Kundenkorrekturen", billable: true },
      { entryDate: tuesday <= today ? tuesday : monday, startedAt: "09:30", endedAt: "15:00", breakMinutes: 15, memo: "Studioverwaltung und Rechnungsentwurf", billable: false },
    ]).run();

    const settings = { fiscalYearStartMonth: 1, vatPermanentExtension: false, usesTaxAdvisor: false };
    const doneBefore = addDays(today, -20);
    const seen = new Set<string>();
    for (const dueYear of [year - 1, year, year + 1]) {
      for (const item of statutoryObligations(dueYear, settings)) {
        if (seen.has(item.key) || item.dueDate >= doneBefore) continue;
        if (item.when === "vat" || item.when === "payroll" || item.key.includes("advance")) {
          seen.add(item.key);
          tx.insert(obligationStates).values({ key: item.key, status: "done", note: "Beispiel, als erledigt markiert", updatedAt: new Date().toISOString() }).run();
        }
      }
    }

    tx.insert(customDeadlines).values({ title: "Erinnerung an Havel senden", category: "invoices", dueDate: on(3), recurrence: "none", status: "open", notes: "Sachlich und bestimmt bleiben." }).run();

    tx.insert(resolutions).values([
      { resolvedOn: "2024-03-15", title: "Gründung", kind: "formation", body: "Gesellschafter", summary: "Gesellschaft errichtet. Mara Elling zur Geschäftsführerin bestellt. Stammkapital 2.500 € eingezahlt." },
      { resolvedOn: `${year}-01-15`, title: `Feststellung des Jahresabschlusses ${year - 1} und Einstellung in die Rücklage`, kind: "profit", body: "Gesellschafter", summary: "Beispielbeschluss. Ein Viertel des Jahresüberschusses, 1.600 €, wird in die gesetzliche Rücklage eingestellt." },
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
      "Beispieldokument. Durch die beim Registergericht hinterlegte Liste ersetzen.",
      "",
    ].join("\n");
    fs.mkdirSync(uploadsDir(), { recursive: true });
    fs.writeFileSync(path.join(uploadsDir(), storedName), body);
    tx.insert(documents)
      .values({
        title: "Gesellschafterliste (Beispiel)",
        category: "corporate",
        fileName: storedName,
        storedName,
        mimeType: "text/plain",
        sizeBytes: Buffer.byteLength(body),
        notes: "Erfundene Liste der Beispielgesellschaft.",
        uploadedAt: new Date().toISOString(),
      })
      .run();
  });

  }

const sampleText: Record<string, string> = {
  "Formation, share capital paid in": "Gründung, Stammkapital eingezahlt",
  "Sample opening balance brought forward": "Beispiel: Gewinnvortrag",
  "Statutory reserve from the prior-year surplus (sample)": "Gesetzliche Rücklage aus dem Jahresüberschuss des Vorjahres (Beispiel)",
  "Studio rent": "Studiomiete",
  "Design tool subscription": "Abo für Gestaltungssoftware",
  "Advice on the articles": "Beratung zum Gesellschaftsvertrag",
  "Brand workshop": "Markenworkshop",
  "Campaign art direction": "Kampagnengestaltung",
  "Pitch film": "Pitchfilm",
  "Website care, October": "Websitebetreuung Oktober",
  "Proposal, spring lookbook": "Angebot, Lookbook Frühjahr",
  "Managing director": "Geschäftsführerin",
  "Studio assistant": "Studioassistenz",
  "Voluntary cover, see policies": "Private Krankenversicherung, siehe Versicherungen",
  "Controlling shareholder-director. Health insurance is private, not a payroll deduction.": "Beherrschende Gesellschafter-Geschäftsführerin. Die Krankenversicherung ist privat und keine Lohnabzugsposition.",
  "Part-time. Pay sits in the Übergangsbereich.": "Teilzeit. Das Entgelt liegt im Übergangsbereich.",
  "Statutory health insurance": "Gesetzliche Krankenversicherung",
  "Short break": "Kurze Pause",
  "Mara health and care cover": "Kranken- und Pflegeversicherung Mara",
  "Private cover for the managing director. Not a payroll deduction.": "Private Krankenversicherung der Geschäftsführerin. Keine Lohnabzugsposition.",
  "Business liability": "Betriebshaftpflicht",
  "Sample policy. Confirm the real renewal.": "Beispielpolice. Die echte Verlängerung prüfen.",
  "Chase the overdue Havel invoice": "Überfällige Rechnung Havel nachfassen",
  "One reminder, then a second before considering a dunning letter.": "Eine Erinnerung, dann eine zweite, bevor eine Mahnung in Betracht kommt.",
  "Collect October VAT figures": "Umsatzsteuerzahlen für Oktober zusammenstellen",
  "Output VAT, input VAT, and the prepayment.": "Umsatzsteuer, Vorsteuer und die Vorauszahlung.",
  "Draft the shareholder pack": "Unterlagen für die Gesellschafter vorbereiten",
  "Accounts, reserve proposal, and the resolution.": "Jahresabschluss, Vorschlag zur Rücklage und der Beschluss.",
  "File the studio insurance renewal": "Verlängerung der Studioversicherung einreichen",
  "Client revisions": "Kundenkorrekturen",
  "Studio admin and invoice draft": "Studioverwaltung und Rechnungsentwurf",
  "Sample, marked done": "Beispiel, als erledigt markiert",
  "Send the Havel reminder": "Erinnerung an Havel senden",
  "Keep the thread polite and specific.": "Sachlich und bestimmt bleiben.",
  "Formation": "Gründung",
  "Company formed. Mara Elling appointed managing director. Share capital €2,500 paid in.": "Gesellschaft errichtet. Mara Elling zur Geschäftsführerin bestellt. Stammkapital 2.500 € eingezahlt.",
  "Sample resolution. One quarter of the surplus, €1,600, goes to the statutory reserve.": "Beispielbeschluss. Ein Viertel des Jahresüberschusses, 1.600 €, wird in die gesetzliche Rücklage eingestellt.",
  "Sample allocation of one quarter of a €6,400 surplus.": "Beispieleinstellung: ein Viertel eines Jahresüberschusses von 6.400 €.",
  "Shareholder list (sample)": "Gesellschafterliste (Beispiel)",
  "Fictional list for the sample company.": "Erfundene Liste der Beispielgesellschaft.",
};

const sampleChecklist: Record<string, { area: string; title: string; detail: string }> = {
  "Notarial formation and articles": { area: "formation", title: "Notarielle Gründung und Gesellschaftsvertrag", detail: "Die notarielle Urkunde bei den Unterlagen der Gesellschaft aufbewahren." },
  "Commercial register entry": { area: "formation", title: "Eintragung im Handelsregister", detail: "HRB-Eintragung beim Registergericht." },
  "Transparency register": { area: "formation", title: "Transparenzregister", detail: "Den wirtschaftlich Berechtigten eintragen. Bei Änderung der Anteile aktualisieren." },
  "Tax registration questionnaire": { area: "tax", title: "Fragebogen zur steuerlichen Erfassung", detail: "An das Finanzamt übermittelt." },
  "ELSTER certificate": { area: "tax", title: "ELSTER-Zertifikat", detail: "Wird gebraucht, bevor eine Erklärung übermittelt werden kann." },
  "Business bank account": { area: "tax", title: "Geschäftskonto", detail: "Hier gehen Stammkapital und Kundenzahlungen ein." },
  "IHK membership": { area: "trade", title: "IHK-Mitgliedschaft", detail: "Gewerbliche UGs sind in der Regel IHK-Mitglied." },
  "Employers' liability insurance": { area: "people", title: "Berufsgenossenschaft", detail: "Anmeldung bei der Berufsgenossenschaft." },
  "Employment contracts": { area: "people", title: "Arbeitsverträge", detail: "Unterschriebene Verträge für alle auf der Lohnabrechnung." },
  "Working-time records": { area: "people", title: "Arbeitszeitnachweise", detail: "Beginn, Ende und Dauer jedes Arbeitstages." },
  "Impressum and privacy notice": { area: "corporate", title: "Impressum und Datenschutzerklärung", detail: "Erforderlich auf der Website und in Schreiben an Kunden." },
  "Shareholder list is current": { area: "corporate", title: "Gesellschafterliste ist aktuell", detail: "Die Liste beim Handelsregister entspricht der Beteiligung." },
  "Draft the latest annual accounts": { area: "corporate", title: "Jahresabschluss im Entwurf", detail: "Arbeitsschritt vor dem Gesellschafterbeschluss." },
  "Disclose the latest accounts": { area: "corporate", title: "Offenlegung des letzten Jahresabschlusses", detail: "Offenlegung im Bundesanzeiger innerhalb von zwölf Monaten nach Ablauf des Geschäftsjahres." },
  "Reserve resolution on file": { area: "corporate", title: "Beschluss über die Rücklage liegt vor", detail: "Die Einstellung nach § 5a GmbHG braucht einen Gesellschafterbeschluss." },
};

function samplePhrase(value: string): string | null {
  const direct = sampleText[value];
  if (direct) return direct;
  const salary = /^Salary (.+) (\d{4}-\d{2})\. Wage tax is a sample figure, not a calculation\.$/.exec(value);
  if (salary) return `Gehalt ${salary[1]} ${salary[2]}. Die Lohnsteuer ist eine Beispielzahl, keine Berechnung.`;
  const invoice = /^Invoice (RE-\d{4}-\d+)$/.exec(value);
  if (invoice) return `Rechnung ${invoice[1]}`;
  const payment = /^Payment (RE-\d{4}-\d+)$/.exec(value);
  if (payment) return `Zahlung ${payment[1]}`;
  const adopted = /^Adopt FY (\d{4}) accounts and allocate the reserve$/.exec(value);
  if (adopted) return `Feststellung des Jahresabschlusses ${adopted[1]} und Einstellung in die Rücklage`;
  return null;
}

/** Rewrites known English sample sentences. A changed row, or a company that is not the sample, stays as stored. */
export function localizeSample(db: DB) {
  const company = db.select().from(companies).get();
  if (!company?.isSample) return;
  db.transaction((tx) => {
    for (const entry of tx.select().from(journalEntries).all()) {
      const memo = samplePhrase(entry.memo);
      if (memo) tx.update(journalEntries).set({ memo }).where(eq(journalEntries.id, entry.id)).run();
    }
    for (const line of tx.select().from(invoiceLines).all()) {
      const description = samplePhrase(line.description);
      if (description) tx.update(invoiceLines).set({ description }).where(eq(invoiceLines.id, line.id)).run();
    }
    for (const person of tx.select().from(employees).all()) {
      const role = samplePhrase(person.role);
      const notes = samplePhrase(person.notes);
      const healthInsuranceName = samplePhrase(person.healthInsuranceName);
      if (role || notes || healthInsuranceName) {
        tx.update(employees).set({
          ...(role ? { role } : {}),
          ...(notes ? { notes } : {}),
          ...(healthInsuranceName ? { healthInsuranceName } : {}),
        }).where(eq(employees.id, person.id)).run();
      }
    }
    for (const absence of tx.select().from(absences).all()) {
      const notes = samplePhrase(absence.notes);
      if (notes) tx.update(absences).set({ notes }).where(eq(absences.id, absence.id)).run();
    }
    for (const policy of tx.select().from(policies).all()) {
      const label = samplePhrase(policy.label);
      const notes = samplePhrase(policy.notes);
      if (label || notes) tx.update(policies).set({ ...(label ? { label } : {}), ...(notes ? { notes } : {}) }).where(eq(policies.id, policy.id)).run();
    }
    for (const task of tx.select().from(tasks).all()) {
      const title = samplePhrase(task.title);
      const notes = samplePhrase(task.notes);
      if (title || notes) tx.update(tasks).set({ ...(title ? { title } : {}), ...(notes ? { notes } : {}) }).where(eq(tasks.id, task.id)).run();
    }
    for (const entry of tx.select().from(timeEntries).all()) {
      const memo = samplePhrase(entry.memo);
      if (memo) tx.update(timeEntries).set({ memo }).where(eq(timeEntries.id, entry.id)).run();
    }
    for (const state of tx.select().from(obligationStates).all()) {
      const note = samplePhrase(state.note);
      if (note) tx.update(obligationStates).set({ note }).where(eq(obligationStates.key, state.key)).run();
    }
    for (const deadline of tx.select().from(customDeadlines).all()) {
      const title = samplePhrase(deadline.title);
      const notes = samplePhrase(deadline.notes);
      if (title || notes) tx.update(customDeadlines).set({ ...(title ? { title } : {}), ...(notes ? { notes } : {}) }).where(eq(customDeadlines.id, deadline.id)).run();
    }
    for (const resolution of tx.select().from(resolutions).all()) {
      const title = samplePhrase(resolution.title);
      const summary = samplePhrase(resolution.summary);
      const known = Boolean(title) || resolution.title === "Gründung" || resolution.title.startsWith("Feststellung des Jahresabschlusses");
      const body = resolution.body === "shareholders" && known ? "Gesellschafter" : null;
      if (title || summary || body) {
        tx.update(resolutions).set({
          ...(title ? { title } : {}),
          ...(summary ? { summary } : {}),
          ...(body ? { body } : {}),
        }).where(eq(resolutions.id, resolution.id)).run();
      }
    }
    for (const item of tx.select().from(complianceItems).all()) {
      const next = sampleChecklist[item.title];
      if (next) tx.update(complianceItems).set(next).where(eq(complianceItems.id, item.id)).run();
    }
    for (const movement of tx.select().from(reserveMovements).all()) {
      const note = samplePhrase(movement.note);
      if (note) tx.update(reserveMovements).set({ note }).where(eq(reserveMovements.id, movement.id)).run();
    }
    for (const document of tx.select().from(documents).all()) {
      const title = samplePhrase(document.title);
      const notes = samplePhrase(document.notes);
      if (title || notes) tx.update(documents).set({ ...(title ? { title } : {}), ...(notes ? { notes } : {}) }).where(eq(documents.id, document.id)).run();
      if (document.storedName !== "sample-shareholder-list.txt") continue;
      const file = path.join(uploadsDir(), document.storedName);
      if (!fs.existsSync(file)) continue;
      const english = "Sample document. Replace it with the list filed at the commercial register.";
      const body = fs.readFileSync(file, "utf8");
      if (!body.includes(english)) continue;
      const next = body.replace(english, "Beispieldokument. Durch die beim Registergericht hinterlegte Liste ersetzen.");
      fs.writeFileSync(file, next);
      tx.update(documents).set({ sizeBytes: Buffer.byteLength(next) }).where(eq(documents.id, document.id)).run();
    }
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
  const entryId = post(db, input.issue, `Rechnung ${input.number}`, "invoice", String(id), buildSalesInvoice({ kleinunternehmer: false, byRate: totals.byRate }));
  db.update(invoices).set({ journalEntryId: entryId, status: input.paid ? "paid" : "issued" }).where(eq(invoices.id, id)).run();
  if (input.paid) {
    const paymentId = insertId(db.insert(payments).values({ invoiceId: id, paidOn: input.paid, amountCents: totals.grossCents }).run());
    const paymentEntry = post(db, input.paid, `Zahlung ${input.number}`, "payment", String(paymentId), buildCustomerPayment(totals.grossCents));
    db.update(payments).set({ journalEntryId: paymentEntry }).where(eq(payments.id, paymentId)).run();
  }
}
