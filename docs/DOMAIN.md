---
slug: /domain
---

# Domain rules

managr is a planning aid. It does not file, assess social-insurance status, or compute wage tax. The UI must keep that visible wherever it shows an estimate.

If a sentence here disagrees with code, the TypeScript module named below wins, and this file is updated in the same change. Figures live only in `src/domain/rates-2026.ts`. Account numbers live only in `src/domain/accounts.ts`.

## Company law

An Unternehmergesellschaft (haftungsbeschränkt) uses that phrase, or the short form UG (haftungsbeschränkt), in its name. Invoice review rejects a UG legal name that contains neither. Other legal forms are stored as a code (`ug`, `gmbh`, `ag`, `kg`, `ohg`, `gbr`, `einzelunternehmen`, `ek`, `partg`) and the name check follows the form. Each company has its own complete set of books. Implementation: `src/domain/company.ts` and `src/domain/invoice.ts`.

Share capital may sit below the GmbH minimum (`GMBH_MINIMUM_CAPITAL_CENTS`). The 25% reserve duty in §5a Abs. 3 GmbHG:

- Base is the Jahresüberschuss minus a Verlustvortrag from the prior year. A negative base yields no allocation.
- The allocation is one quarter of that base (`RESERVE_NUMERATOR` / `RESERVE_DENOMINATOR`), rounded half up to the cent.
- The duty stays while share capital is below the GmbH minimum. It does not stop when the reserve balance itself reaches that minimum.
- The reserve may be used to offset a loss, or later converted into share capital. Only a capital increase that reaches the GmbH minimum, once registered, ends the UG rules. Recording share capital in the app is not that registration.

Implementation: `src/domain/reserve.ts`.

## VAT and the small-business exemption

Standard and reduced rates: `STANDARD_VAT_BPS`, `REDUCED_VAT_BPS`. VAT is computed once per rate on the sum of net amounts, then rounded half up to the cent. Implementation: `src/domain/vat.ts`.

§19 UStG, as in force since 2025, implemented in `src/domain/tax.ts`:

- Prior calendar year turnover may not exceed `KLEIN_PRIOR_CENTS`.
- The current calendar year may not exceed `KLEIN_CURRENT_CENTS`. Crossing it ends the exemption on that supply.
- In the founding year the current-year ceiling used here is `KLEIN_FOUNDING_CENTS` (Finanzverwaltung practice).
- A Kleinunternehmer invoice shows no VAT rate and no VAT amount. It carries `KLEINUNTERNEHMER_NOTE` from `src/domain/invoice.ts`. Showing VAT can create a tax debt under §14c UStG, so issue is blocked.
- Ledger revenue is only a proxy. §19 uses vereinnahmte Entgelte, and the prior-year figure is a field the user maintains. The check warns. It does not block issue on that proxy.
- Profit of the UG, including profit on those invoices, stays in the company. `estimateCorporateTax` is the planning figure for Körperschaftsteuer, Solidaritätszuschlag, and Gewerbesteuer. That profit is not income on the shareholder's Einkommensteuer return (Anlage G or Anlage S).

The ceilings are the figures in force since 2025. The earlier prior-year ceiling of 22.000 Euro is not used. Waiving the exemption is a decision to confirm with a tax adviser. The app does not guess the binding period.

## Invoices and business letters

Issue is blocked until the draft has the particulars needed for §14 UStG: both addresses, tax number or VAT id, dates, and at least one described line. For a corporation (UG, GmbH, AG), the business-letter particulars of §35a GmbHG are also required: register court, register number, and the managing director. An Einzelunternehmen or a partnership does not need those three fields. The app assigns a gap-free number `prefix + year + sequence` when the invoice is issued; the sequence is per company. Voiding posts a reversing journal entry and does not reuse the number.

An invoice states its amounts as net prices with VAT added, or as gross prices with VAT included. The choice is stored per invoice in `invoices.amount_display` and changes the presentation only: the ledger and the e-invoice keep net amounts and VAT separate, and the tax amount stays on the document in either form. In the gross form the line amounts are the rate VAT from `summarizeVat` split across that rate's lines by largest remainder (`allocateLineVat`), so the column adds up to the invoice total cent for cent. A Kleinunternehmer invoice has no VAT and shows one amount. The company's **Tax profile** switch controls that treatment; the invoice form links to it.

The invoice form renders the same document component as the print page (`src/components/invoice-document.tsx`) as a live preview. Saving a draft or issuing an invoice opens that preview again and requires confirmation, so no invoice is created unseen.

## E-Rechnung (XRechnung)

The e-invoice this desk writes is an XRechnung 3.0.2 file in UBL syntax. That is an EN 16931 invoice and therefore an e-invoice under §14 UStG. The specification is at <https://xeinkauf.de/xrechnung/>. The file is rendered on download. It is not stored and not sent. The invoice screen can check the rendered file with the KoSIT validator running on this computer; the check result is not stored. ZUGFeRD is not produced. A void invoice stays a reversing journal entry; the desk does not write a credit note.

Implementation: `src/domain/xrechnung.ts`. Specification identifiers: `XRECHNUNG_CUSTOMIZATION_ID`, `XRECHNUNG_PROFILE_ID`. Quantity uses `XRECHNUNG_UNIT_CODE` (UNECE Rec 20 code C62, "one"). The invoice has no unit of measure.

Issue still follows §14 and §35a only. The extra XRechnung fields do not block issue. They block the file.

- The buyer reference (BT-10) is stored on the invoice. For a public authority it is the Leitweg-ID. The desk does not check that checksum.
- Seller and buyer electronic addresses are the e-mail addresses, scheme EM (BT-34, BT-49).
- The seller contact is the managing director, the company phone, and the company e-mail.
- Payment is a SEPA credit transfer (code 58) with a checksum-valid IBAN. A BIC is included only when it is present and well formed.
- 19% and 7% are VAT category S. A category S file needs the seller VAT id. A German address needs a DE id of nine digits. The desk does not check the VAT id checksum.
- 0% is category E and needs an exemption sentence (BT-120). A Kleinunternehmer invoice uses `KLEINUNTERNEHMER_NOTE`.
- VAT amounts are the same cents as `summarizeVat`. A prepaid amount reduces the payable amount (BT-115). A fully paid invoice stays an invoice with a payable amount of zero.
- The register court, HRB number, and managing director are written into BT-33 for a corporation. The HRB number is also BT-30. For other legal forms the legal form and the owner are written instead.
- Country names the desk knows, and ISO alpha-2 codes, become the country code. An unknown country blocks the file.

## Books

The ledger is double-entry and append-only. Every posting is built in `src/domain/postings.ts` and refused if it does not balance.

The chart is a SKR03 working chart for a service UG, not a certified DATEV export. Well-known accounts (bank 1200, receivables 1400, VAT 1776 / 1771, input VAT 1576 / 1571, shareholders payable 1700, wages payable 1740, revenue 8400 / 8300 / 8192) follow common SKR03 usage. Profit before tax ignores accounts marked `pnl: "tax"` so a booked tax payment is not treated as an operating expense and then taxed again.

Corporate, solidarity, and trade tax are a planning estimate in `estimateCorporateTax`:

- Taxable base is profit before tax minus a stored loss carryforward, floored at zero.
- A UG has no Gewerbesteuer Freibetrag.
- Gewerbesteuer is not deducted again inside the Körperschaftsteuer base in this estimate.
- The Hebesatz is the company's municipal rate, not a federal constant.

## People, social insurance, health

2026 ceilings, rates, the minijob limit, and Faktor F are the constants in `src/domain/rates-2026.ts`. The minijob limit is derived from the minimum wage (wage × 130 / 3, rounded up to a whole euro). Faktor F is the published four-decimal factor, checked against 28% / the average total rate.

`src/domain/social.ts`:

- A managing director with more than half the shares is treated as not socially insured when status is "automatic". That is a default, not a Statusfeststellung.
- Apprentices use the normal formula at any pay.
- Otherwise the pay band selects minijob, Übergangsbereich, or regular.
- Midijob uses the two assessment bases in §20 Abs. 2a SGB IV. The employer pays the remainder of the full contribution. The childless long-term-care surcharge stays on the employee, on the full midijob base. Child-discount steps reduce the employee only.
- Saxony uses the unequal long-term-care split.
- The insolvency levy is estimated for regular and midijob pay. U1/U2 are not estimated.
- Minijob employer flats: pension, health only when the person is in statutory health insurance, and the 2% flat tax when it is switched on. Employee pension is  the published flat unless they opt out.
- Lohnsteuer is never calculated. A payroll posting asks for it.
- `payrollAmounts` turns the estimate into posting figures. Employee social insurance is withheld. Employer social insurance excludes the minijob flat tax, which is posted on its own. A minijob posting ignores a typed wage-tax amount. A socially exempt salary can still carry wage tax, because wage-tax withholding is separate from social insurance.

`payslip` turns the estimate and the entered wage tax into the payslip view: gross, each employee and employer contribution, the wage tax, net pay, and the employer cost. Until wage tax is entered the person screen shows that row as open, because Lohnsteuer is never calculated. The payroll form renders the same table with the typed amount, and the net equals the posted net.

A salary can change over time. `salary_periods` holds one row per change: the date it applies from and the monthly gross. `salaryForMonth` returns the latest change not after the payroll month, or the contract gross in `employees.gross_monthly_cents` when there is none. A change dated inside a month applies to that whole month. The person screen shows the history and the next change; the payroll form suggests the figure for the chosen month, and a one-off payment, a bonus, or a partial month is typed as the gross on the posting itself. The posting books what was confirmed, not what the schedule suggested.

Health insurance for a controlling shareholder-director is a policy record (private or voluntary statutory), not a payroll deduction. Renewal dates surface as reminders.

## Shareholder-director salary

A managing director who also holds shares is paid through payroll, but the money moves differently. When the person is linked to a shareholder record (`employees.shareholder_id`), the payroll credits the net pay to `ACCOUNTS.shareholdersPayable` (1700) instead of bank or wages payable. `buildShareholderPayout` then clears that liability against the bank. The payout is not the salary: the salary is already booked as an expense.

`reviewDirectorSalary` is a reminder list, not an assessment:

- The salary has to be agreed in advance by shareholder resolution. A resolution dated after the salary began is treated as a retroactive agreement, which can be a hidden profit distribution.
- The salary has to be arm's length (Angemessenheit). The excess over what an unrelated managing director would get can be a verdeckte Gewinnausschüttung, and that excess is not a business expense.
- A director with shares should be linked to the shareholder record, so salary, payout, and resolution stay together.

A resolution of kind `salary` that names the person (`resolutions.employee_id`) satisfies the paperwork reminder. managr does not decide whether the resolution is valid or whether the amount is appropriate, and it does not block a posting.

A profit distribution is separate: `buildProfitDistribution` debits retained profit (0860) and credits the bank. It needs a shareholder resolution and adopted annual accounts, and it is not a salary and not an operating expense. The desk records the confirmation, not the legal effect.

## Obligations

`src/domain/obligations.ts` builds statutory dates. Weekend and nationwide holiday shifts use §108 AO. It does not know every state holiday, and the screen says so. Advance-tax dates are the standard calendar-year dates; the Bescheid wins. Annual return deadlines are the end of the 7th month after the financial year, or the 14th month when a tax adviser is flagged. Disclosure is the end of the 12th month after the financial year.

## Time

Working-time warnings follow §3 and §4 ArbZG (8 hours, 10-hour cap, 30- and 45-minute breaks). Vacation minimum scales 24 weekdays by the working week (BUrlG). The weekday pattern is "the first N days of the week", which is an assumption the person screen states.

## Documents and legal records

Documents are files plus a category. Resolutions and the compliance checklist are records, not generated legal documents.
