export type SalaryPeriod = { validFrom: string; grossMonthlyCents: number };

/** The payroll month is YYYY-MM. A change dated inside a month applies to that whole month. */
export function isPayrollMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

export function salaryForMonth(periods: SalaryPeriod[], contractGrossCents: number, month: string): number {
  if (!isPayrollMonth(month)) throw new Error("The payroll month is not YYYY-MM.");
  const target = month;
  const applicable = periods
    .filter((period) => period.validFrom.slice(0, 7) <= target)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  const latest = applicable.at(-1);
  return latest ? latest.grossMonthlyCents : contractGrossCents;
}

/** The earliest change after the given month, or null. A raise is entered ahead of its month. */
export function nextSalaryChange(periods: SalaryPeriod[], month: string): SalaryPeriod | null {
  if (!isPayrollMonth(month)) throw new Error("The payroll month is not YYYY-MM.");
  const later = periods
    .filter((period) => period.validFrom.slice(0, 7) > month)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom));
  return later[0] ?? null;
}