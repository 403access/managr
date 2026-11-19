"use client";

import Link from "next/link";
import { formatDate } from "@/domain/calendar";
import type { OrgNode } from "@/domain/org";
import type { peoplePageView } from "@/server/views";
import { formatEuro } from "@/domain/money";
import { queryKeys, viewPath } from "@/client/query-keys";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { AddLink } from "@/components/add-sheet";
import { Card, Empty, PageHeader, Pill, Stat } from "@/components/ui";

type People = ReturnType<typeof peoplePageView>;

function Branch({ node }: { node: OrgNode }) {
  const { t, label } = useI18n();
  return (
    <li className="flex flex-col items-center">
      <Link
        href={`/people/${node.id}`}
        className="block w-40 rounded-2xl border border-line bg-card px-3 py-2 text-center transition hover:border-pine sm:w-44"
        title={t("org.open")}
      >
        <span className="block truncate font-medium">
          {node.firstName} {node.lastName}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted">{node.role || label(node.kind)}</span>
        {node.children.length > 0 ? (
          <span className="mt-1 block text-[11px] text-pine">{t("org.direct", { count: node.children.length })}</span>
        ) : null}
      </Link>
      {node.children.length > 0 ? (
        <ul className="org-children">
          {node.children.map((child) => (
            <Branch key={child.id} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function PeopleScreen() {
  const query = useView<People>(queryKeys.people, viewPath.people);
  const { t, tx, label } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader
            title={t("people.title")}
            lede={t("people.lede")}
            action={<AddLink href="/people/new" label={t("people.add")} />}
          />

          <section aria-labelledby="org-heading">
            <h2 id="org-heading" className="text-xl">{t("org.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("org.lede")}</p>

            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat label={t("org.people")} value={String(data.org.total)} />
              <Stat label={t("org.depth")} value={String(data.org.depth)} />
              <Stat label={t("org.roots")} value={String(data.org.roots.length)} />
            </div>

            {data.org.total === 0 ? (
              <div className="mt-4 grid gap-3">
                <Empty>{t("org.empty")}</Empty>
                <p className="text-sm text-muted">{t("org.emptyHint")}</p>
              </div>
            ) : (
              <Card className="mt-4 overflow-x-auto p-5">
                <ul className="org-tree">
                  {data.org.roots.map((root) => (
                    <Branch key={root.id} node={root} />
                  ))}
                </ul>
              </Card>
            )}

            {data.org.former.length > 0 ? (
              <section className="mt-6">
                <h3 className="text-lg">{t("org.former")}</h3>
                <p className="mt-1 text-sm text-muted">{t("org.formerHint")}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {data.org.former.map((person) => (
                    <Link
                      key={person.id}
                      href={`/people/${person.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-card px-4 py-3"
                    >
                      <span>
                        <span className="block font-medium">
                          {person.firstName} {person.lastName}
                        </span>
                        <span className="text-sm text-muted">
                          {person.role || label(person.kind)}
                          {person.endDate ? ` · ${formatDate(person.endDate)}` : ""}
                        </span>
                      </span>
                      <Pill tone="void">{t("org.former")}</Pill>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </section>

          <section aria-labelledby="people-heading" className="mt-8">
            <h2 id="people-heading" className="text-xl">{t("people.list")}</h2>
            <div className="mt-3 grid gap-2">
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
          </section>
        </>
      )}
    </ViewGate>
  );
}