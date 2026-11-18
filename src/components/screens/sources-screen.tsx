"use client";

import Link from "next/link";
import {
  guides,
  guidesUsingSource,
  pick,
  sourceGroups,
  sources,
  type Source,
} from "@/content/sources";
import { useI18n } from "@/components/locale-provider";
import { Card, PageHeader, Stat } from "@/components/ui";

function slug(domain: string): string {
  return domain.replace(/[^a-z0-9]+/gi, "-");
}

function SourceEntry({ source }: { source: Source }) {
  const { t, locale } = useI18n();
  const topics = guidesUsingSource(source.id);
  return (
    <article id={`source-${source.id}`} className="scroll-mt-6 rounded-2xl border border-line bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-pine underline-offset-4 hover:underline"
          >
            {pick(source.title, locale)} ↗
          </a>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {pick(source.publisher, locale)} · {pick(source.kind, locale)}
          </p>
        </div>
        <span className="rounded-full bg-pine/10 px-2.5 py-1 font-mono text-xs text-pine">{source.domain}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{pick(source.note, locale)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">{t("sources.usedBy")}</span>
        {topics.map((topic) => (
          <Link key={topic.id} href={topic.href} className="rounded-full border border-line bg-card px-2.5 py-1 text-xs text-ink hover:border-ink">
            {pick(topic.title, locale)}
          </Link>
        ))}
      </div>
    </article>
  );
}

export function SourcesScreen() {
  const { t, locale } = useI18n();
  const groups = sourceGroups(locale);
  return (
    <>
      <PageHeader title={t("sources.title")} lede={t("sources.lede")} />

      <div className="grid grid-cols-3 gap-3">
        <Stat label={t("sources.sources")} value={String(sources.length)} />
        <Stat label={t("sources.domains")} value={String(groups.length)} />
        <Stat label={t("sources.topics")} value={String(guides.length)} />
      </div>

      <Card className="mt-4">
        <h2 className="text-lg">{t("sources.index")}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{t("sources.indexHint")}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {groups.map((group) => (
            <li key={group.domain}>
              <a
                href={`#domain-${slug(group.domain)}`}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-white px-3 font-mono text-xs text-ink hover:border-ink"
              >
                {group.domain}
                <span className="rounded-full bg-ink/10 px-1.5 py-0.5 text-[10px] text-muted">{group.sources.length}</span>
              </a>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-4 grid gap-4">
        {groups.map((group) => (
          <section key={group.domain} id={`domain-${slug(group.domain)}`} className="scroll-mt-6">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-mono text-lg text-ink">{group.domain}</h2>
              <span className="text-xs text-muted">{t("sources.domainCount", { count: group.sources.length })}</span>
            </div>
            <div className="grid gap-2">
              {group.sources.map((source) => (
                <SourceEntry key={source.id} source={source} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted">{t("sources.note")}</p>
    </>
  );
}
