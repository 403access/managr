import { LinkButton } from "@/components/ui";
import { t } from "@/i18n";
import { getLocale } from "@/server/locale";

export default async function NotFound() {
  const locale = await getLocale();
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl">{t(locale, "error.missingTitle")}</h1>
      <p className="mt-3 text-sm text-muted">{t(locale, "error.missingBody")}</p>
      <div className="mt-6">
        <LinkButton href="/">{t(locale, "error.missingAction")}</LinkButton>
      </div>
    </main>
  );
}
