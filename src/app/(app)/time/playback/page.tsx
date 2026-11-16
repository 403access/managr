import { TimePlayback } from "@/components/time-playback";
import { PageHeader } from "@/components/ui";
import { t } from "@/i18n";
import { getLocale, titled } from "@/server/locale";

export function generateMetadata() {
  return titled("meta.timePlayback");
}

export default async function TimePlaybackPage() {
  const locale = await getLocale();
  return (
    <>
      <PageHeader title={t(locale, "time.playbackTitle")} lede={t(locale, "time.playbackLede")} />
      <TimePlayback />
    </>
  );
}