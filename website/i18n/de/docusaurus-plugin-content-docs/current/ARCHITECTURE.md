---
slug: /architecture
---

# Architektur

managr ist eine Next.js-App-Router-Anwendung. Der Browser spricht mit React Server Components und Server Actions. SQLite wird nur auf dem Server geöffnet.

```
src/domain        reine Regeln, keine Datenbank, kein React
src/db            Drizzle-Schema, SQL-Migration, Verbindung, Beispiel-Seed
src/server        Abfragen, View-JSON und Server Actions
src/client        von Server und Browser gemeinsam genutzte TanStack-Query-Keys
src/app           Routen, einschließlich GET /api/views/[name] und POST /api/tools
src/components    Layout, Formulare und Bildschirme
src/i18n          deutsche und englische Kataloge, Labels und Phrasenübersetzung
src/content       kuratiertes Quellenregister und die Erklärungen hinter den Bildschirmen
docs/             Notizen, die die Docusaurus-Website veröffentlicht
website/          veröffentlichte Website; Marketingseite, Docs unter /docs
ios/              nativer SwiftUI-Client und sein XcodeGen-Projekt
data/managr.db    wird beim ersten Start angelegt (von Git ignoriert)
data/uploads      Dokumentdateien (von Git ignoriert)
```

## Grenzen

- Eine Regel, die bei Euro-Beträgen, Terminen oder rechtlicher Wirkung falsch sein kann, lebt in `src/domain` und hat einen Test in `tests/`.
- React reimplementiert keine Umsatzsteuer, Rücklage, Sozialversicherung oder Fristen. Es rendert, was die Domäne zurückgibt.
- Nur `src/db/client.ts` öffnet die Datenbank. Server Actions rufen `getDb()` auf.
- Journalzeilen werden von `src/server/posting.ts` eingefügt, das alles ablehnt, was `journalImbalance` verwirft.
- Client-Komponenten erhalten einfache Objekte. Sie dürfen eine Server Action und einen View-Typ importieren. Sie importieren nicht `src/db` oder `src/server/queries.ts`.

## Geld und Zeit

Gespeicherte Geldbeträge sind ganzzahlige Cent. Eine Euro-Eingabe wird von `parseEuroToCents` geparst (deutsche und einfache Dezimalformen). Datumswerte sind `YYYY-MM-DD`-Strings. Die Datumsarithmetik verwendet UTC, damit eine Zeitzone den Kalendertag nicht verschiebt.

## Datenbank

`src/db/migrations/0001_init.sql` ist das Startschema. `src/db/migrations/0003_multi_company.sql` ergänzt die Bücher je Unternehmen. `src/db/schema.ts` ist die Drizzle-Abbildung dieses SQL. Beides zusammen ändern.

Jede Buchhaltungstabelle trägt `company_id`. Aktives Unternehmen ist die Zeile mit `companies.is_active = 1`; der Wechsel ist ein Datenbankschreibvorgang und gilt für den ganzen lokalen Schreibtisch. `accounts` ist ein gemeinsamer SKR03-Kontenrahmen; Journalzeilen, Rechnungen, Kunden, Personen, Zeit, Dokumente, Pflichten und rechtliche Unterlagen werden nach aktivem Unternehmen gefiltert. Rechnungsnummern und Buchungsquellen sind je Unternehmen eindeutig. Eine gedruckte oder heruntergeladene Rechnung verwendet das auf der Rechnung gespeicherte Unternehmen, nicht das gerade aktive.

Beim ersten Start einer leeren Datenbank wird die Beispielgesellschaft Atelier Nordlicht UG geladen. Das Löschen von `data/managr.db` stellt sie wieder her. Benutzerdaten liegen nur in dieser Datei und in `data/uploads`.

Zwei gespeicherte Kopien, `data/managr.demo.db` und `data/managr.production.db`, können mit der geöffneten `data/managr.db` getauscht werden. `bun run db:demo` und `bun run db:prod` laden eine Kopie; `bun run db:demo:set` und `bun run db:prod:set` speichern die geöffnete Datenbank in eine Kopie. `bun run db:prod:init` erstellt eine saubere Produktionsdatenbank mit Schema und Kontenrahmen, aber ohne Beispielbuchungen. Produktion akzeptiert `db:prod:set` ohne `--from` nur, während sie bereits aktiv ist, und das Skript lehnt eine Demo- oder Beispieldatenbank ab, sodass Produktion nie mit Demo-Buchungen startet. `data/managr.active` zeichnet auf, welche Kopie geöffnet ist, und `bun run db:status` zeigt sie an. Beim Wechsel wird die geöffnete Datenbank zuerst in ihre gespeicherte Kopie zurückgeschrieben; beende den Schreibtisch daher vor dem Wechsel und starte ihn danach neu. Uploads werden nicht kopiert und bleiben gemeinsam in `data/uploads`.

## Personen und Organigramm

**Personen** hält den Beschäftigungsdatensatz jeder Person, einschließlich der Führungskraft. `employees.manager_id` ist ein Selbstverweis aus `0009_org_chart.sql`; eine Person ohne ihn steht oben. Die Führungskraft wird auf dem Tab **Beschäftigung** der Person gewählt, und das Speichern lehnt einen Selbstverweis oder eine Schleife ab.

**Organigramm** steht auf der Seite **Personen**. `peoplePageView` in `src/server/views.ts` verbindet die Beschäftigungsliste mit `orgView`, das den Baum baut. `src/domain/org.ts` sortiert jede Ebene nach Namen, lässt Personen mit einem Enddatum aus dem Baum und bricht eine bestehende Schleife an ihrer niedrigsten ID, damit die Seite weiterhin rendert. Eine Führungskraft außerhalb des aktiven Unternehmens lässt die Person oben. Nichts im Organigramm wird ins Journal gebucht. `read_org` gibt denselben Baum an Assistent und MCP-Clients weiter.

## Projekte und Auswertung

`/projects` pflegt Projekte und zeigt Zeit, Aufgaben und Ergebnisse je Projekt. `/analytics` liest `analyticsView` in `src/server/views.ts`: Zeit je Projekt, Projektstarts und -abschlüsse im gewählten Jahr, die monatliche Aufteilung in produktive und unproduktive Zeit, Aufgabenarten, die Personen und Kunden hinter der Zeit sowie offene und erledigte Ergebnisse. Projektstarts und -abschlüsse sind Ereignisse im gewählten Jahr; „laufend“ und „pausiert“ sind der Zustand heute. `read_analytics` und `read_projects` geben dieselben Ansichten an Assistent und MCP-Clients weiter.

## Meilensteine

`milestones` ist bewusst nicht an ein Unternehmen gebunden: Die Seite vergleicht Ziele über den ganzen Schreibtisch. `milestone_companies` verknüpft ein Ziel mit beliebig vielen Unternehmen; keine Zeile bedeutet, das Ziel gilt für die Gruppe als Ganzes. `/milestones` liest `milestonesView` in `src/server/views.ts`, das die verknüpften Unternehmen, die Überfällig-Markierung und den effektiven Fortschritt ergänzt. `src/domain/milestones.ts` enthält die Filter, die Quartalsgruppierung und die Auswertung nach Status, Kategorie, Unternehmen und Quartal; `read_milestones`, `save_milestone` und `delete_milestone` geben dieselben Daten und Regeln an Assistent und MCP-Clients weiter. Ein Meilenstein bucht nie ins Journal und ändert die Bücher nicht.

## Gründervergütung

Drei Datensätze stehen neben den vorhandenen Lohn- und Gesellschafterdaten:

- `director_contracts` auf dem Personenbildschirm speichert den schriftlichen Geschäftsführervertrag. `src/domain/director-contract.ts` wählt den aktuellen Vertrag, lehnt ein rückwirkendes Unterschriftsdatum in der Server Action und im MCP-Werkzeug ab und erstellt die Erinnerungen zu Vertrag und Gehaltsänderungen.
- `shareholder_loans` und `shareholder_loan_movements` auf dem Gesellschaftsbildschirm speichern eine Finanzierungsvereinbarung mit einem Gesellschafter. `src/domain/shareholder-loan.ts` berechnet den offenen Betrag und die vorgeschlagenen Zinsen; `src/domain/postings.ts` bucht Auszahlungen, Tilgungen und Zinsen über dasselbe Journal.
- `founder_health` speichert die private oder freiwillig gesetzliche Versicherung der Geschäftsführung, den Beitrag und das Statusfeststellungsverfahren. `src/domain/founder-health.ts` erstellt die Erinnerungsliste. Der Beitrag ist nie eine Lohnzeile.

Die Personenansicht und die Gesellschaftsansicht stellen diese Datensätze den Bildschirmen bereit. Dieselben Daten sind über `read_person`, `read_company`, `save_director_contract`, `save_founder_health`, `add_shareholder_loan` und `record_shareholder_loan_movement` erreichbar.

## Geldfluss

`/cashflow` liest `cashflowView` in `src/server/views.ts`. Die Ansicht kombiniert die Rechnungen eines Kalenderjahres mit den Journalzeilen des Jahres: Abrechnung und Zahlungsstand, dann teilt `moneyFlow` aus `src/domain/money-flow.ts` den Bruttoumsatz in Einkäufe, Nettolöhne, Lohnsteuer, Sozialversicherung, Umsatzsteuer-Zahllast, Körperschaftsteuer, Solidaritätszuschlag, Gewerbesteuer und Gewinn nach Steuern. Die Domänenfunktion hält die Anteile ausgeglichen; eine Umsatzsteuer-Gutschrift oder ein Verlust wird zu zusätzlicher Finanzierung statt zu einem negativen Band. Die Ansicht führt außerdem die Umsatzsteuerkette, gruppiert tatsächliche Bankbewegungen nach Buchungsquelle und zählt die als erledigt markierten Umsatzsteuer- und Lohnsteuererklärungen. Körperschaft- und Gewerbesteuer bleiben dieselbe Planungsschätzung wie im Journal. `read_cashflow` gibt die Ansicht an Assistent und MCP-Clients weiter.

## Bank (Qonto)

`/bank` verbindet ein Qonto-Geschäftskonto je Unternehmen. `src/server/qonto.ts` spricht die Qonto-API, und `src/server/bank.ts` speichert Verbindung, Konten und Umsätze in `bank_connections`, `bank_accounts` und `bank_transactions`. Die Verbindung ist schreibgeschützt: Der Schlüssel wird in der Datenbank gespeichert und nie an den Browser zurückgegeben; die Ansicht zeigt nur die letzten vier Zeichen. Der erste Sync liest zwölf Monate, spätere Syncs fragen mit einem Tag Überlappung nur Änderungen ab. Das Transaktionsdatum ist der Berliner Kalendertag von `settled_at`, dann `emitted_at`, dann `created_at`. Kontosalden werden bei jedem Sync aktualisiert.

Die Bankseite ist reine Anzeige. Keine Bankzeile läuft durch `src/server/posting.ts`, und das Journal bleibt die Quelle der Bücher. Dieselbe Ansicht ist als `read_bank` für Assistent und MCP-Clients verfügbar. Die Verbindung wird am Bildschirm angelegt und entfernt; kein Werkzeug erhält den Qonto-Schlüssel. Ein Bank-CSV-Import steht weiterhin auf der Roadmap.

## Quellenregister und Erklärungen

`src/content/sources.ts` enthält zwei kuratierte Datensätze. `sources` ist das Register: eine stabile ID, ein deutscher und englischer Titel, Herausgeber, Art, Hinweis und genau eine offizielle https-Adresse. `guides` ordnet einem Bildschirm eine Zusammenfassung, Abschnitte und die zitierten Quellen-IDs zu. Die Info-Spalte der Bildschirme liest einen Leitfaden über `guideById`; die Seite `/sources` gruppiert das Register nach Domain und filtert nach Suchtext, Domain oder Thema.

Die Datei ist typisiert und getestet: Jede Domain stammt aus der URL, jede referenzierte Quellen-ID löst sich auf, jede Quelle wird von mindestens einem Leitfaden genutzt, und jede Quelle gehört zu genau einer Domaingruppe. Es gibt keine Datenbanktabelle und keinen Netzwerkzugriff. Der Text erklärt eine Regel und verlinkt die Behörde; er ist keine erzeugte Rechtsberatung.

`read_guides` und `read_sources` geben dieselben Daten an Assistent und MCP-Clients weiter. Sie akzeptieren `locale` (`de` oder `en`) und optionale Filter nach Thema, Suchtext oder Domain. Sie funktionieren auch mit `MANAGR_WEB=0`, weil das Register lokal ist. Ein Leitfadenergebnis ist Referenzmaterial, nie eine Buchung.

## Anfragefluss

Ein Bildschirm öffnet kein SQLite. `src/server/views.ts` baut das JSON für diesen Bildschirm aus `src/server/queries.ts`. Die Serverseite legt dieses JSON mit `Hydrate` in einen TanStack-Query-Cache. Der Client-Bildschirm liest denselben Key mit `useView` und lädt `GET /api/views/[name]` neu, wenn der Cache veraltet ist. Query-Keys liegen in `src/client/query-keys.ts`.

Mutationen bleiben Server Actions in `src/server/actions.ts`. Nach einem Schreibvorgang rufen sie `revalidatePath` auf, und das Formular invalidiert den `view`-Query-Cache, damit der offene Bildschirm neu lädt. Ausgestellte Rechnungen, Zahlungen, Ausgaben, Lohn, Rücklagenbewegungen und Stornos laufen alle über einen Buchungs-Builder in `src/domain/postings.ts`. Die druckbare Rechnung bleibt ein Server-Render und ist keine Abfrage.

`GET /invoices/[id]/xrechnung` erzeugt aus dem Unternehmen der Rechnung, dem Kunden und der Rechnung ein XRechnung-3.0.2-UBL-Dokument. Die Regeln stehen in `src/domain/xrechnung.ts`. Das XML wird nicht gespeichert. Der Kundentyp `kind` (`business`, `public` oder `private`) wählt die BT-10-Regel: Eine öffentliche Auftraggeberin braucht eine Leitweg-ID mit gültigen MOD-97-10-Prüfziffern, ein Unternehmen eine Referenz, eine Privatperson keine E-Rechnung.

Die Prüfschaltfläche ruft die Server Action `checkInvoiceXRechnung` auf. `src/server/validator.ts` sendet das erzeugte XML an `VALIDATOR_URL` (den Compose-Validator oder `127.0.0.1:8090` bei `bun dev`). `src/server/validator-report.ts` macht aus dem KoSIT-Bericht ein Urteil und eine Meldungsliste. Es ist eine reine Funktion mit einem Test; der HTTP-Aufruf wird nicht gecacht, und es wird nichts in die Datenbank geschrieben.

`src/server/payloads.ts` validiert das Rechnungs- und das manuelle Journal-JSON. `src/server/people.ts` bildet eine Person auf die Sozialversicherungsschätzung ab. `src/server/files.ts` schreibt Uploads unter `data/uploads` und lehnt einen gespeicherten Namen ab, der dieses Verzeichnis verlässt. `src/server/invoice-math.ts` ist die einzige Stelle, die gespeicherte Rechnungszeilen in Netto-, Umsatzsteuer- und offene Beträge umwandelt.

## Assistent und MCP

`src/server/tools.ts` ist die einzige Werkzeugregistrierung. Ein Werkzeug hat einen Namen, eine Beschreibung, ein Zod-Eingabeschema und eine Ausführungsfunktion. Lese-Werkzeuge rufen die Ansichts-Funktionen in `src/server/views.ts` auf, damit der Assistent dasselbe JSON sieht wie ein Bildschirm. Die Lese-Werkzeuge decken jeden Bildschirm ab, einschließlich `read_org` für das Organigramm und `read_guides` / `read_sources` für das Quellenregister in `src/content/sources.ts`. Schreib-Werkzeuge rufen dieselben Domänenfunktionen wie die Server-Actions auf und buchen über `src/server/posting.ts`; die Bücher bleiben fortgeschrieben, Korrekturen bleiben Stornobuchungen. `src/server/tools.ts` importiert kein Next.js und wird auf einer temporären Datenbank getestet.

`src/app/api/mcp/route.ts` stellt die Registrierung als MCP-Server bereit. Er nutzt den Streamable-HTTP-Transport des SDK im zustandslosen Modus mit JSON-Antworten, ein POST je Anfrage. Es ist eine Route im selben Next-Prozess, kein zweiter Server und kein zweiter Port. Er ist nur auf diesem Computer erreichbar, solange der Schreibtisch läuft.

Der Assistent in der App nutzt dasselbe `runTool`. `src/app/api/assistant/route.ts` prüft das Gespräch und streamt zeilengetrennte Ereignisse aus `streamAssistant` in `src/server/assistant.ts`. Dieses Modul löst das Modell aus `src/server/opencode.ts` oder aus `MANAGR_AI_BASE_URL`, `MANAGR_AI_MODEL` und `MANAGR_AI_API_KEY` auf, fragt einen OpenAI-kompatiblen Endpunkt mit `stream: true`, sammelt Werkzeugaufruf-Deltas, führt jeden Aufruf mit `runTool` aus und liefert `tool`- und `tool_result`-Ereignisse mit einer gekürzten Datenkopie für das Panel. Das Widget in `src/components/assistant.tsx` liest diese Zeilen, zeigt jeden Schritt, zeichnet aus dem Ergebnis eine Rechnungs- oder Lohnkarte und leert nach einem Schreibvorgang den Ansichtscache. Es führt selbst kein Werkzeug aus. Ein Anbieter, der `stream` ignoriert, wird als einfache JSON-Antwort behandelt. Ein GET auf der Route meldet, ob ein Modell eingestellt ist, ohne den Schlüssel. Siehe `docs/MCP-ASSISTANT.md`.

`src/server/opencode.ts` liest die lokale opencode-CLI (`opencode api get /api/model`, `/api/provider`, `/api/credential`, `/api/model/default`) und cacht das Ergebnis eine Minute. `GET /api/assistant/models` liefert die Anbieter und die Chat-Modelle mit Werkzeugunterstützung, die über das OpenAI-Chat-Completions-Protokoll erreichbar sind. Das Widget zeigt sie als zwei durchsuchbare Felder und sendet die Wahl mit jeder Nachricht; die Route prüft sie erneut, damit der Browser eine Anfrage nicht an einen beliebigen Endpunkt umleiten kann. Die Zugangsdaten des Anbieters werden auf dem Server gelesen, verlassen ihn nie und werden von managr nicht gespeichert. Die Umgebungsvariablen bleiben der Ausweichweg, wenn opencode nicht installiert ist, was im Docker-Image der Normalfall ist.

`src/server/web.ts` ergänzt `web_search` und `web_fetch` in derselben Registrierung. Eine Suche fragt den HTML-Endpunkt von DuckDuckGo, weicht auf Bing aus oder nutzt einen SearXNG-Endpunkt aus `MANAGR_WEB_SEARCH_URL`; ein Abruf löst den Host auf, lehnt Loopback- und private Adressen ab, folgt höchstens fünf geprüften Weiterleitungen, begrenzt den Body auf 2 MB und liefert extrahierten Text plus E-Mail-Adressen. Beide cachen fünf Minuten. `MANAGR_WEB=0` entfernt die zwei Werkzeuge aus `enabledTools()`, sodass die Werkzeugliste des Assistenten, der MCP-Server und `runTool` sie nicht mehr sehen. Die Werkzeuge sind schreibgeschützt und berühren die Datenbank nicht. Eine Seite ist nicht vertrauenswürdige Eingabe: Der System-Prompt verbietet, Anweisungen daraus zu folgen.

## iPhone-Client

`ios/` ist ein nativer SwiftUI-Client für denselben Schreibtisch. Er öffnet kein SQLite und hält keine Kopie der Bücher. Gelesen wird über die bestehende Route `GET /api/views/[name]`, sodass das Telefon dasselbe JSON erhält wie ein Bildschirm. Geschrieben wird über `POST /api/tools` in `src/app/api/tools/route.ts`, eine einfache JSON-Fassade, die `runTool` aufruft und `{ ok, data }` oder `{ ok, error }` zurückgibt. Es sind dasselbe Register, dieselbe Zod-Validierung, dieselben Domänen-Builder und dasselbe Journal aus `src/server/posting.ts` wie beim MCP-Endpunkt und beim Assistenten.

Server Actions werden vom Telefon nicht verwendet. Ihre IDs sind Build-Artefakte, und der Body ist React-Flight-kodiert; das ist keine stabile Schnittstelle für einen nativen Client. Die iPhone-App schreibt nie über einen zweiten Pfad: `runTool` ist der eine Vertrag.

Die App hat einen eigenen Verbindungsbildschirm und speichert nur die Adresse des Schreibtischs und die Sprache in `UserDefaults`. Sie cached die Bücher nicht; jeder Bildschirm liest vom Schreibtisch. `Info.plist` erlaubt HTTP im lokalen Netz über eine ATS-Ausnahme, und iOS fragt beim ersten Zugriff nach der Freigabe fürs lokale Netzwerk. Wie `/api/mcp` hat `/api/tools` keine Anmeldung; Schreibtisch und Telefon bleiben daher in einem vertrauenswürdigen Netz.

Das Xcode-Projekt wird mit XcodeGen aus `ios/project.yml` erzeugt. `ios/Managr/` enthält die App: `App/` für den Einstiegspunkt und `AppState`, `Core/` für HTTP-Client, Modelle und Formatierung, `Design/` und `Features/` für die Bildschirme. Bauen, Signieren und Installieren stehen in `ios/README.md`.

## Oberfläche

`(app)/layout.tsx` hydratisiert die Shell. Die Shell ist eine Client-Komponente: Seitenleiste ab 768px, untere Navigation darunter. Die Rechnungsdruck-Route liegt außerhalb der Shell. Bildschirme, das mobile Menü, Rechnungszeilen und Journalzeilen sind Client-Komponenten. Die Page-Dateien bleiben Server-Komponenten, damit sie die View vorab laden können.

Farben, Typografie und Abstände stehen in `src/app/globals.css`. Das Layout ist fließend und füllt das Viewport; es gibt keine separate mobile Website.

`invoices/layout.tsx` hält die Rechnungsliste gemountet, während eine verschachtelte Route geöffnet wird. Ab 1024px ist die Liste ein klebender Hauptbereich, und die ausgewählte Rechnung oder das Rechnungsformular füllt die verbleibende Breite. Darunter blendet eine Detailroute die Liste aus und zeigt einen Zurück-Link, sodass Liste und Detail einander auf dem Telefon nie einengen. Rechnungsformulare und Zeilen verwenden Container Queries statt Viewport-Breakpoints, weil dieselbe Komponente auf dem Telefon in voller Breite und auf dem Desktop im schmalen Detailbereich läuft.

Bildschirme, die mehrere unabhängige Abschnitte stapeln, verwenden `Tabs` in `src/components/tabs.tsx`. Der offene Abschnitt wird im URL-Hash gespeichert. Summenzahlen, Seitentitel und Steuerelemente für die ganze Seite bleiben über der Tab-Leiste. Ohne JavaScript bleibt jeder Abschnitt sichtbar.

`/time/playback` spielt `src/demo/time-tracking-2026.ts` Eintrag für Eintrag im Browser ab. Er ruft die Domänenfunktionen für Zeit auf und öffnet nie SQLite. Der Zeit-Bildschirm verlinkt ihn als Testlauf.

## Sprache

Die Oberfläche ist standardmäßig Deutsch. Englisch ist die zweite Sprache. Das Cookie `managr-locale` speichert `de` oder `en`. Ein fehlender oder unbekannter Wert bedeutet Deutsch. `src/i18n/messages.ts` enthält die Chrome-Texte, und der deutsche Katalog ist die Quelle der Keys. Domänenfunktionen und Server Actions behalten ihre englischen Sätze, und `tx` übersetzt die bekannten, wenn die Locale Deutsch ist. Query-Keys enthalten die Locale nicht.

Gedruckte Rechnungen bleiben in beiden Sprachen Deutsch, einschließlich des Kleinunternehmer-Hinweises. SKR03-Kontonamen bleiben Deutsch. Datums- und Euro-Beträge bleiben im Format `de-DE`. Gespeicherte Titel, Notizen und Checklisten-Zeilen werden beim Sprachwechsel nicht übersetzt. Die Beispielgesellschaft wird auf Deutsch angelegt. Beim Start werden bekannte englische Beispielsätze nur dann neu geschrieben, wenn die Gesellschaft noch als Beispiel markiert ist und der Text noch übereinstimmt.

## Veröffentlichte Website

`website/` ist die öffentliche Website. Die Marketingseite ist `website/src/pages/index.tsx`. Docusaurus liest `docs/` und kopiert diese Dateien nicht. Die Notizen werden unter `/docs` ausgeliefert (`routeBasePath: "docs"`). `/architecture`, `/domain` und `/roadmap` leiten dorthin um. Die deutsche Fassung liegt unter `/de/docs`, die übersetzte Marketingseite unter `/de/`; die Sprache lässt sich über das Menü in der Navigationsleiste wechseln. Die übersetzten Seiten liegen in `website/i18n/de/docusaurus-plugin-content-docs/current/`, die Texte der Marketingseite in `website/i18n/de/code.json`. `bun run docs` liefert die Website unter `http://localhost:3001/managr/` aus, die Notizen unter `http://localhost:3001/managr/docs`. `bun install --cwd website` installiert die eigenen Abhängigkeiten aus `website/bun.lock`.

Ein Push auf `main` startet `.github/workflows/docs.yml`. Der Workflow baut `website/` und stellt die statischen Dateien auf GitHub Pages unter `https://403access.github.io/managr/` bereit, mit den Notizen unter `https://403access.github.io/managr/docs`. Die Pages-Quelle muss GitHub Actions sein. Ein Pull Request startet `.github/workflows/docs-test.yml` und stellt nichts bereit. GitHub Free liefert Pages nicht für ein privates Repository aus. Der Schreibtisch selbst wird nicht gehostet und hat kein Umgebungsgeheimnis.

`docker compose up --build` führt den Stack auf diesem Computer aus. Der Schreibtisch-Container ist der Next.js-Server auf Port 3000. Er liest `src/db/migrations` aus dem Image und hält `data/` auf dem Host. Der Website-Container ist nginx auf Port 3001. Der Build verwendet weiterhin `baseUrl: /managr/`, und nginx liefert dieses Präfix aus, sodass die Notizen unter `/managr/docs` bleiben.

Das Image kopiert die Quellen zur Build-Zeit, daher braucht eine Codeänderung einen Rebuild, keinen Container-Neustart. Die Abhängigkeitsinstallation kommt vor dem Kopieren der Quellen, sodass ein normaler Rebuild diese Ebene behält, solange sich `package.json` oder `bun.lock` nicht ändert. `bun run docker:restart` baut den ganzen Stack neu und erstellt die Container neu, `bun run docker:restart:desk` beschränkt das auf den Schreibtisch und `bun run docker:restart:site` auf die Website. `bun run docker:rebuild` umgeht den Build-Cache für den ganzen Stack; `bun run docker:rebuild:desk` und `bun run docker:rebuild:site` tun dasselbe für einen Dienst. `bun run docker:status`, `bun run docker:logs` und `bun run docker:down` umhüllen die passenden Compose-Befehle.

Der Validator-Container ist der KoSIT-Daemon auf Port 8080, nur auf `127.0.0.1:8090` veröffentlicht. Der Schreibtisch erreicht ihn unter `http://validator:8080`; ein Prozess auf dem Host verwendet `http://127.0.0.1:8090`. Das Image pinnt die Engine und die XRechnung-Regeln und prüft beide zur Build-Zeit per SHA-256. Siehe `docs/XRECHNUNG-VALIDATION.md`.

## Prüfungen

`bun install` installiert die Abhängigkeiten aus `bun.lock`. `bun run test` führt Vitest aus. `bun run typecheck` führt den TypeScript-Compiler für den Schreibtisch und für `website/` aus. `bun run build` erzeugt den Produktionsserver. `bun run docs:build` erzeugt die veröffentlichte Website, Marketingseite und Docs zusammen.
