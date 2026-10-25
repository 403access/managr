import { todayIso } from "@/domain/calendar";
import { EmployeeForm } from "@/components/employee-form";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "New person" };

export default function NewPersonPage() {
  return (
    <>
      <PageHeader title="New person" lede="Health cover for a controlling director is a policy on the company page, not a payroll line." />
      <EmployeeForm today={todayIso()} />
    </>
  );
}
