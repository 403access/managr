---
slug: /mcp
---

# Assistent und MCP

managr bekommt eine Werkzeugschicht, die den Schreibtisch steuert, erreichbar von zwei Seiten:

- **In der App:** ein Chat-Widget, das einen Satz in dieselben Aufrufe übersetzt, die auch die Bildschirme machen.
- **Von außen:** ein MCP-Server unter `/api/mcp`, damit ein anderer Agent (Claude Desktop, eine IDE, ein Skript) den Schreibtisch lesen und buchen kann.

Beide Oberflächen verwenden dieselbe Registrierung in `src/server/tools.ts`. Es gibt keine zweite Sammlung von Geschäftsregeln: Jedes Werkzeug ruft die Domänenfunktionen in `src/domain` und den Buchungspfad in `src/server/posting.ts`. Bildschirme und Assistent erzeugen deshalb dieselben Zahlen.

## Grenzen

- Der Assistent ist ein Aufrufer, keine Instanz. Er darf nichts einreichen, versenden oder steuerlich und rechtlich entscheiden und keine Lohnsteuer oder einen Sozialversicherungsstatus erfinden.
- Die Bücher bleiben fortgeschrieben, nicht änderbar. Korrekturen sind Stornobuchungen, genau wie auf den Bildschirmen.
- Es wird nichts versendet. Keine E-Rechnung, keine E-Mail, kein ELSTER, kein Peppol.
- Datei-Uploads bleiben am Bildschirm. Ein Werkzeug darf Dokumente auflisten, aber keine Dateien schreiben oder löschen.
- Der Assistent erreicht ein Modell nur unter der eingestellten Adresse. Mit einem lokalen Modell (Ollama oder ein lokaler OpenAI-kompatibler Server) bleiben die Daten auf diesem Computer; mit einem Cloud-Modell verlassen Gespräch und Werkzeugergebnisse ihn. Das Widget zeigt, welche Adresse gilt.

## Einrichtung

| Variable | Bedeutung |
| --- | --- |
| `MANAGR_AI_MODEL` | Der Modellname. Ohne ihn antworten Widget und Route nicht. |
| `MANAGR_AI_BASE_URL` | Eine OpenAI-kompatible Basisadresse. Standard ist `http://127.0.0.1:11434/v1` (Ollama). |
| `MANAGR_AI_API_KEY` | Wird als Bearer-Token gesendet, wenn gesetzt. Für einen lokalen Endpunkt nicht nötig. |

Eine Loopback-Adresse gilt als lokal. Jeder andere Host gilt als extern, und das Panel sagt das. Das Widget liest die Einstellung über `GET /api/assistant`; der Schlüssel wird nie zurückgegeben. Über die Datenverarbeitung des Modells sagt der Schreibtisch nichts.

## Phasen

### Phase 1 — Werkzeugregistrierung und MCP-Server

Eine Registrierung mit Name, Beschreibung, Zod-Eingabeschema und Ausführungsfunktion je Werkzeug. Ein Ergebnis ist `{ ok, data }` oder `{ ok: false, error }`.

Lese-Werkzeuge geben die vorhandenen Ansichten aus, damit der Assistent dasselbe JSON sieht wie ein Bildschirm:

- `read_companies`, `read_desk`, `read_company`
- `read_customers`
- `read_invoices`, `read_invoice`
- `read_ledger`
- `read_people`, `read_person`
- `read_time`, `read_tasks`
- `read_obligations`, `read_documents`, `read_legal`

Schreib-Werkzeuge folgen den Server-Actions:

- **Gesellschaft:** `switch_company`, `create_company`, `update_company_identity`, `update_tax_profile`, `update_bank`
- **Gesellschafter, Rücklage, Versicherungen:** `add_shareholder`, `delete_shareholder`, `record_reserve_allocation`, `offset_reserve`, `add_policy`, `delete_policy`, `pay_profit_distribution`
- **Rechnungen:** `save_customer`, `create_invoice`, `issue_invoice`, `update_buyer_reference`, `record_invoice_payment`, `void_invoice`, `delete_invoice_draft`
- **Bücher:** `post_expense`, `post_vat_prepayment`, `post_journal_entry`
- **Personen:** `create_person`, `update_person`, `add_salary_change`, `add_absence`, `delete_absence`, `post_payroll`, `pay_shareholder`
- **Zeit, Aufgaben, Fristen:** `add_time`, `delete_time`, `add_task`, `set_task_status`, `delete_task`, `set_obligation`, `add_deadline`, `complete_deadline`, `delete_deadline`
- **Recht:** `set_compliance_done`, `save_resolution`

Der MCP-Endpunkt nutzt den Streamable-HTTP-Transport des SDK im zustandslosen Modus mit JSON-Antworten. Er spricht den üblichen Ablauf `initialize`, `tools/list` und `tools/call`. Er ist nur erreichbar, solange der Schreibtisch läuft, und nur auf dem Rechner, auf dem er läuft.

### Phase 2 — das Widget

Ein schwebender Knopf in der App-Hülle öffnet ein Panel. Der Browser schickt das Gespräch an `POST /api/assistant`; die Route führt eine Werkzeugschleife gegen einen OpenAI-kompatiblen Chat-Endpunkt aus und liefert die Antwort samt Liste der aufgerufenen Werkzeuge.

- Das Modell wird über `MANAGR_AI_BASE_URL`, `MANAGR_AI_MODEL` und `MANAGR_AI_API_KEY` eingestellt. Ohne Modell erklärt das Panel die Einrichtung, statt eine Antwort vorzutäuschen.
- Das Panel zeigt jeden Werkzeugaufruf mit Name und Ergebnis, damit eine Zahl in der Antwort auf ein Lesen zurückführbar ist.
- Nach einem Schreibvorgang lädt der offene Bildschirm seine Ansicht neu.
- Schnellaktionen starten eine übliche Anfrage: ein Briefing, die offenen Rechnungen, die nächsten Fristen.
- Funktioniert bei 375 px Breite und in der Desktop-Seitenleiste.

### Phase 3 — mehr als die Bildschirme

Zwei deterministische Helfer, die kein Modell brauchen, nutzbar im Widget und über MCP:

- `daily_briefing`: Bank, Forderungen, Gewinn vor Steuern, Umsatzsteuer-Zahllast, überfällige Rechnungen, Fristen der nächsten 14 Tage, offene Aufgaben.
- `draft_dunning_letter`: eine deutsche Zahlungserinnerung für eine überfällige Rechnung. Der Text ist ein Entwurf; der Schreibtisch versendet ihn nicht.

Der Assistent kann bereits aus freiem Text einen Rechnungsentwurf bauen, indem er `create_invoice` aufruft, und eine Zahlung mit `record_invoice_payment` buchen. Die Prüfungen nach §14 UStG bleiben beim Stellen.

### Phase 4 — Dokumentation und Website

- `docs/MCP-ASSISTANT.md` (diese Seite), `docs/ARCHITECTURE.md` und `docs/DOMAIN.md` nennen die Werkzeuge, die Grenze und die Einrichtung.
- Die README zeigt, wie der Schreibtisch startet und wie ein Client auf `/api/mcp` zeigt.
- Die Marketingseite nennt den Assistenten und sagt klar, dass ein Cloud-Modell das Gespräch erhält.

## Nicht in dieser Version

- Fernzugriff, Konten und Rollen für den MCP-Endpunkt.
- Schreiben in die Bücher ohne die Prüfungen der Domäne.
- E-Rechnung, E-Mail oder Erklärung versenden.
- Dokumentdateien über ein Werkzeug hochladen oder löschen.
- Den Assistenten die eigene Rechnungsstellung genehmigen oder einen Sozialversicherungsstatus entscheiden lassen.

## Fertig

Eine Phase ist fertig, wenn die Tests der Registrierung bestehen, `bun run test` und `bun run typecheck` bestehen, die geänderten Bildschirme in Telefon- und Desktopbreite funktionieren und diese Seite, die Architekturnotiz und die README das ausgelieferte Verhalten beschreiben.