---
name: managr-engineering
description: >
  Engineering rules for the managr UG desk (Next.js, TypeScript, SQLite, Drizzle).
  Use when changing this repo: features, bugfixes, refactors, tests, or docs.
  Triggers: managr, UG, ledger, invoice, payroll, reserve, roadmap, /managr-engineering.
---

# managr engineering

Read `docs/ARCHITECTURE.md` before changing structure. Read `docs/DOMAIN.md` before changing company-law, tax, invoice, payroll, reserve, or deadline behavior. The roadmap lives in `docs/ROADMAP.md`. Update the doc that owns the behavior in the same change.

## Product

managr is a local planning desk for one German UG (haftungsbeschränkt). It keeps Stammdaten, obligations, invoices, a double-entry ledger, people, time, documents, and legal records.

It is not a tax adviser, payroll office, or filing portal. Estimates must say so in the UI. Do not add ELSTER submission, wage-tax calculation, DATEV export, bank feeds, or e-invoice XML unless the roadmap says that version includes them.

## Rules

1. KISS. Prefer a plain function and a server action over a new abstraction. One code path for each business rule.
2. DRY. Rates, account codes, and legal thresholds have one home:
   - figures: `src/domain/rates-2026.ts`
   - chart of accounts: `src/domain/accounts.ts`
   - rule prose: `docs/DOMAIN.md`
   Do not copy a figure into a second module. Docs name the constant.
3. Money is integer euro cents. Rates that are not a municipal Hebesatz are basis points (1900 = 19%). Hebesatz is an integer percent (410 = 410%). No floats in persisted money.
4. Domain rules are pure functions under `src/domain/` with Vitest tests. Change the function and its tests together. Do not hide a rule only in a React component.
5. Ledger entries balance (debits equal credits) and are append-only. Corrections are reversing entries.
6. Validate on the server with the same domain functions the form uses. Reject unbalanced journals, VAT on a Kleinunternehmer invoice, and payroll posted twice for the same person and month.
7. Every screen works at 375px width and on a desktop sidebar. Touch targets are at least 44px. Do not hide the only path to an action behind hover.
8. Keep the sample company obviously fake. Do not invent a filing, a wage-tax amount, or a social-insurance status as if it were a decision.
9. Comments explain a legal or accounting constraint that the code itself cannot say. Do not narrate the change.
10. Before finishing, run `npm test` and `npm run typecheck`. For UI changes, exercise the affected flow on a narrow and a wide viewport.

## Checks

- `npm test`
- `npm run typecheck`
- `npm run build` when the change touches routing, the database, or server actions
