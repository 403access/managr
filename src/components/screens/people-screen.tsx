"use client";

import Link from "next/link";
import type { peopleView } from "@/server/views";
import { formatEuro } from "@/domain/money";
import { queryKeys, viewPath } from "@/client/query-keys";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { LinkButton, PageHeader, Pill } from "@/components/ui";

type People = ReturnType<typeof peopleView>;

export function PeopleScreen() {
  const query = useView<People>(queryKeys.people, viewPath.people);
  const { t, tx, label } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader title={t("people.title")} lede={t("people.lede")} action={<LinkButton href="/people/new">{t("people.add")}</LinkButton>} />
          <div className="grid gap-2">
            {data.people.map((person) => (
              <Link key={person.id} href={`/people/${person.id}`} className="grid min-h-11 gap-2 rounded-2xl border border-line bg-card px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <span>
                  <span className="block font-medium">
                    {person.firstName} {person.lastName}
                  </span>
                  <span className="text-sm text-muted">
                    {person.role || label(person.kind)}
                    {person.endDate ? ` · ${t("people.until", { date: person.endDate })}` : ""}
                  </span>
                  {person.shortfall ? <span className="mt-1 block text-xs text-amber">{tx(person.shortfall)}</span> : null}
                  {person.estimateError ? <span className="mt-1 block text-xs text-clay">{tx(person.estimateError)}</span> : null}
                </span>
                <span className="font-mono text-sm">{formatEuro(person.grossMonthlyCents)}</span>
                {person.regime ? <Pill tone={person.regime}>{label(person.regime)}</Pill> : null}
              </Link>
            ))}
          </div>
        </>
      )}
    </ViewGate>
  );
}
