---
slug: /roadmap
---

# Roadmap

managr is a local desk for running a German UG (haftungsbeschränkt): company records, obligations, invoices, books, people, social-insurance estimates, time, documents, and legal paperwork.

Engineering rules: `.grok/skills/managr-engineering/SKILL.md`.

## Version 1 — the desk

Shipped in this repo. One user, several companies with separate books, SQLite on disk, no account system.

- Company master data for UG, GmbH, AG, OHG, KG, GbR, PartG, e.K., and Einzelunternehmen, with a company switcher and separate books per company.
- Obligation calendar: VAT, wage tax, trade tax, corporate tax, social-insurance reminders, disclosure, IHK, Berufsgenossenschaft, plus custom deadlines.
- Customers, invoices with the statutory particulars, issue, payment, void, and a printable invoice.
- XRechnung 3.0.2 (UBL) download for an issued invoice. The file is an e-invoice under §14 UStG. It is not transmitted.
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

## After version 1

Shipped after the first version, in this order:

1. Invoices state their amounts as net prices with VAT added or gross prices with VAT included, chosen per invoice.
2. A payslip view on the person screen and in the payroll form shows every line: gross, each contribution per side, the entered wage tax, net pay, and employer cost.
3. A salary history carries raises over time; the payroll form suggests the figure for the chosen month and still books the confirmed amount.
4. A shareholder-director's salary accrues to a liability to the shareholder, the payout clears it, and a separate profit distribution uses retained profit. Salary agreements are shareholder resolutions, with reminders for the resolution and the appropriateness check.
5. An assistant panel and an MCP server expose the same tools the screens use, so a request can read and post across invoices, books, people, time, and deadlines. Nothing is sent, and a cloud model receives the conversation only if it was configured.
6. Projects tie customers, tasks, deliverables, and time together. The analysis shows time per project, project starts and completions, the productive/unproductive task split, and the people and customers behind the work. A customer report prints from the same figures and is saved as a PDF through the browser print dialog.
7. The assistant reads providers, models, and credentials from the local opencode installation. Two searchable fields choose the provider and model; the environment variables remain the fallback when opencode is not installed.
8. The assistant searches the public web and reads a page when a fact is not in the desk, names the source URL, and treats page text as untrusted data. Web access can be switched off for the assistant and MCP.

## Not in version 1

These need an external system or a different product decision. They are not stubbed as if they worked.

- Sign-in and roles.
- ZUGFeRD, and transmission of an e-invoice (Peppol, a portal, or e-mail). The KoSIT validator is not run.
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
3. A real Lohnsteuer function, or an explicit import of payroll results from a Lohnprogramm.
4. Sign-in, only when the file is no longer a single local database.

## Done

A version is done when the domain tests pass, `bun run typecheck` and `bun run build` pass, the changed screens work at phone and desktop width, and the doc that owns the behavior was updated with the code.
