---
slug: /architecture
---

# Architecture

managr is a Next.js App Router application. The browser talks to React Server Components and server actions. SQLite is opened on the server only.

```
src/domain        pure rules, no database, no React
src/db            Drizzle schema, SQL migration, connection, sample seed
src/server        queries, view JSON, and server actions
src/client        TanStack Query keys shared by the server and the browser
src/app           routes, including GET /api/views/[name]
src/components    layout, forms, and screens
src/i18n          German and English catalogs, labels, and phrase translation
docs/             notes published by the Docusaurus site
website/          published site; marketing page, docs served at /docs
data/managr.db    created on first launch (gitignored)
data/uploads      document files (gitignored)
```

## Boundaries

- A rule that can be wrong in euros, dates, or legal effect lives in `src/domain` and has a test in `tests/`.
- React does not reimplement VAT, reserve, social insurance, or deadlines. It renders what the domain returns.
- Only `src/db/client.ts` opens the database. Server actions call `getDb()`.
- Journal lines are inserted by `src/server/posting.ts`, which refuses anything `journalImbalance` rejects.
- Client components receive plain objects. They may import a server action and a view type. They do not import `src/db` or `src/server/queries.ts`.

## Money and time

Persisted money is integer cents. A euro input is parsed by `parseEuroToCents` (German and plain decimal forms). Dates are `YYYY-MM-DD` strings. Date arithmetic uses UTC so a timezone cannot shift the calendar day.

## Database

`src/db/migrations/0001_init.sql` is the schema applied at startup. `src/db/schema.ts` is the Drizzle map of that SQL. Change both together.

The first launch of an empty database loads the sample company Atelier Nordlicht UG. Deleting `data/managr.db` restores it. User data lives only in that file and in `data/uploads`.

Two saved copies, `data/managr.demo.db` and `data/managr.production.db`, can be swapped with the open `data/managr.db`. `bun run db:demo` and `bun run db:prod` load a copy; `bun run db:demo:set` and `bun run db:prod:set` save the open database into a copy. `data/managr.active` records which copy is open, and `bun run db:status` shows it. Switching copies the open database back to its saved copy first, so stop the desk before switching and start it again afterwards. Uploads are not copied and stay shared in `data/uploads`.

## Request flow

A screen does not open SQLite. `src/server/views.ts` builds the JSON for that screen from `src/server/queries.ts`. The server page puts that JSON into a TanStack Query cache with `Hydrate`. The client screen reads the same key with `useView`, and refetches `GET /api/views/[name]` when the cache is stale. Query keys live in `src/client/query-keys.ts`.

Mutations stay server actions in `src/server/actions.ts`. After a write they call `revalidatePath`, and the form invalidates the `view` query cache so the open screen refetches. Issued invoices, payments, expenses, payroll, reserve movements, and voids all go through a posting builder in `src/domain/postings.ts`. The printable invoice stays a server render and is not a query.

`GET /invoices/[id]/xrechnung` renders an XRechnung 3.0.2 UBL document from the current company, customer, and invoice. The rules live in `src/domain/xrechnung.ts`. The XML is not stored.

The check button calls the `checkInvoiceXRechnung` server action. `src/server/validator.ts` posts the rendered XML to `VALIDATOR_URL` (the Compose validator, or `127.0.0.1:8090` for `bun dev`). `src/server/validator-report.ts` turns the KoSIT report into a verdict and a message list. It is a pure function with a test; the HTTP call is not cached and nothing is written to the database.

`src/server/payloads.ts` validates the invoice and manual-journal JSON. `src/server/people.ts` maps a person onto the social-insurance estimate. `src/server/files.ts` writes uploads under `data/uploads` and refuses a stored name that leaves that directory. `src/server/invoice-math.ts` is the only place that turns stored invoice lines into net, VAT, and open amounts.

## UI

`(app)/layout.tsx` hydrates the shell. The shell is a client component: sidebar from 768px up, bottom navigation below that. The invoice print route sits outside the shell. Screens, the mobile menu, invoice lines, and journal lines are client components. The page files stay server components so they can prefetch the view.

Colors, type, and spacing are in `src/app/globals.css`. The layout is fluid; there is no separate mobile site.

Screens that stack several independent sections use `Tabs` in `src/components/tabs.tsx`. The open section is stored in the URL hash. Summary figures, page titles, and controls that apply to the whole page stay above the tab bar. Without JavaScript every section stays visible.

## Language

The interface is German by default. English is the second language. The cookie `managr-locale` stores `de` or `en`. A missing or unknown value is German. `src/i18n/messages.ts` holds the chrome, and the German catalog is the source of the keys. Domain functions and server actions keep their English sentences, and `tx` translates the known ones when the locale is German. Query keys do not include the locale.

Printed invoices stay German in both languages, including the Kleinunternehmer note. SKR03 account names stay German. Dates and euro amounts stay in `de-DE` format. Stored titles, notes, and checklist rows are not translated when the language changes. The sample company is seeded in German. On startup, known English sample sentences are rewritten only when the company is still marked as the sample and the text still matches.

## Published site

`website/` is the public site. The marketing page is `website/src/pages/index.tsx`. Docusaurus reads `docs/` and does not copy those files. The notes are served at `/docs` (`routeBasePath: "docs"`). `/architecture`, `/domain`, and `/roadmap` redirect there. `bun run docs` serves the site at `http://localhost:3001/managr/`, and the notes at `http://localhost:3001/managr/docs`. `bun install --cwd website` installs its own dependencies from `website/bun.lock`.

A push to `main` runs `.github/workflows/docs.yml`. That workflow builds `website/` and deploys the static files to GitHub Pages at `https://403access.github.io/managr/`, with the notes at `https://403access.github.io/managr/docs`. The Pages source has to be GitHub Actions. A pull request runs `.github/workflows/docs-test.yml` and does not deploy. GitHub Free does not serve Pages for a private repository. The desk itself is not hosted and has no environment secret.

`docker compose up --build` runs the stack on this computer. The desk container is the Next.js server on port 3000. It reads `src/db/migrations` from the image and keeps `data/` on the host. The site container is nginx on port 3001. The build still uses `baseUrl: /managr/`, and nginx serves that prefix, so the notes stay at `/managr/docs`.

The validator container is the KoSIT daemon on port 8080, published only on `127.0.0.1:8090`. The desk reaches it at `http://validator:8080`; a process on the host uses `http://127.0.0.1:8090`. The image pins the engine and the XRechnung rules and verifies both by SHA-256 at build time. See `docs/XRECHNUNG-VALIDATION.md`.

## Checks

`bun install` installs dependencies from `bun.lock`. `bun run test` runs Vitest. `bun run typecheck` runs the TypeScript compiler for the desk and for `website/`. `bun run build` produces the production server. `bun run docs:build` produces the published site, marketing page and docs together.
