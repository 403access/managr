"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  filterSourceGroups,
  guides,
  guidesUsingSource,
  pick,
  sourceGroups,
  sources,
  type GuideId,
  type Source,
} from "@/content/sources";
import { useI18n } from "@/components/locale-provider";
import { Card, Empty, Field, PageHeader, SelectInput, Stat, TextInput } from "@/components/ui";

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

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium ${
        active ? "border-pine bg-pine text-paper" : "border-line bg-white text-ink hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function SourcesScreen() {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");
  const [topic, setTopic] = useState<GuideId | "">("");
  const groups = useMemo(() => sourceGroups(locale), [locale]);
  const filtered = useMemo(() => filterSourceGroups(locale, { query, domain, topic }), [domain, locale, query, topic]);
  const shown = filtered.reduce((sum, group) => sum + group.sources.length, 0);
  const active = Boolean(query.trim() || domain || topic);

  function reset() {
    setQuery("");
    setDomain("");
    setTopic("");
  }

  return (
    <>
      <PageHeader title={t("sources.title")} lede={t("sources.lede")} />

      <div className="grid grid-cols-3 gap-3">
        <Stat label={t("sources.sources")} value={String(sources.length)} />
        <Stat label={t("sources.domains")} value={String(groups.length)} />
        <Stat label={t("sources.topics")} value={String(guides.length)} />
      </div>

      <Card className="mt-4">
        <div role="group" aria-label={t("sources.filterLabel")} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
          <Field label={t("sources.filterSearch")}>
            <TextInput
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("sources.filterSearchPlaceholder")}
            />
          </Field>
          <Field label={t("sources.filterDomain")}>
            <SelectInput value={domain} onChange={(event) => setDomain(event.target.value)}>
              <option value="">{t("sources.filterAll")}</option>
              {groups.map((group) => (
                <option key={group.domain} value={group.domain}>
                  {group.domain}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <div className="mt-3">
          <p className="text-sm font-medium">{t("sources.filterTopic")}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            <li>
              <FilterChip active={!topic} onClick={() => setTopic("")}>{t("sources.filterAll")}</FilterChip>
            </li>
            {guides.map((guide) => (
              <li key={guide.id}>
                <FilterChip active={topic === guide.id} onClick={() => setTopic(topic === guide.id ? "" : guide.id)}>
                  {pick(guide.title, locale)}
                </FilterChip>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted" aria-live="polite">
            {t("sources.filterResult", { shown, total: sources.length })}
          </p>
          {active ? (
            <button type="button" onClick={reset} className="text-sm font-medium text-pine underline-offset-4 hover:underline">
              {t("sources.filterReset")}
            </button>
          ) : null}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <div className="mt-4">
          <Empty>{t("sources.filterEmpty")}</Empty>
        </div>
      ) : (
        <>
          <Card className="mt-4">
            <h2 className="text-lg">{t("sources.index")}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t("sources.indexHint")}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {filtered.map((group) => (
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
            {filtered.map((group) => (
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
        </>
      )}

      <p className="mt-6 text-xs leading-relaxed text-muted">{t("sources.note")}</p>
    </>
  );
}
