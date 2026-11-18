"use client";

import Link from "next/link";
import { formatDate } from "@/domain/calendar";
import type { OrgNode } from "@/domain/org";
import type { orgView } from "@/server/views";
import { queryKeys, viewPath } from "@/client/query-keys";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Empty, LinkButton, PageHeader, Pill, Stat } from "@/components/ui";

type Org = ReturnType<typeof orgView>;

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

export function OrgScreen() {
  const query = useView<Org>(queryKeys.org, viewPath.org);
  const { t, label } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader
            title={t("org.title")}
            lede={t("org.lede")}
            action={<LinkButton href="/people" tone="quiet">{t("nav.people")}</LinkButton>}
          />
          <div className="grid grid-cols-3 gap-3">
            <Stat label={t("org.people")} value={String(data.total)} />
            <Stat label={t("org.depth")} value={String(data.depth)} />
            <Stat label={t("org.roots")} value={String(data.roots.length)} />
          </div>

          {data.total === 0 ? (
            <div className="mt-4 grid gap-3">
              <Empty>{t("org.empty")}</Empty>
              <p className="text-sm text-muted">{t("org.emptyHint")}</p>
            </div>
          ) : (
            <Card className="mt-4 overflow-x-auto p-5">
              <ul className="org-tree">
                {data.roots.map((root) => (
                  <Branch key={root.id} node={root} />
                ))}
              </ul>
            </Card>
          )}

          {data.former.length > 0 ? (
            <section className="mt-6">
              <h2 className="text-xl">{t("org.former")}</h2>
              <p className="mt-1 text-sm text-muted">{t("org.formerHint")}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {data.former.map((person) => (
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
        </>
      )}
    </ViewGate>
  );
}