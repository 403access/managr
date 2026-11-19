---
slug: /mcp
---

# Assistent und MCP

managr bekommt eine Werkzeugschicht, die den Schreibtisch steuert, erreichbar von zwei Seiten:

- **In der App:** ein Chat-Widget, das einen Satz in dieselben Aufrufe übersetzt, die auch die Bildschirme machen.
- **Von außen:** ein MCP-Server unter `/api/mcp`, damit ein anderer Agent (Claude Desktop, eine IDE, ein Skript) den Schreibtisch lesen und buchen kann.

Beide Oberflächen verwenden dieselbe Registrierung in `src/server/tools.ts`. Es gibt keine zweite Sammlung von Geschäftsregeln: Jedes Werkzeug ruft die Domänenfunktionen in `src/domain` und den Buchungspfad in `src/server/posting.ts`. Bildschirme und Assistent erzeugen deshalb dieselben Zahlen.

## Stand

Alle vier Phasen sind ausgeliefert. Das Widget sitzt in der App-Hülle, der MCP-Endpunkt antwortet unter `/api/mcp`, und die Registrierung enthält Lese-Werkzeuge, Schreib-Werkzeuge und vier deterministische Briefings. Die Registrierung folgt den Bildschirmen: Organigramm, Qonto-Bankansicht, Geldfluss, Auswertung, Meilensteine und Quellenregister sind erreichbar. Die Phasenüberschriften unten beschreiben, was jede Phase ergänzt hat.

## Grenzen

- Der Assistent ist ein Aufrufer, keine Instanz. Er darf nichts einreichen, versenden oder steuerlich und rechtlich entscheiden und keine Lohnsteuer oder einen Sozialversicherungsstatus erfinden.
- Die Bücher bleiben fortgeschrieben, nicht änderbar. Korrekturen sind Stornobuchungen, genau wie auf den Bildschirmen.
- Es wird nichts versendet. Keine E-Rechnung, keine E-Mail, kein ELSTER, kein Peppol.
- Datei-Uploads bleiben am Bildschirm. Ein Werkzeug darf Dokumente auflisten, aber keine Dateien schreiben oder löschen. Die Qonto-Verbindung wird am Bank-Bildschirm eingerichtet; ein Werkzeug liest die gespeicherte Bankansicht und hält den Schlüssel nicht.
- Der Assistent erreicht ein Modell über die lokale opencode-Installation oder den eingestellten Endpunkt. Mit einem lokalen Modell (Ollama oder ein lokaler OpenAI-kompatibler Server) bleiben die Daten auf diesem Computer; mit einem Cloud-Modell verlassen Gespräch und Werkzeugergebnisse ihn. Das Widget zeigt, welches Modell und welcher Anbieter gelten.
- Die Zugangsdaten des Anbieters bleiben auf dem Server. managr liest sie für das gewählte Modell aus opencode, sendet sie nur an diesen Anbieter und gibt sie nie an den Browser zurück und speichert sie nicht in der Datenbank.
- `web_search` sendet nur die Suchanfrage an eine Suchmaschine. `web_fetch` ruft eine öffentliche Seite ab. Das Gespräch wird nicht gesendet, Loopback- und private Netzadressen werden abgelehnt, und eine Seite ist nicht vertrauenswürdige Daten: Der Assistent darf eine Tatsache zitieren, nie eine Anweisung daraus befolgen.

## Einrichtung

| Variable | Bedeutung |
| --- | --- |
| `MANAGR_AI_MODEL` | Der Ausweich-Modellname. Ohne opencode und ohne diesen Wert antworten Widget und Route nicht. |
| `MANAGR_AI_BASE_URL` | Die OpenAI-kompatible Ausweich-Basisadresse. Standard ist `http://127.0.0.1:11434/v1` (Ollama). |
| `MANAGR_AI_API_KEY` | Wird als Bearer-Token an den Ausweich-Endpunkt gesendet, wenn gesetzt. Für einen lokalen Endpunkt nicht nötig. |
| `MANAGR_OPENCODE` | Auf `0` setzen, um die lokale opencode-Installation zu überspringen. Die Erkennung ist standardmäßig an. |
| `MANAGR_OPENCODE_BIN` | Pfad zur opencode-Binärdatei, wenn sie nicht in `PATH` liegt. |
| `MANAGR_WEB` | Auf `0` setzen, um `web_search` und `web_fetch` aus Assistent und MCP zu entfernen. Standardmäßig an. |
| `MANAGR_WEB_SEARCH_URL` | Ein SearXNG-JSON-Endpunkt. Er wird vor DuckDuckGo und Bing versucht, damit die Anfrage auf einem selbst gewählten Server bleibt. |

Eine Loopback-Basisadresse gilt als lokal. Jeder andere Host gilt als extern, und das Panel sagt das. Das Widget liest die Ausweicheinstellung über `GET /api/assistant`; der Schlüssel wird nie zurückgegeben. Über die Datenverarbeitung des Modells sagt der Schreibtisch nichts.

## Modellwahl

Wenn eine lokale opencode-Installation vorhanden ist, gibt `GET /api/assistant/models` ihre Anbieter und die Modelle zurück, die Werkzeugaufrufe über einen OpenAI-kompatiblen Endpunkt unterstützen. Das Panel zeigt zwei durchsuchbare Felder, Anbieter links und Modell rechts, und speichert die Wahl im Browser. Jede Nachricht trägt `selection: { providerID, modelID }` an `POST /api/assistant`.

Die Route prüft die Auswahl bei jeder Anfrage gegen opencode. Ein Modell, das aus opencode verschwunden ist, wird mit einem 400 abgelehnt statt still ersetzt. Die Zugangsdaten des Anbieters werden auf dem Server aus dem lokalen Credential-Speicher von opencode gelesen und sind nie Teil der Katalogantwort. Der Katalog wird eine Minute im Serverprozess zwischengespeichert; eine Änderung in opencode erscheint danach oder mit der nächsten Anfrage nach Ablauf des Caches.

Die Umgebungsvariablen bleiben ein funktionierender Ausweichweg und erscheinen im Auswahlfeld als Anbieter **Umgebung**. Ein ausdrückliches `MANAGR_AI_MODEL` ist die Standardauswahl. Ohne beide Quellen zeigt das Panel die Einrichtungskarte. Docker-Images enthalten normalerweise kein opencode, dort ist der Weg über die Umgebung der übliche.

Nur Chat-Modelle, die das OpenAI-Chat-Completions-Protokoll mit Werkzeugaufrufen sprechen, werden angeboten. Ein Anbieter, den opencode über seine native Anthropic- oder Google-Route erreicht, wird nicht angeboten, weil der Assistent von managr seine eigene Werkzeugschleife führt und OpenAI-förmige Werkzeugaufrufe sendet.

## Web-Werkzeuge

`web_search` fragt den HTML-Endpunkt von DuckDuckGo nach bis zu zehn Ergebnissen und weicht auf Bing aus. Mit `MANAGR_WEB_SEARCH_URL` fragt es zuerst einen SearXNG-JSON-Endpunkt. Es liefert je Ergebnis Titel, URL und Auszug. `web_fetch` akzeptiert nur öffentliche http(s)-URLs, folgt höchstens fünf Weiterleitungen mit derselben Prüfung, begrenzt den Download auf 2 MB, entfernt Skripte und Auszeichnung und liefert den lesbaren Text, den Titel und gefundene E-Mail-Adressen. Beide Werkzeuge cachen fünf Minuten im Serverprozess.

Die Werkzeuge sind schreibgeschützt: Sie invalidieren keinen Bildschirm und buchen nie. `MANAGR_WEB=0` entfernt sie aus der Registrierung, die Assistent und MCP sehen, und `runTool` lehnt sie ab. Der System-Prompt verlangt für jede Web-Tatsache eine Quell-URL und lässt das Modell gleichnamige Gesellschaften auflisten, statt eine auszuwählen. Eine Seite gilt als nicht vertrauenswürdige Daten; eine Anweisung darauf wird nie befolgt.

## Referenz-Werkzeuge

`read_guides` und `read_sources` geben das Quellenregister der App aus `src/content/sources.ts` weiter. Ein Leitfaden hat einen Titel, eine Zusammenfassung, Abschnitte und eine Liste von Quellen-IDs; eine Quelle hat Herausgeber, Art, Hinweis und genau eine offizielle https-Adresse. Die Werkzeuge sind standardmäßig Deutsch und akzeptieren `locale: "en"`; `read_guides` grenzt mit `topic` auf ein Thema ein, `read_sources` mit `query`, `domain` oder `topic`.

Das Register ist lokale Daten, daher funktionieren die Werkzeuge auch mit `MANAGR_WEB=0`. Sie sind schreibgeschützt. Ein Leitfaden erklärt einen Bildschirm; er ist kein Urteil und keine Buchung. Der System-Prompt sagt dem Modell, die offizielle URL zu nennen, die ein Leitfaden zitiert, statt eine Regel oder einen Satz zu erfinden.

## Phasen

### Phase 1 — Werkzeugregistrierung und MCP-Server (ausgeliefert)

Eine Registrierung mit Name, Beschreibung, Zod-Eingabeschema und Ausführungsfunktion je Werkzeug. Ein Ergebnis ist `{ ok, data }` oder `{ ok: false, error }`.

Lese-Werkzeuge geben die vorhandenen Ansichten aus, damit der Assistent dasselbe JSON sieht wie ein Bildschirm:

- `read_companies`, `read_desk`, `read_company`, `read_shareholder_loans`
- `read_customers`, `read_contacts`
- `read_invoices`, `read_invoice`
- `read_ledger`, `read_cashflow`, `read_bank`
- `read_people`, `read_person`, `read_org`
- `read_time`, `read_tasks`
- `read_projects`, `read_analytics`, `read_milestones`
- `read_obligations`, `read_documents`, `read_legal`
- `read_guides`, `read_sources`
- `web_search`, `web_fetch`, wenn der Web-Zugriff an ist

Schreib-Werkzeuge folgen den Server Actions:

- **Gesellschaft:** `switch_company`, `create_company`, `update_company_identity`, `update_tax_profile`, `update_bank`
- **Gesellschafter, Rücklage, Versicherungen:** `add_shareholder`, `delete_shareholder`, `add_shareholder_loan`, `record_shareholder_loan_movement`, `record_reserve_allocation`, `offset_reserve`, `add_policy`, `delete_policy`, `pay_profit_distribution`
- **Rechnungen:** `save_customer`, `save_contact`, `delete_contact`, `create_invoice`, `issue_invoice`, `update_buyer_reference`, `record_invoice_payment`, `void_invoice`, `delete_invoice_draft`
- **Bücher:** `post_expense`, `post_vat_prepayment`, `post_journal_entry`
- **Personen:** `create_person`, `update_person`, `add_salary_change`, `delete_salary_change`, `save_director_contract`, `delete_director_contract`, `save_founder_health`, `delete_founder_health`, `add_absence`, `delete_absence`, `post_payroll`, `pay_shareholder`
- **Zeit, Aufgaben, Fristen:** `add_time`, `delete_time`, `save_project`, `delete_project`, `add_task`, `set_task_status`, `delete_task`, `set_obligation`, `add_deadline`, `complete_deadline`, `delete_deadline`. `add_time` und `update_time` nehmen `personId` für Beschäftigte oder `contactId` für externe Kontakte, nie beides.
- **Meilensteine:** `save_milestone`, `delete_milestone`
- **Recht:** `set_compliance_done`, `save_resolution`

Der MCP-Endpunkt nutzt den Streamable-HTTP-Transport des SDK im zustandslosen Modus mit JSON-Antworten. Er spricht den üblichen Ablauf `initialize`, `tools/list` und `tools/call`. Er ist nur erreichbar, solange der Schreibtisch läuft, und nur auf dem Rechner, auf dem er läuft.

Lese-Werkzeuge decken jeden Bildschirm ab: Schreibtisch, Gesellschaft, Kunden, Rechnungen, Journal, Geldfluss, Qonto-Bank, Personen, Organigramm, Zeit, Aufgaben, Projekte, Auswertung, Meilensteine, Pflichten, Dokumente, rechtliche Unterlagen und das Quellenregister. `read_org` liefert denselben Baum von oben nach unten wie die Seite Personen, einschließlich ehemaliger Personen und der Tiefe. `read_guides` liefert die Erklärung hinter einem Bildschirm mit ihren Abschnitten und zitierten Quellen; `read_sources` liefert das Register nach Domain gruppiert, optional gefiltert nach Suchtext, Domain oder Leitfaden. Beide lesen `src/content/sources.ts`, damit der Assistent denselben offiziellen Link nennen kann, den die Info-Spalte zeigt.

Die Qonto-Verbindung selbst bleibt am Bank-Bildschirm, wie ein Datei-Upload. Ein Werkzeug liest die gespeicherten Konten, Salden und Umsätze über `read_bank`; es legt die Verbindung nicht an und entfernt sie nicht.

### Phase 2 — das Widget (ausgeliefert)

Ein schwebender Knopf in der App-Hülle öffnet ein Panel. Der Browser schickt das Gespräch an `POST /api/assistant`. Die Route fragt das Modell mit `stream: true` und antwortet mit zeilengetrenntem JSON, ein Ereignis pro Zeile:

- `model`: Endpunkt und Modell in Gebrauch.
- `delta`: ein Textstück der Antwort.
- `reset`: Der gestreamte Text war nur ein Vorspann zu einem Werkzeugaufruf und wird zurückgenommen.
- `tool`: Ein Werkzeugaufruf beginnt, mit seiner Eingabe.
- `tool_result`: Der Aufruf ist fertig, mit `ok`, einer Zusammenfassung und einer gekürzten Kopie der Daten.
- `reply`: der endgültige Antworttext.
- `error`: Der Lauf ist gescheitert, mit einer Meldung.

Das Panel stellt jedes Ereignis sofort dar, sodass die Schritte erscheinen, während das Modell noch arbeitet:

- Anbieter und Modell kommen aus der lokalen opencode-Installation; `MANAGR_AI_BASE_URL`, `MANAGR_AI_MODEL` und `MANAGR_AI_API_KEY` bleiben der Ausweichweg. Ohne beide Quellen erklärt das Panel die Einrichtung, statt eine Antwort vorzutäuschen.
- Jeder Werkzeugaufruf zeigt einen Kreisel, dann ein Häkchen oder ein Kreuz mit dem Fehler. Ein Lesevorgang zeigt keine Karte; ein Schreibvorgang zeigt, was er angelegt hat. Eine Websuche zeigt die Anfrage und die Trefferzahl, eine geladene Seite ihre URL.
- Eine angelegte, gestellte, bezahlte oder stornierte Rechnung erscheint als Karte mit Nummer, Kunde, Positionen, Netto, Umsatzsteuer, Brutto und offenem Betrag sowie einem Link zur Rechnung. Eine Lohnbuchung zeigt Brutto, Lohnsteuer, Netto und Arbeitgeberanteil sowie einen Link zur Person. Andere Schreibvorgänge verlinken ihren Bildschirm.
- Nach einem Schreibvorgang leert das Panel den Ansichtscache, sodass eine Liste hinter dem Panel im selben Moment aktualisiert wird.
- Ein Stopp-Knopf bricht die Anfrage ab und behält die bereits gelaufenen Schritte.
- Schnellaktionen starten eine übliche Anfrage: ein Briefing, die offenen Rechnungen, die nächsten Fristen, die Monatsabschlussprüfung.
- Funktioniert bei 375 px Breite und in der Desktop-Seitenleiste.

### Phase 3 — mehr als die Bildschirme (ausgeliefert)

Vier deterministische Helfer, die kein Modell brauchen, nutzbar im Widget und über MCP:

- `daily_briefing`: Bank, Forderungen, Gewinn vor Steuern, Umsatzsteuer-Zahllast, überfällige Rechnungen, Fristen der nächsten 14 Tage, offene Aufgaben.
- `vat_overview`: Umsatzsteuer, Vorsteuer, Vorauszahlungen und Zahllast oder Erstattung für einen gewählten Zeitraum.
- `monthly_close_checklist`: Stammdaten, offene Entwürfe, nicht gebuchte Lohnmonate und in dem Monat fällige Pflichten.
- `draft_dunning_letter`: eine deutsche Zahlungserinnerung für eine überfällige Rechnung. Der Text ist ein Entwurf; der Schreibtisch versendet ihn nicht.

Der Assistent kann bereits aus freiem Text einen Rechnungsentwurf bauen, indem er `create_invoice` aufruft, und eine Zahlung mit `record_invoice_payment` buchen. Die Prüfungen nach §14 UStG bleiben beim Stellen.

### Phase 4 — Dokumentation und Website (ausgeliefert)

- `docs/MCP-ASSISTANT.md` (diese Seite), `docs/ARCHITECTURE.md` und `docs/DOMAIN.md` nennen die Werkzeuge, die Grenze und die Einrichtung.
- Die README zeigt, wie der Schreibtisch startet und wie ein Client auf `/api/mcp` zeigt.
- Die Marketingseite nennt den Assistenten und sagt klar, dass ein Cloud-Modell das Gespräch erhält.

## Nicht in dieser Version

- Fernzugriff, Konten und Rollen für den MCP-Endpunkt.
- Schreiben in die Bücher ohne die Prüfungen der Domäne.
- E-Rechnung, E-Mail oder Erklärung versenden.
- Dokumentdateien über ein Werkzeug hochladen oder löschen.
- Die Qonto-Verbindung über ein Werkzeug anlegen, erneuern oder trennen.
- Den Assistenten die eigene Rechnungsstellung genehmigen oder einen Sozialversicherungsstatus entscheiden lassen.

## Fertig

Eine Phase ist fertig, wenn die Tests der Registrierung bestehen, `bun run test` und `bun run typecheck` bestehen, die geänderten Bildschirme in Telefon- und Desktopbreite funktionieren und diese Seite, die Architekturnotiz und die README das ausgelieferte Verhalten beschreiben.