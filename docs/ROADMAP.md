# Roadmap

managr is a local desk for running a German UG (haftungsbeschränkt): company records, obligations, invoices, books, people, social-insurance estimates, time, documents, and legal paperwork.

Engineering rules: `.grok/skills/managr-engineering/SKILL.md`.

## Version 1 — the desk

Shipped in this repo. One user, one company, SQLite on disk, no account system.

- Company master data, shareholders, and the statutory reserve (§5a GmbHG), including the conversion gap toward €25,000 share capital.
- Obligation calendar: VAT, wage tax, trade tax, corporate tax, social-insurance reminders, disclosure, IHK, Berufsgenossenschaft, plus custom deadlines.
- Customers, invoices with the statutory particulars, issue, payment, void, and a printable invoice.
- Double-entry ledger on a SKR03 working chart, trial balance, profit before tax, and corporate-tax estimate.
- People: employment, minijob / midijob / regular contribution estimates for 2026, vacation, and a payroll journal posting. Wage tax is entered, not calculated.
- Founder health cover and business policies, with renewal reminders.
- Time records and tasks, with working-time warnings.
- Documents stored on disk.
- Legal checklist and shareholder resolutions.
- Sample UG so the desk is usable on first launch.
- Domain tests for the rules above.
- Layout that works on a phone and on a desktop.
- German interface by default, with English as a second language. Printed invoices stay German.

## Not in version 1

These need an external system or a different product decision. They are not stubbed as if they worked.

- Sign-in, roles, and multi-company books.
- XRechnung or ZUGFeRD.
- DATEV EXTF export and a locked DATEV account map.
- Bank CSV or a bank feed.
- ELSTER transmission.
- Lohnsteuer from ELStAM, church tax, and factor rules.
- DEÜV filings, Beitragsnachweise, and U1/U2 fund rates (those rates are set by the collecting agency).
- Emailing invoices.
- OCR on receipts.

## Later, in this order

1. Bank CSV import that posts through the same journal rules.
2. DATEV export once the chart is confirmed against the office's Kontenrahmen.
3. XRechnung from the invoice model that already exists.
4. A real Lohnsteuer function, or an explicit import of payroll results from a Lohnprogramm.
5. Sign-in, only when the file is no longer a single local database.

## Done

A version is done when the domain tests pass, `bun run typecheck` and `bun run build` pass, the changed screens work at phone and desktop width, and the doc that owns the behavior was updated with the code.
