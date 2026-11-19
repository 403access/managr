---
slug: /steuererklaerung-plan
sidebar_label: Steuererklärungen (Plan)
---

# Steuererklärungen und ELSTER — Umsetzungsplan

Stand: 19. November 2026. Dieser Plan beschreibt die Einführung eines Steuererklärungs-Features mit Anbindung an ELSTER. Er ist eine Umsetzungsnotiz, keine Steuerberatung. Verbindlich sind amtliche Vorgaben, die aktuelle ERiC-Dokumentation und die Freigabe durch eine steuerberatende Person.

**Umsetzungsstand:** Phase 1 und 2 sind umgesetzt. Enthalten sind Datenmodell, Domain-Prüfungen, `/tax`, der manuelle Abgabeweg mit Nachweis, der UStVA-Upload für Mein ELSTER und die Datenexporte. Nicht enthalten sind ERiC, Zertifikate, PIN und die echte Übermittlung (Phase 3/4).

## 1. Ziel

Die Gesellschaft soll ihre laufenden und jährlichen Steuererklärungen im Desk vorbereiten, prüfen, freigeben, übermitteln und archivieren können:

- Zahlen kommen aus Journal, Rechnungen und Stammdaten, nicht aus einer zweiten Eingabe.
- Vor der Abgabe zeigt der Desk, welche Werte übernommen wurden, welche Prüfungen fehlschlagen und was nur ein Hinweis ist.
- Eine Übermittlung ist nur möglich, wenn eine echte ELSTER-Verbindung eingerichtet ist. Ohne sie gibt es einen ehrlichen Export- und Nachweis-Weg, keine simulierte Abgabe.
- Jede Übermittlung hinterlässt ein unveränderliches Protokoll mit Zeitpunkt, Umgebung, Datenhash, Empfangsbestätigung und Fehlertext.

## 2. Umfang

### 2.1 Steuerarten

| Steuerart | Zeitraum | Datenquelle | Phase |
| --- | --- | --- | --- |
| Umsatzsteuer-Voranmeldung (UStVA) | Monat oder Quartal | Journal, Rechnungen, `summarizeVat` | 2 |
| Umsatzsteuer-Jahreserklärung (USt 1 A) | Kalenderjahr | Journal, Voranmeldungen | 2 |
| Körperschaftsteuererklärung (KSt 1) | Wirtschaftsjahr | Jahresergebnis, `estimateCorporateTax` | 3 |
| Gewerbesteuererklärung (GewSt 1) | Wirtschaftsjahr | Jahresergebnis, Hebesatz | 3 |
| E-Bilanz (Taxonomie) | Wirtschaftsjahr | Bilanz und GuV aus dem Journal | 3 |
| Lohnsteuer-Anmeldung (LStA) | Monat | gebuchte Lohnsteuer | 4, nur wenn Bedarf |
| Zusammenfassende Meldung (ZM) | Monat/Quartal | EU-Rechnungen | 4, nur bei EU-Umsätzen |

Nicht in diesem Feature:

- Private Einkommensteuer der Gesellschafter. Der Gewinn der UG gehört nicht in Anlage G oder S.
- Lohnsteuerberechnung, ELStAM, DEÜV, Beitragsnachweise.
- ELSTER-Postfach, Bescheidabruf und Belegabruf (Datenabholung). Das ist ein eigener Zustimmungstatbestand und ein separates Feature.
- E-Rechnungs-Versand, DATEV-Export, Bank-CSV.
- Steuerliche Würdigung oder Angemessenheitsprüfung. Der Desk berechnet und prüft technisch, er entscheidet nicht.

### 2.2 Betriebsmodi

1. **Vorbereitung ohne ELSTER** (ab Phase 1): Erklärung anlegen, Zahlen übernehmen, prüfen, XML und Prüfbericht erzeugen, manuell abgeben, Nachweis erfassen.
2. **Testübermittlung** (ab Phase 3): echte ERiC-Prüfung und Übermittlung mit Testmerker. Das Ergebnis wird nie als „an das Finanzamt abgegeben“ angezeigt.
3. **Echtübermittlung** (ab Phase 4): nur mit Hersteller-ID, gültigem Zertifikat, PIN, bestätigtem Datenschutzhinweis und ausdrücklicher Freigabe.

## 3. Rechtliche und technische Leitplanken

Diese Punkte sind Startbedingungen, keine Details am Ende:

- **ERiC ist Pflicht.** Nach § 87a Abs. 6 AO ist für amtlich vorgeschriebene Datensätze ein authentifiziertes, verschlüsseltes Verfahren nötig. Die Finanzverwaltung eröffnet diesen Weg über ELSTER; für Software führt er über die C-Bibliothek ERiC. Ein selbst gebauter HTTP-Client oder ein „PDF-Upload“ ersetzt das nicht.
- **Hersteller-Registrierung.** ELSTER verlangt eine Registrierung als Hersteller/Entwickler, die Prüfung durch das Bayerische Landesamt für Steuern, eine Hersteller-ID und die Einhaltung des ERiC-Lizenzvertrags. Die frühere Test-Hersteller-ID ist gesperrt; auch Tests brauchen eine eigene ID.
- **Zertifikat und PIN.** Die Übermittlung signiert mit einer ELSTER-Zertifikatsdatei (`.pfx`) und PIN. ELSTER Secure ist nur für Mein ELSTER, nicht für ERiC. Das Zertifikat gilt befristet und muss vor Ablauf gewarnt werden.
- **Datenschutzhinweis.** Der ERiC-Lizenzvertrag verlangt, dass die Datenschutzhinweise der Finanzverwaltung vor der ersten Nutzung angezeigt und bestätigt werden. Die Bestätigung wird mit Zeitpunkt gespeichert.
- **Testmerker.** Testübermittlungen laufen mit dem vorgesehenen Testmerker an dieselben Annahmeserver. Sie dürfen nie als Produktionsabgabe erscheinen.
- **Keine vorgetäuschte Abgabe.** Ohne gültige Konfiguration zeigt die Oberfläche „nicht übermittelt“. Ein Fortschrittsbalken, ein Fake-Ticket oder ein Status „accepted“ ohne Serverantwort ist unzulässig.
- **Auftraggeberprüfung.** Bei Abgabe für Dritte verlangt § 87d AO Identifizierung und eine nachprüfbare Datenfassung. Der Desk ist für die eigene Gesellschaft gebaut; eine Mandantenfunktion ist nicht Teil dieses Plans.
- **Aufbewahrung.** Übermittlungsprotokolle, XML-Snapshot und Empfangs-PDF werden lokal aufbewahrt. Sie sind Nachweis, nicht nur Cache.

## 4. Architektur

```
Browser
  └─ Next.js App Router (Server Components + Server Actions)
       ├─ src/domain/tax-filing.ts       Status, Fristen, Prüfungen (pure)
       ├─ src/domain/elster-format.ts    Kennzahlen-Mapping, XML (pure, versioniert)
       ├─ src/server/tax-filings.ts      Snapshot, Prüfungen, Persistenz
       ├─ src/server/elster/transport.ts Adapter-Vertrag
       │    ├─ manual.ts                 Export + Nachweis erfassen
       │    └─ eric.ts                   HTTP zu lokalem Sidecar
       └─ data/elster/                   XML, Protokolle, Zertifikat (gitignored)

ELSTER-Sidecar (eigener Prozess, nur lokal)
  └─ ERiC (C-Bibliothek) ──► ELSTER-Annahmeserver (Test/Produktion)
```

Warum ein Sidecar: ERiC ist eine native C-Bibliothek und gehört nicht in den Next.js-Prozess. Der Sidecar kapselt Laden, Version, Zertifikat, PIN und Fehlercodes. Der Desk spricht nur HTTP mit ihm. Fällt der Sidecar aus, bleibt der manuelle Weg nutzbar.

Der Sidecar wird **nicht** mit ERiC-Binärdateien ausgeliefert. Das Image erwartet ein gemountetes ERiC-Paket unter `/opt/eric` und eine eigene Hersteller-ID. Ohne beides antwortet er mit `503` und der Desk zeigt den manuellen Weg.

## 5. Datenmodell

Neue Tabellen in `src/db/migrations/0019_tax_filings.sql` und `src/db/schema.ts` (Nummer beim Start gegen die dann vorhandenen Migrationen prüfen; `0018` ist bereits durch Time-Einträge belegt):

### `tax_filings`

| Spalte | Typ | Bedeutung |
| --- | --- | --- |
| `id` | integer PK | |
| `company_id` | integer FK | aktive Gesellschaft |
| `kind` | text | `ustva`, `ust-annual`, `kst`, `gewst`, `ebilanz`, `lst`, `zm` |
| `year` | integer | Steuerjahr |
| `period_key` | text | `2026-03`, `2026-Q1`, `2026` |
| `status` | text | siehe Statusmaschine |
| `due_date` | text | aus `statutoryObligations`, überschreibbar mit Begründung |
| `figures_json` | text | eingefrorener Zahlen-Snapshot |
| `figures_hash` | text | SHA-256 über den kanonischen Snapshot |
| `checks_json` | text | letzte Prüfergebnisse mit Schweregrad |
| `format_version` | text | z. B. `UStVA-2026`, `KSt1-2026` |
| `replaces_id` | integer FK | berichtigte Erklärung |
| `submitted_at` | text | Zeitpunkt der Abgabe |
| `accepted_at` | text | Zeitpunkt der Annahme |
| `notes` | text | |
| `deleted_at` | text | Soft Delete für Entwürfe |
| `created_at`, `updated_at` | text | ISO |

Eindeutigkeit: `(company_id, kind, year, period_key)` für aktive Originale; eine Berichtigung trägt `replaces_id` und darf daneben bestehen. Die Regel wird serverseitig geprüft, damit SQLite NULL-Werte in einem Unique-Index nicht als Kollision behandelt.

### `tax_filing_events`

Append-only-Audit: `id`, `tax_filing_id`, `at`, `type`, `actor` (`desk`/`assistant`/`manual`), `from_status`, `to_status`, `detail_json`, `payload_hash`. Ereignisse werden nie geändert oder gelöscht.

### `elster_settings`

Pro Gesellschaft: `company_id` PK, `environment` (`test`/`production`), `hersteller_id`, `software_name`, `software_version`, `certificate_name`, `certificate_ciphertext`, `certificate_valid_until`, `certificate_fingerprint`, `privacy_acknowledged_at`, `eric_version`, `last_checked_at`, `updated_at`.

Das Zertifikat wird AES-256-GCM verschlüsselt. Der Schlüssel kommt aus `MANAGR_ELSTER_KEY` oder aus `data/elster.key` (chmod 600, gitignored). Das Klartext-Zertifikat und die PIN werden nie an den Browser, nie in Views und nie in Tool-Ergebnisse gegeben.

### `elster_transmissions`

`id`, `tax_filing_id`, `environment`, `transport` (`manual`/`eric`), `test_marker`, `started_at`, `finished_at`, `status`, `eric_version`, `request_sha256`, `ticket`, `protocol_json`, `protocol_path`, `error_code`, `error_text`. Eine Übermittlung ist unveränderlich; ein neuer Versuch ist eine neue Zeile.

### Dateien

`data/elster/<companyId>/<year>/<filingId>/request.xml`, `response.json`, `protocol.pdf`. Pfadbildung läuft über eine geprüfte Funktion wie `src/server/files.ts`, damit kein gespeicherter Name das Verzeichnis verlässt.

## 6. Domain-Regeln

### 6.1 `src/domain/tax-filing.ts`

Pure Funktionen, keine Datenbank:

- `taxFilingKindsFor(company, year)` — welche Erklärungen anfallen (Kleinunternehmer, Lohn, EU-Umsätze, Wirtschaftsjahr).
- `filingPeriods(kind, year, company)` — Monats-/Quartals-/Jahreszeiträume.
- `filingDueDate(kind, period, settings)` — baut auf `statutoryObligations` auf; keine zweite Fristenlogik.
- `filingTransitions` und `canTransition(from, to)` — Statusmaschine.
- `runFilingChecks(filing, context)` — Liste `{ code, severity: "block" | "warn" | "info", message, field? }`.
- `assertTransmittable(filing)` — wirft bei fehlender Freigabe, fehlendem Snapshot, veralteter Prüfung oder gesperrter Umgebung.

### 6.2 Statusmaschine

```
draft ──berechnen──► calculated ──prüfen──► checked ──freigeben──► ready
  ▲                     │                    │                      │
  └────korrigieren──────┴────────────────────┘                      ├──► transmitting ──► accepted
                                                                    │                     └──► rejected
                                                                    ├──► submitted_manually
                                                                    └──► failed
accepted/submitted_manually ──berichtigen──► neuer draft (replaces_id)
```

Regeln:

- `accepted` nur mit Server-Ticket und Zeitstempel. `submitted_manually` nur mit hochgeladenem Nachweis und bestätigter Abgabe.
- Jede Änderung an Stammdaten, Journal oder Freigabe nach `checked` setzt den Status auf `calculated` zurück und verlangt eine neue Prüfung.
- Eine Echtübermittlung ist nur aus `ready` möglich, nie aus `draft` oder per Direkt-URL.
- Eine Korrektur erzeugt eine neue Erklärung, die auf die alte verweist. Die alte bleibt unverändert.

### 6.3 Prüfungen (erste Ausbaustufe)

| Code | Schwere | Inhalt |
| --- | --- | --- |
| `master-data` | block | Steuernummer, Adresse, Rechtsform, Wirtschaftsjahr, ggf. USt-IdNr. |
| `period-closed` | warn | Offene Entwürfe oder Buchungen im Zeitraum |
| `vat-ledger` | block | UStVA-Summen weichen vom Journal ab |
| `vat-invoices` | warn | Rechnungen ohne Journalbezug oder mit unklarem Steuersatz |
| `kleinunternehmer` | block/warn | UStVA bei aktiver § 19-Regelung; Widerspruch zum Profil |
| `profit-base` | block | KSt/GewSt-Basis weicht vom Jahresergebnis ab |
| `loss-carryforward` | warn | Verlustvortrag fehlt oder ist älter als das Vorjahr |
| `wage-tax` | warn | Gebuchte Lohnsteuer weicht von der Anmeldung ab |
| `duplicate` | block | Für den Zeitraum existiert bereits eine aktive Erklärung |
| `deadline` | warn | Frist überschritten oder innerhalb von 7 Tagen |
| `attachments` | warn | Erforderliche Belege/Unterlagen fehlen |
| `elster-config` | block | Umgebung, Zertifikat, Hersteller-ID oder Datenschutzbestätigung fehlt |
| `schema-version` | block | Formatversion passt nicht zum Steuerjahr |

Blockierende Fehler verhindern die Freigabe. Warnungen verlangen eine bewusste Bestätigung mit Notiz.

### 6.4 `src/domain/elster-format.ts`

- Eine versionierte Zuordnung „Steuerart + Jahr → amtlicher Datensatz und Kennzahlen“.
- `buildUstvaXml`, `buildUstAnnualXml`, `buildKstXml`, `buildGewstXml` als reine Funktionen mit einem kanonischen Eingabetyp.
- Keine Kennzahl wird in einer React-Komponente oder in einem Server-Action-Handler wiederholt.
- Jede Formatversion bekommt eine eigene Datei oder einen eigenen Namensraum (`formats/ustva-2026.ts`), damit ein Jahreswechsel altes Verhalten nicht still verändert.
- XML wird escaped, deterministisch sortiert und mit stabiler Kodierung erzeugt. Der Hash wird über genau die Bytes gebildet, die gesendet werden.
- Ein XSD-Abgleich läuft im Test gegen mitgelieferte, lizenzierte Schemata; ERiC prüft zusätzlich zur Laufzeit.

Wichtig: Feldnummern und Schemata ändern sich jährlich. Der Plan legt die Struktur fest, nicht aus dem Gedächtnis geratene Kennzahlen. Die konkrete Zuordnung wird gegen die amtliche Jahresdokumentation erstellt und fachlich abgenommen.

## 7. Ablauf in der Oberfläche

1. **Anlegen**: `/tax` listet je Jahr die anfallenden Erklärungen. „Erklärung vorbereiten“ legt einen Entwurf an oder öffnet den vorhandenen.
2. **Zahlen übernehmen**: Der Desk liest Journal, Rechnungen und Stammdaten für den Zeitraum und zeigt eine Tabelle „Wert · Herkunft · Betrag“. Jede Zeile verlinkt auf die Quelle.
3. **Prüfen**: Prüfliste mit blockierenden Fehlern, Warnungen und Hinweisen. Warnungen werden einzeln bestätigt.
4. **Freigeben**: Zusammenfassung mit Steuerart, Zeitraum, Kennzahlen, Frist und Datenhash. Die Freigabe ist ein eigener Schritt.
5. **Übermitteln**: Umgebung (Test/Produktion) ist sichtbar. Produktion verlangt eine zweite Bestätigung mit dem Wort „verbindlich“ und die PIN-Eingabe. Die PIN wird nur an den Sidecar gereicht und nicht gespeichert.
6. **Nachweis**: Ticket, Protokoll, PDF und XML-Snapshot werden gespeichert. Die zugehörige Pflicht in `/obligations` wird auf „erledigt“ gesetzt, mit Verweis auf die Erklärung.
7. **Berichtigen**: erzeugt eine neue Erklärung mit `replaces_id`; die Historie bleibt sichtbar.

## 8. ELSTER-Sidecar

Verzeichnis `docker/elster/`:

- kleiner HTTP-Dienst (Node oder Python) mit `POST /v1/validate`, `POST /v1/submit`, `GET /v1/health`.
- lädt ERiC aus `/opt/eric`, meldet Version und verfügbare Formate.
- akzeptiert nur `application/xml`, maximal 10 MB, mit gemeinsamem Token `ELSTER_SIDECAR_TOKEN`.
- bindet ausschließlich an `127.0.0.1` (lokal) bzw. ist im Compose-Netz nur für `desk` erreichbar; Port nicht öffentlich veröffentlichen.
- PIN und Zertifikatspfad kommen pro Anfrage, werden nur im Speicher gehalten und aus jedem Log entfernt.
- gibt normalisierte Fehler zurück (`code`, `message`, `details`) statt Rohdumps.
- Test- und Produktionsziel werden explizit gesetzt; ein Default auf Produktion ist verboten.

Konfiguration:

```env
ELSTER_SIDECAR_URL=http://127.0.0.1:8100
ELSTER_SIDECAR_TOKEN=...
ELSTER_HERSTELLER_ID=12345
ELSTER_ERIC_PATH=/opt/eric
MANAGR_ELSTER_KEY=...
```

Compose bekommt einen optionalen Dienst `elster`, der nur startet, wenn das Profil `elster` aktiv ist. Ohne Profil bleibt der Desk vollständig nutzbar.

## 9. Oberfläche

Neue Route `/tax` (Server Component + `Hydrate`) mit Tabs:

- **Erklärungen**: Jahr, Steuerart, Zeitraum, Status, Frist, Fälligkeit.
- **Prüfen**: offene blockierende Fehler und Warnungen über alle Erklärungen.
- **ELSTER**: Verbindung, Umgebung, Hersteller-ID, Zertifikat (Name, Ablauf, Fingerprint), letzte Prüfung, Datenschutzbestätigung.
- **Archiv**: übermittelte Erklärungen mit Ticket, Protokoll und XML-Download.

Detailseite `/tax/[id]`:

- Kopf mit Steuerart, Zeitraum, Status, Frist.
- Kennzahlen-Tabelle mit Herkunft und Differenz.
- Prüfungen, Warnungsbestätigung, Notiz.
- Freigabe- und Übermittlungsbereich, klar getrennt.
- Verlauf aus `tax_filing_events`, unveränderlich.
- Download `GET /tax/[id]/elster.xml` (nur berechtigte lokale Nutzung, `Content-Disposition: attachment`).

Wiederverwendung: `Card`, `Tabs`, `ActionForm`, `AddSheet`, `Pill`, `Disclaimer`, `InfoButton`. Keine neue UI-Bibliothek. Alles bei 375 px bedienbar, Touch-Ziele ≥ 44 px.

Der Info-Text und der Disclaimer sagen: „Der Desk bereitet vor und prüft technisch. Die steuerliche Würdigung und die Freigabe liegen bei der verantwortlichen Person.“ In der Testumgebung: „Testübermittlung — nicht an das Finanzamt abgegeben.“

## 10. Server, Views und Werkzeuge

### Views

- `taxView(year)` — Liste, Prüfungszusammenfassung, ELSTER-Status.
- `taxFilingView(id)` — Detail inkl. Quellen, Prüfungen, Ereignisse, Übermittlungen.
- `elsterSettingsView()` — nur Metadaten, niemals Zertifikat oder PIN.

Registrierung in `src/server/view-request.ts` (`VIEW_NAMES`, `viewIsReady`), `src/server/views.ts` (`loadView`), `src/client/query-keys.ts` und `queryKeys`/`viewPath`.

### Server Actions

`src/server/actions.ts`:

- `createTaxFiling`, `calculateTaxFiling`, `saveTaxFilingNote`
- `runTaxFilingChecks`, `acknowledgeTaxWarning`, `markTaxFilingReady`, `reopenTaxFiling`
- `saveElsterSettings`, `importElsterCertificate`, `acknowledgeElsterPrivacy`, `checkElsterConnection`
- `transmitTaxFiling` (nur aus `ready`, Umgebungsprüfung, Bestätigungswort, PIN)
- `recordManualSubmission`, `attachManualProtocol`
- `createCorrection`

Alle schreiben über `getDb()`, danach `revalidatePath` und Cache-Invalidierung. Übermittlungen sind keine Journalbuchungen; gebuchte Steuern bleiben im Journal. Die Pflichten-Statuszeile wird nur über die bestehende `obligationStates`-Logik aktualisiert.

### MCP und Assistent

Neue Read-Tools: `read_tax_filings`, `read_tax_filing`, `read_elster_status`.
Neue Write-Tools ohne Außenwirkung: `prepare_tax_filing`, `run_tax_checks`, `save_tax_note`.
**Keine** Übermittlung über Assistent oder MCP in Phase 1–4. Senden ist irreversibel, verbraucht eine Frist und braucht PIN und menschliche Freigabe. Ein späteres Tool wäre nur mit eigenem Freigabe-Gate und separater Entscheidung zulässig. Das Zertifikat und die PIN sind für Tools nie lesbar.

## 11. Sicherheit und Aufbewahrung

- Zertifikat verschlüsselt at rest; Schlüsseldatei nicht im Repository, nicht im Image, nicht in Logs.
- PIN nur im Request-Speicher, nie persistiert, nie geloggt, nie in Fehlermeldungen.
- Views und Tools liefern nur `certificateName`, `validUntil`, `fingerprint`, `environment`.
- Sidecar-Token als Header, Vergleich in konstanter Zeit, nur localhost.
- Produktionsübermittlung an drei Bedingungen geknüpft: `environment=production`, frisch geprüfter Snapshot, ausdrückliche Bestätigung.
- Demo-Datenbank (`isSample`) darf nie produktiv senden; die Action verweigert es serverseitig.
- Aufbewahrung: XML, Antwort, PDF und Ereignisse bleiben mindestens bis zum Ablauf der steuerlichen Aufbewahrungsfrist; Löschen ist für übermittelte Erklärungen nicht vorgesehen. Entwürfe sind soft-deletable.
- Backup: `data/elster` gehört in dieselbe Sicherung wie `data/managr.db`; der Schlüssel muss separat gesichert werden, sonst ist das Zertifikat nach einem Restore unbrauchbar.

## 12. Tests

Domain (`tests/tax-filing.test.ts`, `tests/elster-format.test.ts`):

- Zeiträume, Fristen, Wirtschaftsjahr, Schaltjahr, Dauerfristverlängerung.
- Statusmaschine inkl. aller verbotenen Übergänge.
- Prüfungen: jede Regel mit einem Treffer und einem Nicht-Treffer.
- XML: Snapshot je Formatversion, Escaping, deterministische Reihenfolge, Hash-Stabilität.
- Korrektur verweist auf Original und verändert es nicht.

Server (`tests/tax-filings.test.ts`, `tests/elster.test.ts`):

- Anlegen, Berechnen, Prüfen, Freigeben, Wiederöffnen auf temporärer DB.
- Gesellschafts-Isolation und Soft Delete.
- Produktion ohne Zertifikat/Hersteller-ID/Datenschutzbestätigung wird verweigert.
- Testübermittlung erzeugt nie `accepted` mit Produktionsticket.
- Fehler des Sidecars werden als `failed` gespeichert, ohne PIN im Fehlertext.
- Zertifikat taucht in keiner View und keinem Tool-Ergebnis auf.
- Pfadprüfung für XML/PDF.
- Migrationstest: `0019` läuft auf einer bestehenden Datenbank.

Integration (opt-in, nicht in `bun run test`):

- ERiC-Validate gegen die lokale Installation.
- Testübermittlung mit eigener Hersteller-ID und Testzertifikat.

## 13. Phasen und Aufwand

Aufwand sind Arbeitstage ohne Wartezeiten bei ELSTER.

### Phase 0 — Voraussetzungen (2–3 Tage + externe Wartezeit)

- Hersteller-Registrierung, Hersteller-ID, ERiC-Paket, Lizenz akzeptieren.
- ELSTER-Benutzerkonto mit Zertifikatsdatei und PIN für die Gesellschaft.
- Steuerliche Abnahme des Umfangs und der Kennzahlen durch Berater/in.
- Entscheidung: eigener Sidecar vs. externer ELSTER-Dienstleister.
- Datenschutztext und Bestätigung formulieren.

**Abbruchkriterium:** Ohne Hersteller-ID und Zertifikat wird Phase 3 nicht begonnen. Phase 1 und 2 laufen trotzdem.

### Phase 1 — Datenmodell, Domain, Vorbereitung (5–7 Tage)

- Migration, Schema, Domain, Prüfungen, Statusmaschine.
- `/tax`, Detailseite, Views, Actions ohne Übermittlung.
- XML-Export und PDF-Bericht für den manuellen Weg.
- Tests und Doku.

**Ergebnis:** Erklärung vorbereiten, prüfen, freigeben, exportieren, manuell abgeben und Nachweis erfassen.

### Phase 2 — Manueller Abgabeweg (3–4 Tage)

- Nachweis-Upload, Ticket-Feld, Pflichten-Verknüpfung, Archiv.
- UStVA-XML für den Import in Mein ELSTER; KSt/GewSt als prüfbare Datenfassung für die manuelle Erfassung oder den Berater.
- Klare Kennzeichnung „manuell abgegeben“.

**Ergebnis:** Vollständiger Arbeitsablauf ohne ELSTER-Zugang, ohne Simulationslüge.

### Phase 3 — ERiC-Sidecar, Testumgebung (8–12 Tage)

- Sidecar mit ERiC, Health, Validate, Test-Submit.
- Verschlüsselte Zertifikatsablage, PIN-Handling, Verbindungstest.
- End-to-End UStVA im Testsystem, danach USt-Jahres, KSt, GewSt.
- Fehlercode-Mapping und Protokollspeicherung.

**Ergebnis:** Echte Testübermittlung mit Testmerker, sichtbar als Test.

### Phase 4 — Produktion und Härtung (4–6 Tage)

- Produktionsfreigabe, Doppelbestätigung, Demo-Sperre.
- Ablaufwarnung für das Zertifikat, ERiC-Update-Check.
- Lohnsteuer-Anmeldung und ZM nur bei Bedarf.
- Betriebsrunbook, Backup-/Restore-Test, Abschlussprüfung durch Berater/in.

**Ergebnis:** Echtübermittlung für die freigegebenen Steuerarten.

### Phase 5 — optional

- ELSTER-Postfach und Bescheidabruf, nur mit eigenem Zustimmungs- und Datenschutzkonzept.
- Automatische Fristverlängerung, again only with a documented legal basis.

Gesamt bis Produktion: ca. 22–32 Arbeitstage plus ELSTER-Wartezeit.

## 14. Konkrete Dateiänderungen

Neu:

- `src/db/migrations/0019_tax_filings.sql`
- `src/domain/tax-filing.ts`
- `src/domain/elster-format.ts` (+ `src/domain/elster-formats/`)
- `src/server/tax-filings.ts`
- `src/server/elster/transport.ts`
- `src/server/elster/manual.ts`
- `src/server/elster/eric.ts`
- `src/server/elster/certificate.ts`
- `src/app/(app)/tax/page.tsx`
- `src/app/(app)/tax/[id]/page.tsx`
- `src/app/(app)/tax/[id]/elster.xml/route.ts`
- `src/components/screens/tax-screen.tsx`
- `src/components/screens/tax-filing-screen.tsx`
- `docker/elster/` (Dockerfile, Dienst, README)
- `tests/tax-filing.test.ts`
- `tests/elster-format.test.ts`
- `tests/tax-filings.test.ts`
- `tests/elster.test.ts`

Geändert:

- `src/db/schema.ts`
- `src/server/view-request.ts`
- `src/server/views.ts`
- `src/server/actions.ts`
- `src/server/queries.ts`
- `src/server/tools.ts`
- `src/client/query-keys.ts`
- `src/components/nav-items.ts`
- `src/components/app-nav.tsx` (Icon)
- `src/i18n/messages.ts` und Übersetzungskatalog
- `src/domain/obligations.ts` (Verknüpfung, keine zweite Fristenlogik)
- `docker-compose.yml` (optionales Profil `elster`)
- `.env.example` bzw. README-Konfigurationsabschnitt
- `docs/ARCHITECTURE.md`, `docs/DOMAIN.md`, `docs/ROADMAP.md`, `README.md`
- `docs/MCP-ASSISTANT.md` („Nothing is sent“ präzisieren)
- `.grok/skills/managr-engineering/SKILL.md` (die Regel „kein ELSTER“ auf den neuen beschlossenen Umfang ändern)

## 15. Doku und Governance

Der Plan ändert eine ausdrückliche Produktentscheidung: Bisher sagen README, Roadmap, MCP-Doku und die Engineering-Regel, dass ELSTER nicht enthalten ist. Deshalb gehört zur ersten Umsetzung:

1. `docs/ROADMAP.md`: ELSTER aus „Not in version 1“ in einen neuen Versionsabschnitt verschieben, mit dem hier beschriebenen Umfang.
2. `docs/DOMAIN.md`: Steuerarten, Fristen, Statusmaschine, Prüfungen und die Grenze „technische Prüfung, keine steuerliche Würdigung“.
3. `docs/ARCHITECTURE.md`: Sidecar, Zertifikatsablage, Datenfluss, Aufbewahrung.
4. `README.md`: Einrichtung von Hersteller-ID, Zertifikat und Sidecar; was ohne Konfiguration gilt.
5. `docs/MCP-ASSISTANT.md`: Assistent und MCP bereiten vor und lesen, sie senden nicht.
6. `.grok/skills/managr-engineering/SKILL.md`: Regel ersetzen, sonst widerspricht die nächste Änderung der Projektregel.

## 16. Risiken und offene Entscheidungen

| Risiko | Wirkung | Gegenmaßnahme |
| --- | --- | --- |
| Hersteller-ID/Freigabe dauert | Phase 3 blockiert | Phase 1/2 liefern sofort Nutzen; Wartezeit früh starten |
| ERiC-Version und Schemata ändern sich jährlich | Übermittlung schlägt fehl | versionierte Formate, ERiC-Update-Check, Testübermittlung vor Produktion |
| Falsche Kennzahl | Falsche Erklärung | zentrale Mapping-Tabelle, XSD-/ERiC-Prüfung, fachliche Abnahme, Quellenanzeige |
| Zertifikat/PIN kompromittiert | Missbrauch | Verschlüsselung, keine Logs, localhost, getrennte Schlüsselablage |
| Scheinbare Sicherheit durch „grüne“ Prüfung | Haftungsrisiko | Disclaimer, blockierende vs. warnende Prüfungen, menschliche Freigabe |
| Produktionsabgabe aus Demo | Falsche Abgabe | serverseitige `isSample`-Sperre, zweite Bestätigung |
| Sidecar wird öffentlich erreichbar | Zertifikatsmissbrauch | Bindung an localhost, Token, kein öffentlicher Port |
| Steuerberater/in arbeitet mit anderem Format | Doppelarbeit | manueller Export und klarer Nachweis-Weg ab Phase 2 |

Offene Entscheidungen vor Phase 1:

1. **Eigener Sidecar oder Dienstleister?** Entschieden: eigener ERiC-Sidecar in Phase 3. Das bedeutet mehr Kontrolle und mehr eigener Betrieb; ERiC, Zertifikat und PIN bleiben lokal.
2. **Welche Steuerarten zuerst?** Empfehlung: UStVA, dann USt-Jahres, dann KSt/GewSt. UStVA hat den klarsten Bezug zum Journal.
3. **Wird die E-Bilanz wirklich gebraucht?** Sie ist eine eigene Übermittlung mit Taxonomie und muss separat abgenommen werden.
4. **Wer darf freigeben?** Der Desk hat keine Rollen. Bis es sie gibt, ist die lokale Bedienperson die freigebende Person; das muss im Text stehen.
5. **Aufbewahrungsdauer und Backup-Ort** für XML, Protokolle und Zertifikatsschlüssel festlegen.

## 17. Definition of Done

Eine Steuerart gilt erst als fertig, wenn:

- Zahlen nachvollziehbar aus dem Journal stammen und jede Zeile ihre Quelle nennt,
- alle blockierenden Prüfungen getestet sind und die Freigabe verhindern,
- eine Testübermittlung mit Testmerker nachweisbar ist und nie als Produktion erscheint,
- eine Produktionsübermittlung nur mit gültiger Konfiguration und Bestätigung möglich ist,
- Ticket, Protokoll, PDF und XML-Hash gespeichert und im Archiv abrufbar sind,
- die zugehörige Pflicht in `/obligations` korrekt aktualisiert wird,
- Zertifikat und PIN in keiner View, keinem Tool und keinem Log auftauchen,
- `bun run test`, `bun run typecheck` und `bun run build` grün sind,
- die genannten Dokumente denselben Stand beschreiben.