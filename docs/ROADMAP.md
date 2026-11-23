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
9. Cross-company milestones hold overarching goals with a target date, status, progress, category, and any number of companies. `/milestones` analyses the goals per status, category, company, and quarter, and the MCP server exposes the same view and writes.
10. A managing-director contract records the signing date, fixed gross, and term; a retroactive signature is refused, and salary changes are checked against a resolution dated on or before the change.
11. A shareholder loan records drawdowns, repayments, and interest through the journal. The outstanding principal is shown, over-repayment is refused, and an interest-free loan carries a tax reminder.
12. Founder health cover records private or voluntary statutory cover, the premium, and the Statusfeststellungsverfahren. The premium stays outside payroll, and an open or missing status procedure is called out.
13. A read-only Qonto bank connection per company stores the accounts and transactions from the Qonto API and shows balances, a year of transactions, and filters. The transactions are not posted to the journal.
14. A money-flow page follows one year from invoicing to the tax office: gross revenue split into purchases, net wages, wage tax, social insurance, VAT, corporate tax, solidarity surcharge, trade tax, and profit, plus the VAT chain and actual bank movements. The MCP server exposes it as `read_cashflow`.
15. An org chart draws the reporting lines from the manager on each person, keeps former people out of the tree, and refuses a self-reference or a loop. The People page and `read_org` use the same view.
16. A source register pairs each explanation with the official websites behind it and groups the sources by domain. `/sources`, `read_guides`, and `read_sources` read the same typed data.
17. A tax-return workspace prepares VAT advance, VAT annual, corporate-tax, and trade-tax returns from the journal, freezes a figure snapshot with a hash, runs blocking and warning checks, and records a manual filing with its ticket and protocol. The VAT advance return exports a Mein ELSTER upload file; the annual returns export CSV and JSON. ELSTER/ERiC transmission remains a later phase.
18. A native SwiftUI iPhone client reads the same views at `GET /api/views/[name]` and writes through `POST /api/tools` over the local Wi-Fi. The Mac keeps the database and journal; the phone covers the overview, invoices, payments, customers, time, people, projects, tasks, and deadlines. Build and signing are in `ios/README.md`.

## Founder self-payment — conversation roadmap

This roadmap turns the founder's questions into work items: paying yourself from a UG, health cover, social insurance, hidden profit distributions (vGA), and low-revenue months. It is a planning aid, not legal or tax advice.

### 1. Paying yourself as a shareholder-director

- [x] Payroll posts gross pay, the entered wage tax, and the estimated contributions. Wage tax is never calculated.
- [x] A salary history carries raises over time; the payroll form suggests the figure for the month and books what was confirmed.
- [x] A linked shareholder-director's net pay accrues to the liability to the shareholder (1700); a payout clears it.
- [x] A salary agreement is a shareholder resolution, and the person screen reminds you when it is missing or retroactive.
- [x] An unpaid start is possible: the contract gross can be zero.
- [x] Record the written managing-director service contract, its signing date, fixed gross, and term.
- [x] Check every salary change against a resolution dated on or before the change.
- [x] The appropriateness reminder stays visible; the desk does not decide whether a salary is arm's length.

### 2. A month with less revenue

- [x] The fixed salary stays in the contract. If the company cannot pay, the net pay remains a liability to the shareholder.
- [x] Record a shareholder loan: drawdown, repayment, interest, and the journal postings.
- [x] Warn when a shareholder loan carries no interest, because the tax treatment of an interest-free loan has to be confirmed.
- [x] The payout is separate from the salary expense, so a deferred salary is not booked as a new expense.

### 3. Health insurance and social-insurance status

- [x] A managing director with more than half the shares is treated as not socially insured by default. This is not a Statusfeststellung.
- [x] Health cover is a policy record with a renewal reminder; it is not a payroll deduction.
- [x] Record the founder's cover as private or voluntary statutory, with premium and start date.
- [x] Record the Statusfeststellungsverfahren and its outcome, and remind when it is still open.
- [x] The social-insurance estimate states that health and care cover sit outside payroll.

### 4. Tax, payroll, and bookkeeping

- [x] Monthly payroll posting, wage-tax entry, and the wage-tax and social-insurance obligations.
- [x] Separate books per company, a business-account checklist item, and no private withdrawals through the ledger.
- [x] Invoices in the company's name, VAT handling, the double-entry ledger, and the corporate-tax estimate.
- [x] Statutory reserve under §5a GmbHG, loss offset, and profit distribution from retained profit.
- [x] Obligations for VAT, wage tax, trade tax, corporate tax, disclosure, IHK, and the Berufsgenossenschaft.

### 5. Preventing a hidden profit distribution (vGA)

- [x] The person screen links the shareholder record, salary resolution, and payout.
- [x] A resolution dated after the salary began is called out as retroactive.
- [x] The salary has to be arm's length; the excess can be a vGA and is not a business expense.
- [x] A service contract dated after its start is refused, and a contract gross that differs from the person record is called out.
- [x] Every salary change needs a resolution dated on or before the change.
- [x] The loan records keep their own dates and notes, so the paperwork is traceable.
- [x] The health record keeps its own start date, premium, and status-procedure outcome.

### 6. Reserve and the step to a GmbH

- [x] A quarter of the annual surplus goes to the statutory reserve while share capital is below the GmbH minimum.
- [x] The reserve can offset a loss; this does not increase share capital.
- [x] The gap to €25,000 is shown, and the duty ends only when the increase is registered, not when the reserve balance reaches the minimum.

## Not in version 1

These need an external system or a different product decision. They are not stubbed as if they worked.

- Sign-in and roles.
- ZUGFeRD, and transmission of an e-invoice (Peppol, a portal, or e-mail). The KoSIT validator runs only when the check button or the read-only `check_xrechnung` tool asks for it; no tool submits a file to a customer or authority.
- DATEV EXTF export and a locked DATEV account map.
- Bank CSV import.
- ELSTER/ERiC transmission, certificates, and the local sidecar. The desk prepares, checks, and records a manual filing, but does not send it.
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
