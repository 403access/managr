import type { PlanStep } from "@/domain/assistant-plan";
import type { ProposalChange, StreamEvent } from "@/client/assistant-types";
import { addDays } from "@/domain/calendar";

type Copy = { de: string; en: string };

/** One event of a canned turn, with the wait before it at 1× speed. */
export type MockEvent = { after: number; event: StreamEvent };

export type MockSession = {
  id: string;
  title: Copy;
  note: Copy;
  prompt: Copy;
  model: { name: string; provider: string; protocol: "openai" | "anthropic"; baseUrl: string; local: boolean };
  /** How often the prompt was already sent; the details show the retry line. */
  retries?: number;
  events: MockEvent[];
};

const MODEL = {
  name: "DeepSeek V4 Flash (0731)",
  provider: "Qwen Cloud (Token Plan)",
  protocol: "openai" as const,
  baseUrl: "https://token-plan.maas.qwencloudapi.com/compatible-mode/v1",
  local: false,
};

const MODEL_EVENT: Extract<StreamEvent, { type: "model" }> = {
  type: "model",
  model: MODEL.name,
  baseUrl: MODEL.baseUrl,
  local: MODEL.local,
  providerID: "qwen",
  modelID: "deepseek-v4.1-flash-1017",
  protocol: "openai",
};

const today = "2026-11-22";

function timeEntry(
  id: number,
  entryDate: string,
  startedAt: string,
  endedAt: string,
  minutes: number,
  memo: string,
  taskType = "Entwicklung",
) {
  return {
    id,
    entryDate,
    startedAt,
    endedAt,
    breakMinutes: 0,
    memo,
    activities: [],
    billable: true,
    taskId: null,
    employeeId: 1,
    contactId: null,
    contactName: "",
    contactCustomerId: null,
    contactCustomerName: "",
    projectId: 1,
    projectName: "IT Works",
    customerId: 1,
    customerName: "IT Works GmbH",
    taskType,
    firstName: "Oliver",
    personName: "Oliver Molnar",
    minutes,
    warnings: [],
    error: "",
    hourlyRateCents: null,
    rate: { cents: 3000, source: "global" },
    valueCents: minutes * 50,
  };
}

function week(start: string, entries: ReturnType<typeof timeEntry>[]) {
  const total = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  return {
    anchor: start,
    today,
    start,
    end: addDays(start, 6),
    entries,
    total,
    billableTotal: total,
    billableValueCents: entries.reduce((sum, entry) => sum + entry.valueCents, 0),
    globalHourlyRateCents: 3000,
    people: [{ id: 1, firstName: "Oliver", lastName: "Molnar" }],
    contacts: [],
    tasks: [],
    projects: [{ id: 1, name: "IT Works", customerId: 1, customerName: "IT Works GmbH", hourlyRateCents: 3000 }],
  };
}

function read(after: number, name: string, input: Record<string, unknown>, data: unknown): MockEvent[] {
  return [
    { after, event: { type: "tool", name, input } },
    { after: 450, event: { type: "tool_result", name, input, ok: true, summary: "ok", data } },
  ];
}

function failed(after: number, name: string, input: Record<string, unknown>, summary: string): MockEvent[] {
  return [
    { after, event: { type: "tool", name, input } },
    { after: 450, event: { type: "tool_result", name, input, ok: false, summary } },
  ];
}

function plan(after: number, steps: PlanStep[]): MockEvent {
  return { after, event: { type: "plan", steps } };
}

/** The server streams text token by token, then sends the final reply. */
function reply(after: number, text: string): MockEvent[] {
  const events: MockEvent[] = [];
  let chunk = "";
  for (const word of text.split(/(?<=\s)/)) {
    chunk += word;
    if (chunk.length >= 28) {
      events.push({ after: events.length === 0 ? after : 28, event: { type: "delta", text: chunk } });
      chunk = "";
    }
  }
  if (chunk) events.push({ after: events.length === 0 ? after : 28, event: { type: "delta", text: chunk } });
  events.push({ after: 120, event: { type: "reply", text } });
  return events;
}

function proposal(after: number, id: string, changes: ProposalChange[]): MockEvent {
  return { after, event: { type: "proposal", id, changes } };
}

const WEEK_1 = week("2026-11-02", [
  timeEntry(24, "2026-11-03", "09:00", "10:00", 60, "Rechnungspositionen abstimmen"),
  timeEntry(25, "2026-11-03", "10:00", "10:45", 45, "XRechnung prüfen"),
  timeEntry(26, "2026-11-03", "13:00", "14:00", 60, "Schnittstelle IT Works"),
  timeEntry(27, "2026-11-03", "14:00", "15:00", 60, "Fehlerprotokoll auswerten"),
  timeEntry(28, "2026-11-06", "08:00", "10:00", 120, "Mandantentrennung testen"),
  timeEntry(29, "2026-11-06", "10:00", "11:55", 115, "Import korrigieren"),
  timeEntry(30, "2026-11-06", "13:00", "15:00", 120, "Freigabe vorbereiten"),
  timeEntry(31, "2026-11-06", "15:00", "16:50", 110, "Rückfragen beantworten"),
  timeEntry(32, "2026-11-07", "09:00", "10:30", 90, "Wochenabschluss"),
  timeEntry(33, "2026-11-07", "10:30", "12:00", 90, "Übergabe dokumentieren"),
]);

const WEEK_2 = week("2026-11-09", [
  timeEntry(40, "2026-11-10", "08:00", "10:25", 145, "Datenübernahme", "Beratung"),
  timeEntry(41, "2026-11-10", "10:30", "12:55", 145, "Datenübernahme", "Beratung"),
  timeEntry(42, "2026-11-10", "13:30", "15:55", 145, "Abstimmung Buchhaltung", "Beratung"),
  timeEntry(43, "2026-11-10", "16:00", "18:25", 145, "Abstimmung Buchhaltung", "Beratung"),
  timeEntry(44, "2026-11-13", "08:00", "17:00", 540, "Migration Livegang"),
]);

const WEEK_3 = week("2026-11-16", [
  timeEntry(45, "2026-11-16", "09:00", "09:45", 45, "Nachbereitung Livegang"),
]);

const WEEK_4 = week("2026-11-23", []);

export const MOCK_SESSIONS: MockSession[] = [
  {
    id: "time-weeks",
    title: { de: "Vier Wochen Zeiten", en: "Four weeks of time" },
    note: {
      de: "Vier „Zeiten lesen“-Aufrufe, kein update_plan. So sah die gemeldete Sitzung aus: eine Gruppe mit vier Punkten, daneben der zuletzt gelesene Aufruf – aber ohne Roadmap.",
      en: "Four “read time” calls, no update_plan. The reported session looked like this: one group with four dots beside the newest call that was read, but no roadmap.",
    },
    prompt: {
      de: "alle zeit-einträge im november müssen auf berechenbar gesetzt werden",
      en: "all november time entries must be set to billable",
    },
    model: MODEL,
    events: [
      { after: 0, event: MODEL_EVENT },
      ...read(200, "read_time", { anyDayInWeek: "2026-11-02" }, WEEK_1),
      ...read(220, "read_time", { anyDayInWeek: "2026-11-09" }, WEEK_2),
      ...read(220, "read_time", { anyDayInWeek: "2026-11-16" }, WEEK_3),
      ...read(220, "read_time", { anyDayInWeek: "2026-11-23" }, WEEK_4),
      ...reply(
        300,
        [
          "Alle 16 November-Einträge sind bereits als **berechenbar** (`billable`) gesetzt. Es gibt keinen Eintrag, den ich umstellen müsste.",
          "",
          "| Datum | Einträge | Berechenbar | Minuten |",
          "|---|---|---|---|",
          "| 03.11. | #24–#27 | ja | 225 |",
          "| 06.11. | #28–#31 | ja | 465 |",
          "| 07.11. | #32–#33 | ja | 180 |",
          "| 10.11. | #40–#43 | ja | 580 |",
          "| 13.11. | #44 | ja | 540 |",
          "| 16.11. | #45 | ja | 45 |",
          "",
          "Summe: **2.035 Minuten = 33,92 h**. Der November-Entwurf **#4** ist damit unverändert aktuell (16 Positionen, 1.017,50 €).",
          "",
          "Sollen die Entwürfe **#3** (Oktober) und **#4** (November) jetzt ausgegeben werden?",
        ].join("\n"),
      ),
    ],
  },
  {
    id: "plan-changes",
    title: { de: "Roadmap mit Änderungen", en: "Roadmap with changes" },
    note: {
      de: "update_plan läuft mit: Schritte wechseln auf erledigt, ein Schritt wird aufgenommen, einer übersprungen, einer nachträglich geändert.",
      en: "update_plan is present: steps go done, one is added, one skipped, one changed afterwards.",
    },
    prompt: {
      de: "Prüfe den Monatsabschluss November und sag mir, was fehlt.",
      en: "Check the November close and tell me what is missing.",
    },
    model: MODEL,
    events: [
      { after: 0, event: MODEL_EVENT },
      plan(120, [
        { id: "1", title: "Zeiten und Aufgaben lesen", status: "doing" },
        { id: "2", title: "Offene Rechnungen prüfen", status: "pending" },
        { id: "3", title: "Belege und Buchungen lesen", status: "pending" },
        { id: "4", title: "Monatsabschluss bewerten", status: "pending" },
      ]),
      ...read(350, "read_time", { anyDayInWeek: "2026-11-16" }, WEEK_3),
      plan(200, [
        { id: "1", title: "Zeiten und Aufgaben lesen", status: "done" },
        { id: "2", title: "Offene Rechnungen prüfen", status: "doing" },
        { id: "3", title: "Belege und Buchungen lesen", status: "pending" },
        { id: "4", title: "Monatsabschluss bewerten", status: "pending" },
        { id: "5", title: "Ergebnis bestätigen", status: "pending" },
      ]),
      ...read(400, "read_invoices", {}, {
        invoices: [
          { id: 3, number: "2026-003", customerName: "IT Works GmbH", displayStatus: "sent", grossCents: 55500, openCents: 55500, dueDate: "2026-11-05" },
          { id: 4, number: "2026-004", customerName: "IT Works GmbH", displayStatus: "draft", grossCents: 101750, openCents: 101750, dueDate: "2026-11-26" },
        ],
      }),
      plan(200, [
        { id: "1", title: "Zeiten und Aufgaben lesen", status: "done" },
        { id: "2", title: "Offene Rechnungen prüfen", status: "done" },
        { id: "3", title: "Belege und Buchungen lesen", status: "doing" },
        { id: "4", title: "Entwurf #4 prüfen", status: "skipped", note: "Entwurf #4 ist bereits vollständig." },
        { id: "5", title: "Ergebnis bestätigen", status: "pending" },
      ]),
      ...read(400, "read_ledger", { year: 2026 }, {
        year: 2026,
        accounts: [
          { code: "1200", name: "Bank", debitCents: 2890500, creditCents: 0 },
          { code: "8400", name: "Erlöse 19 %", debitCents: 0, creditCents: 2890500 },
        ],
        entries: 42,
      }),
      plan(200, [
        { id: "1", title: "Zeiten und Aufgaben lesen", status: "done" },
        { id: "2", title: "Offene Rechnungen prüfen", status: "done" },
        { id: "3", title: "Belege und Buchungen lesen", status: "done" },
        { id: "4", title: "Entwurf #4 prüfen", status: "skipped", note: "Entwurf #4 ist bereits vollständig." },
        { id: "5", title: "Ergebnis bestätigen", status: "done" },
      ]),
      ...reply(
        350,
        [
          "Der November ist buchhalterisch sauber, es fehlen nur zwei Entscheidungen:",
          "",
          "- **Entwurf #4** ist vollständig (16 Positionen, **1.017,50 €**) und wartet auf das Stellen.",
          "- **Rechnung #3** ist seit dem 05.11. offen (**555,00 €**) – hier wäre eine Zahlungserinnerung fällig.",
          "",
          "> Beide Beträge sind ohne Umsatzsteuer, weil die Kleinunternehmerregelung nach § 19 UStG gilt.",
          "",
          "Offene Punkte:",
          "",
          "- [x] Zeiten geprüft",
          "- [x] Belege geprüft",
          "- [ ] Entwurf #4 stellen",
          "- [ ] Zahlungserinnerung für #3 entwerfen",
        ].join("\n"),
      ),
    ],
  },
  {
    id: "approval-pending",
    title: { de: "Bestätigung offen", en: "Approval pending" },
    note: {
      de: "Endet mit der Bestätigungskarte: eine Zeit wird angelegt, eine aktualisiert. „Alle übernehmen“ zeigt die Schreibaufrufe; sonst passiert nichts.",
      en: "Stops on the approval card: one time entry is added, one updated. “Approve all” shows the writes; otherwise nothing happens.",
    },
    prompt: {
      de: "Trag die Zeit für gestern nach und korrigiere den Eintrag #45 auf 60 Minuten.",
      en: "Add yesterday's time and correct entry #45 to 60 minutes.",
    },
    model: MODEL,
    events: [
      { after: 0, event: MODEL_EVENT },
      plan(120, [
        { id: "1", title: "Zeit und Eintrag lesen", status: "doing" },
        { id: "2", title: "Änderungen vorbereiten", status: "pending" },
      ]),
      ...read(350, "read_time", { anyDayInWeek: "2026-11-16" }, WEEK_3),
      plan(200, [
        { id: "1", title: "Zeit und Eintrag lesen", status: "done" },
        { id: "2", title: "Änderungen vorbereiten", status: "doing" },
      ]),
      proposal(400, "mock-approval-1", [
        {
          callId: "call-add",
          name: "add_time",
          action: "add",
          input: {
            entryDate: "2026-11-21",
            startedAt: "09:00",
            endedAt: "12:30",
            breakMinutes: 30,
            memo: "Nachbereitung Livegang",
            projectId: 1,
            taskType: "Beratung",
            billable: true,
          },
          labels: { projectId: "IT Works" },
        },
        {
          callId: "call-update",
          name: "update_time",
          action: "update",
          input: { id: 45, endedAt: "09:45", memo: "Nachbereitung Livegang" },
        },
      ]),
    ],
  },
  {
    id: "approval-done",
    title: { de: "Bestätigt und gebucht", en: "Approved and posted" },
    note: {
      de: "Dieselbe Freigabe, danach laufen die Schreibaufrufe: Häkchen, Ergebnis je Aufruf und Öffnen-Link.",
      en: "The same confirmation, then the writes run: checkmarks, per-call results, and an open link.",
    },
    prompt: {
      de: "Buch die Zeit und speichere die Korrektur.",
      en: "Post the time and save the correction.",
    },
    model: MODEL,
    events: [
      { after: 0, event: MODEL_EVENT },
      plan(120, [
        { id: "1", title: "Änderungen vorbereiten", status: "doing" },
        { id: "2", title: "Buchung prüfen", status: "pending" },
      ]),
      proposal(350, "mock-approval-2", [
        {
          callId: "call-add",
          name: "add_time",
          action: "add",
          input: {
            entryDate: "2026-11-21",
            startedAt: "09:00",
            endedAt: "12:30",
            breakMinutes: 30,
            memo: "Nachbereitung Livegang",
            projectId: 1,
            taskType: "Beratung",
            billable: true,
          },
          labels: { projectId: "IT Works" },
        },
        {
          callId: "call-update",
          name: "update_time",
          action: "update",
          input: { id: 45, endedAt: "09:45", memo: "Nachbereitung Livegang" },
        },
      ]),
      { after: 900, event: { type: "tool", name: "add_time", input: { entryDate: "2026-11-21", memo: "Nachbereitung Livegang" } } },
      {
        after: 500,
        event: {
          type: "tool_result",
          name: "add_time",
          input: { entryDate: "2026-11-21", memo: "Nachbereitung Livegang" },
          ok: true,
          summary: "ok",
          data: { id: 46, entryDate: "2026-11-21", minutes: 180, billable: true },
        },
      },
      { after: 500, event: { type: "tool", name: "update_time", input: { id: 45, endedAt: "09:45" } } },
      {
        after: 500,
        event: {
          type: "tool_result",
          name: "update_time",
          input: { id: 45, endedAt: "09:45" },
          ok: true,
          summary: "ok",
          data: { id: 45, entryDate: "2026-11-16", minutes: 60, billable: true },
        },
      },
      plan(200, [
        { id: "1", title: "Änderungen vorbereiten", status: "done" },
        { id: "2", title: "Buchung prüfen", status: "done" },
      ]),
      ...reply(300, "Beides ist gebucht: der neue Eintrag vom 21.11. und die Korrektur an **#45** (jetzt 60 Minuten). Du findest beides unter **Zeit**."),
    ],
  },
  {
    id: "errors",
    title: { de: "Fehler und Kürzung", en: "Errors and truncation" },
    note: {
      de: "Ein Aufruf scheitert, ein Ergebnis ist zu groß für die Anzeige, dazu Websuche und Webseite. Der Fehler steht am Aufruf, die Punkte bleiben bedienbar.",
      en: "One call fails, one result is too large to show, plus a web search and page. The error sits on the call; the dots stay usable.",
    },
    prompt: {
      de: "Lies das Hauptbuch und such im Netz nach der Aufbewahrungsfrist für Rechnungen.",
      en: "Read the ledger and search the web for the retention period for invoices.",
    },
    model: MODEL,
    events: [
      { after: 0, event: MODEL_EVENT },
      ...read(150, "read_time", { anyDayInWeek: "2026-11-16" }, WEEK_3),
      ...failed(250, "read_documents", {}, "The tool read_documents failed: the document store is not reachable."),
      ...read(250, "read_ledger", { year: 2026 }, { truncated: true }),
      ...read(250, "web_search", { query: "Aufbewahrungsfrist Rechnungen Deutschland" }, {
        results: [
          { title: "Aufbewahrungsfristen für Buchungsbelege", url: "https://www.bundesfinanzministerium.de/..." },
          { title: "§ 147 AO", url: "https://www.gesetze-im-internet.de/ao_1977/__147.html" },
          { title: "GOBD", url: "https://www.bundesfinanzministerium.de/..." },
        ],
      }),
      ...read(300, "web_fetch", { url: "https://www.gesetze-im-internet.de/ao_1977/__147.html" }, {
        url: "https://www.gesetze-im-internet.de/ao_1977/__147.html",
        title: "§ 147 AO – Aufbewahrung von Unterlagen",
        text: "…",
      }),
      ...reply(
        300,
        [
          "Zwei Dinge:",
          "",
          "- Das **Hauptbuch** konnte ich wegen der Größe nur gekürzt zurückgeben; im Aufruf steht der Hinweis.",
          "- Die **Dokumentenliste** war nicht erreichbar – der Aufruf ist rot markiert.",
          "",
          "Zur Frist: Buchungsbelege sind nach **§ 147 AO** zehn Jahre aufzubewahren. Quelle: [gesetze-im-internet.de](https://www.gesetze-im-internet.de/ao_1977/__147.html).",
        ].join("\n"),
      ),
    ],
  },
  {
    id: "markdown",
    title: { de: "Lange Antwort und Details", en: "Long answer and details" },
    note: {
      de: "Markdown mit Überschrift, Zitat, Checkliste und Tabelle, dazu eine erneut gesendete Frage mit Retry-Details.",
      en: "Markdown with heading, quote, checklist, and table, plus a re-sent question with retry details.",
    },
    prompt: {
      de: "Gib mir ein Briefing für heute.",
      en: "Give me a briefing for today.",
    },
    model: MODEL,
    retries: 1,
    events: [
      { after: 0, event: MODEL_EVENT },
      plan(120, [
        { id: "1", title: "Bank und Rechnungen lesen", status: "doing" },
        { id: "2", title: "Fristen und Aufgaben lesen", status: "pending" },
      ]),
      ...read(250, "read_desk", {}, {
        today,
        bankCents: 1_289_050,
        receivablesCents: 555_00,
        profitCents: 2_890_500 - 1_640_000,
        openInvoices: 1,
      }),
      plan(200, [
        { id: "1", title: "Bank und Rechnungen lesen", status: "done" },
        { id: "2", title: "Fristen und Aufgaben lesen", status: "doing" },
      ]),
      ...read(250, "read_obligations", { year: 2026 }, {
        year: 2026,
        due: [{ id: "vat-11", title: "Umsatzsteuer-Voranmeldung November 2026", dueDate: "2026-12-10", status: "open" }],
        later: [],
        deadlines: [{ id: 7, title: "Kontoauszüge November", dueDate: "2026-11-30" }],
      }),
      plan(200, [
        { id: "1", title: "Bank und Rechnungen lesen", status: "done" },
        { id: "2", title: "Fristen und Aufgaben lesen", status: "done" },
      ]),
      ...reply(
        300,
        [
          "# Briefing für Sonntag, 22.11.2026",
          "",
          "## Lage",
          "",
          "Auf dem Konto liegen **12.890,50 €**, offen ist noch die Rechnung **#3** über **555,00 €**.",
          "",
          "> Die Forderung ist seit dem 05.11. überfällig. Eine Zahlungserinnerung ist sinnvoll, aber nicht dringend.",
          "",
          "## Nächste Schritte",
          "",
          "1. **Entwurf #4** (November, 1.017,50 €) stellen.",
          "2. Zahlungserinnerung für **#3** entwerfen.",
          "3. Kontoauszüge bis zum **30.11.** abgleichen.",
          "",
          "| Frist | Datum | Status |",
          "|---|---|---|",
          "| Kontoauszüge November | 30.11.2026 | offen |",
          "| USt-Voranmeldung November | 10.12.2026 | offen |",
          "",
          "- [ ] Entwurf #4 stellen",
          "- [ ] Erinnerung #3 senden",
          "- [x] Briefing gelesen",
        ].join("\n"),
      ),
    ],
  },
];