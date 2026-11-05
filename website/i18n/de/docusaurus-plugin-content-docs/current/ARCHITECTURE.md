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
src/app           Routen, einschließlich GET /api/views/[name]
src/components    Layout, Formulare und Bildschirme
src/i18n          deutsche und englische Kataloge, Labels und Phrasenübersetzung
docs/             Notizen, die die Docusaurus-Website veröffentlicht
website/          veröffentlichte Website; Marketingseite, Docs unter /docs
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

## Anfragefluss

Ein Bildschirm öffnet kein SQLite. `src/server/views.ts` baut das JSON für diesen Bildschirm aus `src/server/queries.ts`. Die Serverseite legt dieses JSON mit `Hydrate` in einen TanStack-Query-Cache. Der Client-Bildschirm liest denselben Key mit `useView` und lädt `GET /api/views/[name]` neu, wenn der Cache veraltet ist. Query-Keys liegen in `src/client/query-keys.ts`.

Mutationen bleiben Server Actions in `src/server/actions.ts`. Nach einem Schreibvorgang rufen sie `revalidatePath` auf, und das Formular invalidiert den `view`-Query-Cache, damit der offene Bildschirm neu lädt. Ausgestellte Rechnungen, Zahlungen, Ausgaben, Lohn, Rücklagenbewegungen und Stornos laufen alle über einen Buchungs-Builder in `src/domain/postings.ts`. Die druckbare Rechnung bleibt ein Server-Render und ist keine Abfrage.

`GET /invoices/[id]/xrechnung` erzeugt aus dem Unternehmen der Rechnung, dem Kunden und der Rechnung ein XRechnung-3.0.2-UBL-Dokument. Die Regeln stehen in `src/domain/xrechnung.ts`. Das XML wird nicht gespeichert.

Die Prüfschaltfläche ruft die Server Action `checkInvoiceXRechnung` auf. `src/server/validator.ts` sendet das erzeugte XML an `VALIDATOR_URL` (den Compose-Validator oder `127.0.0.1:8090` bei `bun dev`). `src/server/validator-report.ts` macht aus dem KoSIT-Bericht ein Urteil und eine Meldungsliste. Es ist eine reine Funktion mit einem Test; der HTTP-Aufruf wird nicht gecacht, und es wird nichts in die Datenbank geschrieben.

`src/server/payloads.ts` validiert das Rechnungs- und das manuelle Journal-JSON. `src/server/people.ts` bildet eine Person auf die Sozialversicherungsschätzung ab. `src/server/files.ts` schreibt Uploads unter `data/uploads` und lehnt einen gespeicherten Namen ab, der dieses Verzeichnis verlässt. `src/server/invoice-math.ts` ist die einzige Stelle, die gespeicherte Rechnungszeilen in Netto-, Umsatzsteuer- und offene Beträge umwandelt.

## Oberfläche

`(app)/layout.tsx` hydratisiert die Shell. Die Shell ist eine Client-Komponente: Seitenleiste ab 768px, untere Navigation darunter. Die Rechnungsdruck-Route liegt außerhalb der Shell. Bildschirme, das mobile Menü, Rechnungszeilen und Journalzeilen sind Client-Komponenten. Die Page-Dateien bleiben Server-Komponenten, damit sie die View vorab laden können.

Farben, Typografie und Abstände stehen in `src/app/globals.css`. Das Layout ist fließend und füllt das Viewport; es gibt keine separate mobile Website.

`invoices/layout.tsx` hält die Rechnungsliste gemountet, während eine verschachtelte Route geöffnet wird. Ab 1024px ist die Liste ein klebender Hauptbereich, und die ausgewählte Rechnung oder das Rechnungsformular füllt die verbleibende Breite. Darunter blendet eine Detailroute die Liste aus und zeigt einen Zurück-Link, sodass Liste und Detail einander auf dem Telefon nie einengen. Rechnungsformulare und Zeilen verwenden Container Queries statt Viewport-Breakpoints, weil dieselbe Komponente auf dem Telefon in voller Breite und auf dem Desktop im schmalen Detailbereich läuft.

Bildschirme, die mehrere unabhängige Abschnitte stapeln, verwenden `Tabs` in `src/components/tabs.tsx`. Der offene Abschnitt wird im URL-Hash gespeichert. Summenzahlen, Seitentitel und Steuerelemente für die ganze Seite bleiben über der Tab-Leiste. Ohne JavaScript bleibt jeder Abschnitt sichtbar.

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
