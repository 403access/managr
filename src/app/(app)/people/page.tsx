import Link from "next/link";
import { listPeople } from "@/server/queries";
import { formatEuro } from "@/domain/money";
import { vacationShortfall } from "@/domain/time";
import { LinkButton, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "People" };

export default function PeoplePage() {
  const people = listPeople();
  return (
    <>
      <PageHeader title="People" lede="Employment, 2026 contribution estimates, and vacation. Wage tax is entered when you post payroll." action={<LinkButton href="/people/new">Add person</LinkButton>} />
      <div className="grid gap-2">
        {people.map(({ employee, estimate, estimateError }) => {
          const shortfall = vacationShortfall(employee.vacationDays, employee.workdaysPerWeek);
          return (
            <Link key={employee.id} href={`/people/${employee.id}`} className="grid min-h-11 gap-2 rounded-2xl border border-line bg-card px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <span>
                <span className="block font-medium">{employee.firstName} {employee.lastName}</span>
                <span className="text-sm text-muted">{employee.role || employee.kind}{employee.endDate ? ` · until ${employee.endDate}` : ""}</span>
                {shortfall ? <span className="mt-1 block text-xs text-amber">{shortfall}</span> : null}
                {estimateError ? <span className="mt-1 block text-xs text-clay">{estimateError}</span> : null}
              </span>
              <span className="font-mono text-sm">{formatEuro(employee.grossMonthlyCents)}</span>
              {estimate ? <Pill tone={estimate.regime}>{estimate.regime}</Pill> : null}
            </Link>
          );
        })}
      </div>
    </>
  );
}
