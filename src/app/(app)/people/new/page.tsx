import { todayIso } from "@/domain/calendar";
import { EmployeeForm } from "@/components/employee-form";
import { InfoButton } from "@/components/info-sheet";
import { PageHeader } from "@/components/ui";
import { t } from "@/i18n";
import { getLocale, titled } from "@/server/locale";
import { listOrgMembers, loadShareholders } from "@/server/queries";

export function generateMetadata() {
  return titled("meta.personNew");
}

export default async function NewPersonPage() {
  const locale = await getLocale();
  const holders = loadShareholders().map((holder) => ({ id: holder.id, name: holder.name }));
  const colleagues = listOrgMembers().map((member) => ({ id: member.id, name: `${member.firstName} ${member.lastName}`, role: member.role }));
  return (
    <>
      <PageHeader title={t(locale, "people.newTitle")} lede={t(locale, "people.newLede")} info={<InfoButton topic="person" />} />
      <EmployeeForm today={todayIso()} shareholders={holders} colleagues={colleagues} />
    </>
  );
}