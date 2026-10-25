# Domain rules

managr is a planning aid. It does not file, assess social-insurance status, or compute wage tax. The UI must keep that visible wherever it shows an estimate.

If a sentence here disagrees with code, the TypeScript module named below wins, and this file is updated in the same change. Figures live only in `src/domain/rates-2026.ts`. Account numbers live only in `src/domain/accounts.ts`.

## Company law

An Unternehmergesellschaft (haftungsbeschränkt) uses that phrase, or the short form UG (haftungsbeschränkt), in its name. Invoice review rejects a legal name that contains neither. Implementation: `src/domain/invoice.ts`.

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
- A Kleinunternehmer invoice has no VAT and carries a §19 sentence. Showing VAT can create a tax debt under §14c UStG, so issue is blocked.
- Ledger revenue is only a proxy for Gesamtumsatz. The prior-year figure is a field the user maintains.

Waiving the exemption is a decision to confirm with a tax adviser. The app does not guess the binding period.

## Invoices and business letters

Issue is blocked until the draft has the particulars needed for §14 UStG and the business-letter particulars of §35a GmbHG: both addresses, tax number or VAT id, dates, at least one described line, register court, register number, and the managing director. The app assigns a gap-free number `prefix + year + sequence` when the invoice is issued. Voiding posts a reversing journal entry and does not reuse the number.

## Books

The ledger is double-entry and append-only. Every posting is built in `src/domain/postings.ts` and refused if it does not balance.

The chart is a SKR03 working chart for a service UG, not a certified DATEV export. Well-known accounts (bank 1200, receivables 1400, VAT 1776 / 1771, input VAT 1576 / 1571, revenue 8400 / 8300 / 8192) follow common SKR03 usage. Profit before tax ignores accounts marked `pnl: "tax"` so a booked tax payment is not treated as an operating expense and then taxed again.

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

Health insurance for a controlling shareholder-director is a policy record (private or voluntary statutory), not a payroll deduction. Renewal dates surface as reminders.

## Obligations

`src/domain/obligations.ts` builds statutory dates. Weekend and nationwide holiday shifts use §108 AO. It does not know every state holiday, and the screen says so. Advance-tax dates are the standard calendar-year dates; the Bescheid wins. Annual return deadlines are the end of the 7th month after the financial year, or the 14th month when a tax adviser is flagged. Disclosure is the end of the 12th month after the financial year.

## Time

Working-time warnings follow §3 and §4 ArbZG (8 hours, 10-hour cap, 30- and 45-minute breaks). Vacation minimum scales 24 weekdays by the working week (BUrlG). The weekday pattern is "the first N days of the week", which is an assumption the person screen states.

## Documents and legal records

Documents are files plus a category. Resolutions and the compliance checklist are records, not generated legal documents.
