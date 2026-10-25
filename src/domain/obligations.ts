import { endOfLaterMonth, iso, rollForwardBusinessDay, thirdLastBankingDay } from "./calendar";

export type ObligationWhen = "always" | "vat" | "payroll";
export type ObligationCategory = "tax" | "corporate" | "social" | "trade";

export type StatutoryObligation = {
  key: string;
  title: string;
  category: ObligationCategory;
  dueDate: string;
  detail: string;
  when: ObligationWhen;
};

export type ObligationSettings = {
  fiscalYearStartMonth: number;
  vatPermanentExtension: boolean;
  usesTaxAdvisor: boolean;
};

function monthName(month: number): string {
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month - 1] ?? String(month);
}

function financialYearEnding(calendarYear: number, startMonth: number): { end: string; endYear: number } {
  const endMonth = startMonth === 1 ? 12 : startMonth - 1;
  const endDay = new Date(Date.UTC(calendarYear, endMonth, 0)).getUTCDate();
  return { end: iso(calendarYear, endMonth, endDay), endYear: calendarYear };
}

export function statutoryObligations(dueYear: number, settings: ObligationSettings): StatutoryObligation[] {
  const items: StatutoryObligation[] = [];
  const extension = settings.vatPermanentExtension ? 1 : 0;

  for (let shift = -1; shift <= 12; shift += 1) {
    const index = shift;
    const periodYear = dueYear + Math.floor(index / 12);
    const periodMonth = ((index % 12) + 12) % 12 || 12;
    const adjustedYear = index <= 0 ? dueYear - 1 : periodYear;
    const adjustedMonth = index <= 0 ? 12 + index : periodMonth;
    const dueMonthIndex = adjustedMonth - 1 + 1 + extension;
    const dueYearActual = adjustedYear + Math.floor(dueMonthIndex / 12);
    const dueMonth = (dueMonthIndex % 12) + 1;
    const due = rollForwardBusinessDay(iso(dueYearActual, dueMonth, 10));
    if (parseYear(due) !== dueYear) continue;
    const label = `${monthName(adjustedMonth)} ${adjustedYear}`;
    items.push({
      key: `ustva-${adjustedYear}-${String(adjustedMonth).padStart(2, "0")}`,
      title: `VAT return ${label}`,
      category: "tax",
      dueDate: due,
      detail: settings.vatPermanentExtension
        ? "Umsatzsteuervoranmeldung with Dauerfristverlängerung. The 1/11 special prepayment is not calculated here."
        : "Umsatzsteuervoranmeldung. A state holiday at your Finanzamt can move this one more day.",
      when: "vat",
    });
    items.push({
      key: `lst-${adjustedYear}-${String(adjustedMonth).padStart(2, "0")}`,
      title: `Wage-tax return ${label}`,
      category: "tax",
      dueDate: due,
      detail: "Lohnsteuer-Anmeldung for the month, including flat tax on a minijob if you use it.",
      when: "payroll",
    });
  }

  for (let month = 1; month <= 12; month += 1) {
    items.push({
      key: `sv-${dueYear}-${String(month).padStart(2, "0")}`,
      title: `Social-insurance contributions ${monthName(month)} ${dueYear}`,
      category: "social",
      dueDate: thirdLastBankingDay(dueYear, month),
      detail: "Approximate third-last banking day, ignoring state holidays. The collecting agency's date wins. U1/U2 are not estimated.",
      when: "payroll",
    });
  }

  const quarters = [
    { month: 3, quarter: 1 },
    { month: 6, quarter: 2 },
    { month: 9, quarter: 3 },
    { month: 12, quarter: 4 },
  ];
  for (const quarter of quarters) {
    const due = rollForwardBusinessDay(iso(dueYear, quarter.month, 10));
    const note = "Standard calendar-year advance date. Your last Bescheid controls the amount and can name another date.";
    items.push({
      key: `kst-advance-${dueYear}-q${quarter.quarter}`,
      title: `Corporate-tax advance Q${quarter.quarter} ${dueYear}`,
      category: "tax",
      dueDate: due,
      detail: note,
      when: "always",
    });
    items.push({
      key: `gewst-advance-${dueYear}-q${quarter.quarter}`,
      title: `Trade-tax advance Q${quarter.quarter} ${dueYear}`,
      category: "tax",
      dueDate: due,
      detail: note,
      when: "always",
    });
  }

  for (const endYear of [dueYear - 2, dueYear - 1]) {
    const yearEnd = financialYearEnding(endYear, settings.fiscalYearStartMonth);
    const monthsAfter = settings.usesTaxAdvisor ? 14 : 7;
    const filingDue = rollForwardBusinessDay(endOfLaterMonth(yearEnd.end, monthsAfter));
    if (parseYear(filingDue) === dueYear) {
      const adviser = settings.usesTaxAdvisor ? "Tax-adviser deadline (end of the 14th month)." : "Deadline without a tax adviser (end of the 7th month). A given year is sometimes extended.";
      items.push({
        key: `kst-return-${endYear}`,
        title: `Corporate-tax return FY ${endYear}`,
        category: "tax",
        dueDate: filingDue,
        detail: adviser,
        when: "always",
      });
      items.push({
        key: `gewst-return-${endYear}`,
        title: `Trade-tax return FY ${endYear}`,
        category: "tax",
        dueDate: filingDue,
        detail: adviser,
        when: "always",
      });
      items.push({
        key: `ust-return-${endYear}`,
        title: `VAT annual return FY ${endYear}`,
        category: "tax",
        dueDate: filingDue,
        detail: adviser,
        when: "vat",
      });
    }
    const disclosure = endOfLaterMonth(yearEnd.end, 12);
    if (parseYear(disclosure) === dueYear) {
      items.push({
        key: `disclosure-${endYear}`,
        title: `Disclose FY ${endYear} accounts`,
        category: "corporate",
        dueDate: disclosure,
        detail: "Bundesanzeiger disclosure, end of the 12th month after the financial year. Late filings draw penalty payments.",
        when: "always",
      });
    }
    const draft = endOfLaterMonth(yearEnd.end, 6);
    if (parseYear(draft) === dueYear) {
      items.push({
        key: `accounts-draft-${endYear}`,
        title: `Draft FY ${endYear} accounts`,
        category: "corporate",
        dueDate: draft,
        detail: "Working deadline so the shareholder resolution and disclosure are not rushed. Not itself a statute.",
        when: "always",
      });
    }
    const resolution = endOfLaterMonth(yearEnd.end, 11);
    if (parseYear(resolution) === dueYear) {
      items.push({
        key: `resolution-${endYear}`,
        title: `Adopt FY ${endYear} accounts and reserve`,
        category: "corporate",
        dueDate: resolution,
        detail: "Shareholder resolution on the annual accounts and, while the UG rules apply, the statutory reserve allocation.",
        when: "always",
      });
    }
  }

  items.push({
    key: `bg-lohn-${dueYear - 1}`,
    title: `Accident-insurance wage statement ${dueYear - 1}`,
    category: "social",
    dueDate: rollForwardBusinessDay(iso(dueYear, 2, 16)),
    detail: "Digital Lohnnachweis to the Berufsgenossenschaft for the prior calendar year.",
    when: "payroll",
  });
  items.push({
    key: `ihk-${dueYear}`,
    title: `IHK contribution ${dueYear}`,
    category: "trade",
    dueDate: rollForwardBusinessDay(iso(dueYear, 1, 31)),
    detail: "Read the IHK notice and pay it. Membership is mandatory for most commercial UGs. The notice sets the real date.",
    when: "always",
  });

  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.key.localeCompare(b.key));
}

function parseYear(isoDate: string): number {
  return Number(isoDate.slice(0, 4));
}

export type PolicyReminder = {
  id: number;
  label: string;
  renewalDate: string;
  overdue: boolean;
};

export function policyReminders(
  policies: { id: number; label: string; renewalDate: string | null }[],
  today: string,
  withinDays = 60,
): PolicyReminder[] {
  const horizon = addDaysSafe(today, withinDays);
  return policies.flatMap((policy) => {
    if (!policy.renewalDate || policy.renewalDate > horizon) return [];
    return [{ id: policy.id, label: policy.label, renewalDate: policy.renewalDate, overdue: policy.renewalDate < today }];
  });
}

function addDaysSafe(isoDate: string, days: number): string {
  const { y, m, d } = { y: Number(isoDate.slice(0, 4)), m: Number(isoDate.slice(5, 7)), d: Number(isoDate.slice(8, 10)) };
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
