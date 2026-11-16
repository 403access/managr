import { todayIso } from "@/domain/calendar";
import { EmployeeForm } from "@/components/employee-form";
import { PageHeader } from "@/components/ui";
import { t } from "@/i18n";
import { getLocale, titled } from "@/server/locale";
import { loadShareholders } from "@/server/queries";

export function generateMetadata() {
  return titled("meta.personNew");
}

export default async function NewPersonPage() {
  const locale = await getLocale();
  const holders = loadShareholders().map((holder) => ({ id: holder.id, name: holder.name }));
  return (
    <>
      <PageHeader title={t(locale, "people.newTitle")} lede={t(locale, "people.newLede")} />
      <EmployeeForm today={todayIso()} shareholders={holders} />
    </>
  );
}