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

## Request flow

A screen does not open SQLite. `src/server/views.ts` builds the JSON for that screen from `src/server/queries.ts`. The server page puts that JSON into a TanStack Query cache with `Hydrate`. The client screen reads the same key with `useView`, and refetches `GET /api/views/[name]` when the cache is stale. Query keys live in `src/client/query-keys.ts`.

Mutations stay server actions in `src/server/actions.ts`. After a write they call `revalidatePath`, and the form invalidates the `view` query cache so the open screen refetches. Issued invoices, payments, expenses, payroll, reserve movements, and voids all go through a posting builder in `src/domain/postings.ts`. The printable invoice stays a server render and is not a query.

`src/server/payloads.ts` validates the invoice and manual-journal JSON. `src/server/people.ts` maps a person onto the social-insurance estimate. `src/server/files.ts` writes uploads under `data/uploads` and refuses a stored name that leaves that directory. `src/server/invoice-math.ts` is the only place that turns stored invoice lines into net, VAT, and open amounts.

## UI

`(app)/layout.tsx` hydrates the shell. The shell is a client component: sidebar from 768px up, bottom navigation below that. The invoice print route sits outside the shell. Screens, the mobile menu, invoice lines, and journal lines are client components. The page files stay server components so they can prefetch the view.

Colors, type, and spacing are in `src/app/globals.css`. The layout is fluid; there is no separate mobile site.

## Language

The interface is German by default. English is the second language. The cookie `managr-locale` stores `de` or `en`. A missing or unknown value is German. `src/i18n/messages.ts` holds the chrome, and the German catalog is the source of the keys. Domain functions and server actions keep their English sentences, and `tx` translates the known ones when the locale is German. Query keys do not include the locale.

Printed invoices stay German in both languages, including the Kleinunternehmer note. SKR03 account names stay German. Dates and euro amounts stay in `de-DE` format. Stored titles, notes, and checklist rows are not translated when the language changes. The sample company is seeded in German. On startup, known English sample sentences are rewritten only when the company is still marked as the sample and the text still matches.

## Checks

`bun install` installs dependencies from `bun.lock`. `bun run test` runs Vitest. `bun run typecheck` runs the TypeScript compiler. `bun run build` produces the production server. There is no hosted service and no environment secret.
