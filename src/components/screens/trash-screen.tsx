"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { restoreDeletedRecord } from "@/server/actions";
import type { TrashEntry, TrashKind } from "@/domain/trash";
import type { MessageKey } from "@/i18n";
import { useI18n } from "@/components/locale-provider";
import { Empty, PageHeader } from "@/components/ui";

const TRASH_LABEL: Record<TrashKind, MessageKey> = {
  shareholder: "trash.kind.shareholder",
  policy: "trash.kind.policy",
  invoice: "trash.kind.invoice",
  salary_change: "trash.kind.salary_change",
  absence: "trash.kind.absence",
  project: "trash.kind.project",
  milestone: "trash.kind.milestone",
  task: "trash.kind.task",
  time: "trash.kind.time",
  deadline: "trash.kind.deadline",
  document: "trash.kind.document",
  director_contract: "trash.kind.director_contract",
  founder_health: "trash.kind.founder_health",
};

function formatDeletedAt(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function TrashRow({ entry }: { entry: TrashEntry }) {
  const { t, tx, locale } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function restore() {
    setError("");
    startTransition(async () => {
      const result = await restoreDeletedRecord(entry.kind, entry.id);
      if (!result.ok) {
        setError(tx(result.error));
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["view"] });
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-medium text-muted">
            {t(TRASH_LABEL[entry.kind])}
          </span>
          <p className="truncate text-sm font-medium">{entry.label}</p>
        </div>
        {entry.detail ? <p className="mt-0.5 truncate text-xs text-muted">{entry.detail}</p> : null}
        <p className="mt-1 text-[11px] text-muted">{t("trash.deletedAt", { date: formatDeletedAt(entry.deletedAt, locale) })}</p>
        {error ? <p className="mt-1 text-[11px] text-clay">{error}</p> : null}
      </div>
      <button
        type="button"
        onClick={restore}
        disabled={pending}
        className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-line bg-white px-3 text-xs font-medium hover:border-ink disabled:opacity-60"
      >
        {t("trash.restore")}
      </button>
    </li>
  );
}

export function TrashScreen({ entries }: { entries: TrashEntry[] }) {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("trash.title")} lede={t("trash.lede")} />
      {entries.length === 0 ? (
        <Empty>{t("trash.empty")}</Empty>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">{t("trash.count", { count: entries.length })}</p>
          <ul className="grid gap-2">
            {entries.map((entry) => (
              <TrashRow key={`${entry.kind}-${entry.id}`} entry={entry} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}