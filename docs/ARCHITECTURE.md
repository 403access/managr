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

`src/db/migrations/0001_init.sql` is the initial schema applied at startup. `src/db/migrations/0003_multi_company.sql` adds per-company books, and `0007_projects_analytics.sql` adds projects, task types, and the project link on tasks and time. `src/db/schema.ts` is the Drizzle map of that SQL. Change both together.

Every bookkeeping table carries `company_id`. The active company is the row with `companies.is_active = 1`; switching is a database write, so it applies to the whole local desk. `accounts` is one shared SKR03 chart, while journal entries, invoices, customers, people, time, documents, obligations, and legal records are filtered by the active company. Invoice numbers and posting source keys are unique per company. A printed or downloaded invoice uses the company stored on that invoice, not whichever company is active.

The first launch of an empty database loads the sample company Atelier Nordlicht UG. Deleting `data/managr.db` restores it. User data lives only in that file and in `data/uploads`.

Two saved copies, `data/managr.demo.db` and `data/managr.production.db`, can be swapped with the open `data/managr.db`. `bun run db:demo` and `bun run db:prod` load a copy; `bun run db:demo:set` and `bun run db:prod:set` save the open database into a copy. `bun run db:prod:init` creates a clean production database with the schema and chart of accounts but no sample books. Production only accepts `db:prod:set` without `--from` while it is already active, and the script refuses a demo or sample database, so production never starts from demo books. `data/managr.active` records which copy is open, and `bun run db:status` shows it. Switching copies the open database back to its saved copy first, so stop the desk before switching and start it again afterwards. Uploads are not copied and stay shared in `data/uploads`.

## Projects and analysis

`projects` is the one place that ties a customer, tasks, and booked time together. A project has a status (`active`, `paused`, `done`) and a start and end date. Tasks and time entries point at a project; a time entry also carries its own task type, so time without a task still lands in the analysis. A task type is the kind of work (`development`, `design`, `planning`, `research`, `documentation`, `meeting`, `communication`, `admin`, `other`). `src/domain/analytics.ts` classifies the first four as productive and the rest as unproductive; the bucket never changes what was booked.

`/projects` maintains projects and shows the time, tasks, and deliverables on each one. `/analytics` reads `analyticsView` in `src/server/views.ts`: time per project, project starts and completions in the chosen year, the monthly productive/unproductive split, task types, the people and customers behind the time, and open and completed deliverables. Project starts and completions are events in the chosen year; "in progress" and "paused" are the state today. `read_analytics` and `read_projects` expose the same views to the assistant and MCP clients.

`/analytics/report` is the printable customer report. It is a server render outside the app shell, like the invoice print route, and uses the same `analyticsView` with an optional `customer` filter. The **Als PDF drucken** button opens the browser print dialog, where the report is saved as a PDF. There is no server-side PDF file and nothing is sent to a customer.

## Request flow

A screen does not open SQLite. `src/server/views.ts` builds the JSON for that screen from `src/server/queries.ts`, scoped to the active company. The server page puts that JSON into a TanStack Query cache with `Hydrate`. The client screen reads the same key with `useView`, and refetches `GET /api/views/[name]` when the cache is stale. Query keys live in `src/client/query-keys.ts`. Switching companies reloads the page because the cache keys do not carry the company id.

Mutations stay server actions in `src/server/actions.ts`. After a write they call `revalidatePath`, and the form invalidates the `view` query cache so the open screen refetches. Issued invoices, payments, expenses, payroll, reserve movements, and voids all go through a posting builder in `src/domain/postings.ts`. The printable invoice stays a server render and is not a query.

`GET /invoices/[id]/xrechnung` renders an XRechnung 3.0.2 UBL document from the invoice's company, the customer, and the invoice. The rules live in `src/domain/xrechnung.ts`. The XML is not stored.

The check button calls the `checkInvoiceXRechnung` server action. `src/server/validator.ts` posts the rendered XML to `VALIDATOR_URL` (the Compose validator, or `127.0.0.1:8090` for `bun dev`). `src/server/validator-report.ts` turns the KoSIT report into a verdict and a message list. It is a pure function with a test; the HTTP call is not cached and nothing is written to the database.

`src/server/payloads.ts` validates the invoice and manual-journal JSON. `src/server/people.ts` maps a person onto the social-insurance estimate. `src/server/files.ts` writes uploads under `data/uploads` and refuses a stored name that leaves that directory. `src/server/invoice-math.ts` is the only place that turns stored invoice lines into net, VAT, and open amounts.

## Assistant and MCP

`src/server/tools.ts` is the only tool registry. A tool has a name, a description, a Zod input schema, and a run function. Read tools call the view builders in `src/server/views.ts`, so the assistant sees the JSON a screen sees. Write tools call the same domain builders as the server actions and post through `src/server/posting.ts`; the books stay append-only and corrections stay reversals. `src/server/tools.ts` does not import Next.js and is tested on a temporary database.

`src/app/api/mcp/route.ts` serves the registry as an MCP server. It uses the SDK's Streamable HTTP transport in stateless mode with JSON responses, one POST per request. It is a route in the same Next process, not a second server and not a second port. It is reachable only on this computer while the desk runs.

The in-app assistant uses the same `runTool`. `src/app/api/assistant/route.ts` validates the conversation and streams newline-delimited events from `streamAssistant` in `src/server/assistant.ts`. That module resolves the model from `src/server/opencode.ts` or from `MANAGR_AI_BASE_URL`, `MANAGR_AI_MODEL`, and `MANAGR_AI_API_KEY`, asks an OpenAI-compatible endpoint with `stream: true`, accumulates tool-call deltas, executes each call with `runTool`, and yields `tool` and `tool_result` events with a capped copy of the data for the panel. The widget in `src/components/assistant.tsx` parses those lines, shows each step, renders an invoice or payroll card from the result, and invalidates the view cache after a write. It never executes a tool itself. A provider that ignores `stream` is handled as a plain JSON completion. A GET on the route reports whether a model is configured, without the key. See `docs/MCP-ASSISTANT.md`.

`src/server/opencode.ts` reads the local opencode CLI (`opencode api get /api/model`, `/api/provider`, `/api/credential`, `/api/model/default`) and caches the result for a minute. `GET /api/assistant/models` returns the providers and the chat models with tool support that can be reached over the OpenAI chat-completions protocol. The widget shows them as two searchable fields and sends the choice with each message; the route resolves it again, so the browser cannot redirect a request to an arbitrary endpoint. The provider credential is read on the server and never leaves it, and it is not persisted by managr. The environment variables remain the fallback when opencode is not installed, which is the normal case in the Docker image.

`src/server/web.ts` adds `web_search` and `web_fetch` to the same registry. A search asks DuckDuckGo's HTML endpoint, falls back to Bing, or uses a SearXNG endpoint from `MANAGR_WEB_SEARCH_URL`; a fetch resolves the host, refuses loopback and private addresses, follows at most five checked redirects, caps the body at 2 MB, and returns extracted text plus email addresses. Both cache for five minutes. `MANAGR_WEB=0` removes the two tools from `enabledTools()`, so the assistant's tool list, the MCP server, and `runTool` no longer see them. The tools are read-only and do not touch the database. A page is untrusted input: the system prompt forbids following instructions from it.

## UI

`(app)/layout.tsx` hydrates the shell. The shell is a client component: sidebar from 768px up, bottom navigation below that. The invoice print route sits outside the shell. Screens, the mobile menu, invoice lines, and journal lines are client components. The page files stay server components so they can prefetch the view.

Colors, type, and spacing are in `src/app/globals.css`. The layout is fluid and fills the viewport; there is no separate mobile site.

`invoices/layout.tsx` keeps the invoice list mounted while a nested route opens. From 1024px up the list is a sticky master pane and the selected invoice or invoice form fills the remaining width. Below that, a detail route hides the list and shows a back link, so the list and the detail never squeeze each other on a phone. Invoice forms and line rows use container queries rather than viewport breakpoints because the same component runs full width on a phone and in the narrow detail pane on a desktop.

Screens that stack several independent sections use `Tabs` in `src/components/tabs.tsx`. The open section is stored in the URL hash. Summary figures, page titles, and controls that apply to the whole page stay above the tab bar. Without JavaScript every section stays visible.

`/time/playback` replays `src/demo/time-tracking-2026.ts` entry by entry in the browser. It calls the domain time functions and never opens SQLite. The Time screen links to it as a test run.

## Language

The interface is German by default. English is the second language. The cookie `managr-locale` stores `de` or `en`. A missing or unknown value is German. `src/i18n/messages.ts` holds the chrome, and the German catalog is the source of the keys. Domain functions and server actions keep their English sentences, and `tx` translates the known ones when the locale is German. Query keys do not include the locale.

Printed invoices stay German in both languages, including the Kleinunternehmer note. SKR03 account names stay German. Dates and euro amounts stay in `de-DE` format. Stored titles, notes, and checklist rows are not translated when the language changes. The sample company is seeded in German. On startup, known English sample sentences are rewritten only when the company is still marked as the sample and the text still matches.

## Published site

`website/` is the public site. The marketing page is `website/src/pages/index.tsx`. Docusaurus reads `docs/` and does not copy those files. The notes are served at `/docs` (`routeBasePath: "docs"`). `/architecture`, `/domain`, and `/roadmap` redirect there. The German edition is at `/de/docs`, with the translated marketing page at `/de/`; the navbar language menu switches between the two. Translated pages live in `website/i18n/de/docusaurus-plugin-content-docs/current/`, and marketing-page strings in `website/i18n/de/code.json`. `bun run docs` serves the site at `http://localhost:3001/managr/`, and the notes at `http://localhost:3001/managr/docs`. `bun install --cwd website` installs its own dependencies from `website/bun.lock`.

A push to `main` runs `.github/workflows/docs.yml`. That workflow builds `website/` and deploys the static files to GitHub Pages at `https://403access.github.io/managr/`, with the notes at `https://403access.github.io/managr/docs`. The Pages source has to be GitHub Actions. A pull request runs `.github/workflows/docs-test.yml` and does not deploy. GitHub Free does not serve Pages for a private repository. The desk itself is not hosted and has no environment secret.

`docker compose up --build` runs the stack on this computer. The desk container is the Next.js server on port 3000. It reads `src/db/migrations` from the image and keeps `data/` on the host. The site container is nginx on port 3001. The build still uses `baseUrl: /managr/`, and nginx serves that prefix, so the notes stay at `/managr/docs`.

The image copies the source at build time, so a code change needs a rebuild, not a container restart. Dependency installation comes before the source copy, so a normal rebuild keeps that layer unless `package.json` or `bun.lock` changes. `bun run docker:restart` rebuilds and recreates the whole stack, `bun run docker:restart:desk` limits that to the desk, and `bun run docker:restart:site` to the site. `bun run docker:rebuild` bypasses the build cache for the whole stack; `bun run docker:rebuild:desk` and `bun run docker:rebuild:site` do the same for one service. `bun run docker:status`, `bun run docker:logs`, and `bun run docker:down` wrap the matching Compose commands.

The validator container is the KoSIT daemon on port 8080, published only on `127.0.0.1:8090`. The desk reaches it at `http://validator:8080`; a process on the host uses `http://127.0.0.1:8090`. The image pins the engine and the XRechnung rules and verifies both by SHA-256 at build time. See `docs/XRECHNUNG-VALIDATION.md`.

## Checks

`bun install` installs dependencies from `bun.lock`. `bun run test` runs Vitest. `bun run typecheck` runs the TypeScript compiler for the desk and for `website/`. `bun run build` produces the production server. `bun run docs:build` produces the published site, marketing page and docs together.
