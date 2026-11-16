/**
 * The operator's recorded time for October and November 2026. It is used by
 * `tests/time-tracking.test.ts` and replayed read-only at `/time/playback`.
 * It is never seeded into the database.
 *
 * A row that reads "Pause" is folded into the surrounding entry as breakMinutes,
 * because a pause is not working time. "inklusive 1 Stunde Pause" becomes 60.
 */
export type TimeTrackingEntry = {
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
  memo: string;
  expectedMinutes: number;
};

export type TimeTrackingDay = {
  date: string;
  expectedMinutes: number;
  entries: TimeTrackingEntry[];
};

export const TIME_TRACKING_DAYS: TimeTrackingDay[] = [
  {
    date: "2026-10-23",
    expectedMinutes: 390,
    entries: [
      {
        date: "2026-10-23",
        start: "09:30",
        end: "10:00",
        breakMinutes: 0,
        memo: "Besprechung mit Sebastian Herrmann (Überblick IT-Infrastruktur)",
        expectedMinutes: 30,
      },
      { date: "2026-10-23", start: "10:00", end: "11:30", breakMinutes: 0, memo: "Vorstellungs-Meeting", expectedMinutes: 90 },
      {
        date: "2026-10-23",
        start: "11:30",
        end: "14:30",
        breakMinutes: 60,
        memo: "Onboarding (Computer-Setup), mit Pause 13:30–14:30",
        expectedMinutes: 120,
      },
      { date: "2026-10-23", start: "14:30", end: "17:00", breakMinutes: 0, memo: "Onboarding (Computer-Setup)", expectedMinutes: 150 },
    ],
  },
  {
    date: "2026-10-26",
    expectedMinutes: 240,
    entries: [
      { date: "2026-10-26", start: "08:00", end: "08:15", breakMinutes: 0, memo: "Git-Repository angesprochen", expectedMinutes: 15 },
      {
        date: "2026-10-26",
        start: "08:15",
        end: "09:00",
        breakMinutes: 0,
        memo: "Einrichtung: E-Mail-Filter, 1Password",
        expectedMinutes: 45,
      },
      {
        date: "2026-10-26",
        start: "09:00",
        end: "09:15",
        breakMinutes: 0,
        memo: "Einrichtung WSL, Konflikte beheben (z. B. Rocket Login)",
        expectedMinutes: 15,
      },
      { date: "2026-10-26", start: "09:15", end: "10:00", breakMinutes: 0, memo: "Einrichtung gitea (Planung)", expectedMinutes: 45 },
      { date: "2026-10-26", start: "10:00", end: "11:00", breakMinutes: 0, memo: "Einrichtung gitea (Ausführung)", expectedMinutes: 60 },
      { date: "2026-10-26", start: "11:00", end: "12:00", breakMinutes: 0, memo: "Einrichtung gitea (Tests)", expectedMinutes: 60 },
    ],
  },
  {
    date: "2026-10-30",
    expectedMinutes: 480,
    entries: [
      { date: "2026-10-30", start: "08:00", end: "09:15", breakMinutes: 0, memo: "Problem mit Laptop (Reboot-Zyklus)", expectedMinutes: 75 },
      { date: "2026-10-30", start: "09:15", end: "12:00", breakMinutes: 0, memo: "Übergabe Laptop an die Technik", expectedMinutes: 165 },
      { date: "2026-10-30", start: "13:00", end: "13:30", breakMinutes: 0, memo: "PC-Setup", expectedMinutes: 30 },
      { date: "2026-10-30", start: "13:30", end: "14:30", breakMinutes: 0, memo: "Meeting, nebenher PC-Setup", expectedMinutes: 60 },
      { date: "2026-10-30", start: "14:30", end: "15:00", breakMinutes: 0, memo: "PC-Setup", expectedMinutes: 30 },
      {
        date: "2026-10-30",
        start: "15:00",
        end: "17:00",
        breakMinutes: 0,
        memo: "Konfiguration gitea, Vorbereitung coolify & uptime kuma",
        expectedMinutes: 120,
      },
    ],
  },
  {
    date: "2026-11-03",
    expectedMinutes: 225,
    entries: [
      {
        date: "2026-11-03",
        start: "08:15",
        end: "10:00",
        breakMinutes: 0,
        memo: "Fertigstellung ITWREPO: Dienste über UI eingerichtet, gitea → coolify, Mailversand",
        expectedMinutes: 105,
      },
      {
        date: "2026-11-03",
        start: "10:00",
        end: "10:45",
        breakMinutes: 0,
        memo: "Development-Dienste: Entra-Auth in gitea, Kuma-Dashboard, E-Mail-Absender, Infra-Skript",
        expectedMinutes: 45,
      },
      {
        date: "2026-11-03",
        start: "10:45",
        end: "11:15",
        breakMinutes: 0,
        memo: "NinjaOne beauftragt; Pain Points (Kunden-Ticket-Automation, neue Website)",
        expectedMinutes: 30,
      },
      {
        date: "2026-11-03",
        start: "11:15",
        end: "12:00",
        breakMinutes: 0,
        memo: "Onboarding HostEurope, Codebasis und SDLC; erster Sync mit Alen Zukic",
        expectedMinutes: 45,
      },
    ],
  },
  {
    date: "2026-11-06",
    expectedMinutes: 465,
    entries: [
      {
        date: "2026-11-06",
        start: "08:15",
        end: "10:00",
        breakMinutes: 0,
        memo: "Neue Website aufbereitet und in gitea hochgeladen; gitea-Einstellungen; VPN",
        expectedMinutes: 105,
      },
      { date: "2026-11-06", start: "10:00", end: "11:00", breakMinutes: 0, memo: "Meeting: zukünftige interne Systeme", expectedMinutes: 60 },
      {
        date: "2026-11-06",
        start: "11:00",
        end: "13:20",
        breakMinutes: 0,
        memo: "Portainer aufgesetzt; Software-Projekte mit Alen Zukic eingecheckt",
        expectedMinutes: 140,
      },
      {
        date: "2026-11-06",
        start: "14:20",
        end: "17:00",
        breakMinutes: 0,
        memo: "Restliche Projekte hochgeladen; Planner; MCP-Server-Planung; Fragenkatalog",
        expectedMinutes: 160,
      },
    ],
  },
  {
    date: "2026-11-07",
    expectedMinutes: 180,
    entries: [
      { date: "2026-11-07", start: "14:00", end: "16:00", breakMinutes: 0, memo: "Fragenkatalog (IPR und allgemein)", expectedMinutes: 120 },
      {
        date: "2026-11-07",
        start: "16:00",
        end: "17:00",
        breakMinutes: 0,
        memo: "Interaktive Architektur der internen Infrastruktur mit Workflows",
        expectedMinutes: 60,
      },
    ],
  },
  {
    date: "2026-11-10",
    expectedMinutes: 580,
    entries: [
      { date: "2026-11-10", start: "08:30", end: "12:00", breakMinutes: 0, memo: "IPR: Vorbereitung, Meeting, Nachbereitung", expectedMinutes: 210 },
      {
        date: "2026-11-10",
        start: "12:00",
        end: "13:00",
        breakMinutes: 0,
        memo: "Einführung Microsoft Planner, Ticketverteilung, Sync mit Alen Zukic",
        expectedMinutes: 60,
      },
      {
        date: "2026-11-10",
        start: "13:00",
        end: "13:30",
        breakMinutes: 0,
        memo: "Sync mit Sebastian Herrmann: IPR, Monitoring, NinjaOne-Rechte",
        expectedMinutes: 30,
      },
      {
        date: "2026-11-10",
        start: "13:30",
        end: "19:10",
        breakMinutes: 60,
        memo: "Nachbereitung IPR, NinjaOne-MCP/KI, Etiketten-Drucker, mit 1 Stunde Pause",
        expectedMinutes: 280,
      },
    ],
  },
  {
    date: "2026-11-13",
    expectedMinutes: 540,
    entries: [
      {
        date: "2026-11-13",
        start: "09:00",
        end: "19:00",
        breakMinutes: 60,
        memo: "Label-Printer, NinjaOne-MCP, IPR-Dokumentation, ITWREPO, mit 1 Stunde Pause",
        expectedMinutes: 540,
      },
    ],
  },
  {
    date: "2026-11-16",
    expectedMinutes: 45,
    entries: [
      {
        date: "2026-11-16",
        start: "14:00",
        end: "14:45",
        breakMinutes: 0,
        memo: "Sync mit Alen Zukic: SSL-Zertifikat, Webhooks, PowerShell-Dokumentation",
        expectedMinutes: 45,
      },
    ],
  },
];

export const TIME_TRACKING_ENTRIES: TimeTrackingEntry[] = TIME_TRACKING_DAYS.flatMap((day) => day.entries);

export const TIME_TRACKING_TOTAL_MINUTES = TIME_TRACKING_DAYS.reduce((sum, day) => sum + day.expectedMinutes, 0);