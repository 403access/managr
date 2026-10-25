# Architecture

managr is a Next.js App Router application. The browser talks to React Server Components and server actions. SQLite is opened on the server only.

```
src/domain        pure rules, no database, no React
src/db            Drizzle schema, SQL migration, connection, sample seed
src/server        queries and server actions
src/app           routes
src/components    layout and forms
data/managr.db    created on first launch (gitignored)
data/uploads      document files (gitignored)
```

## Boundaries

- A rule that can be wrong in euros, dates, or legal effect lives in `src/domain` and has a test in `tests/`.
- React does not reimplement VAT, reserve, social insurance, or deadlines. It renders what the domain returns.
- Only `src/db/client.ts` opens the database. Server actions call `getDb()`.
- Journal lines are inserted by `src/server/posting.ts`, which refuses anything `journalImbalance` rejects.
- Client components receive plain objects. They do not import `src/db` or `src/server`.

## Money and time

Persisted money is integer cents. A euro input is parsed by `parseEuroToCents` (German and plain decimal forms). Dates are `YYYY-MM-DD` strings. Date arithmetic uses UTC so a timezone cannot shift the calendar day.

## Database

`src/db/migrations/0001_init.sql` is the schema applied at startup. `src/db/schema.ts` is the Drizzle map of that SQL. Change both together.

The first launch of an empty database loads the sample company Atelier Nordlicht UG. Deleting `data/managr.db` restores it. User data lives only in that file and in `data/uploads`.

## Request flow

Pages read through `src/server/queries.ts`. Mutations are server actions in `src/server/actions.ts`. After a write they call `revalidatePath`. Issued invoices, payments, expenses, payroll, reserve movements, and voids all go through a posting builder in `src/domain/postings.ts`.

`src/server/payloads.ts` validates the invoice and manual-journal JSON. `src/server/people.ts` maps a person onto the social-insurance estimate. `src/server/files.ts` writes uploads under `data/uploads` and refuses a stored name that leaves that directory. `src/server/invoice-math.ts` is the only place that turns stored invoice lines into net, VAT, and open amounts.

## UI

`(app)/layout.tsx` renders the shell: sidebar from 768px up, bottom navigation below that. The invoice print route sits outside the shell. Interactive pieces (mobile menu, invoice lines, journal lines) are client components. Everything else is a server component.

Colors, type, and spacing are in `src/app/globals.css`. The layout is fluid; there is no separate mobile site.

## Checks

`npm test` runs Vitest. `npm run typecheck` runs the TypeScript compiler. `npm run build` produces the production server. There is no hosted service and no environment secret.
