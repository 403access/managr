"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { dismissLastDeletion, restoreLastDeletion } from "@/server/actions";
import { useI18n } from "./locale-provider";

type Deletion = { kind: string; id: number; label: string; detail?: string };

/** A short-lived strip after a screen delete, with the same restore as the trash. */
export function UndoToast({ deletion }: { deletion: Deletion }) {
  const { t, tx } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function restore() {
    setError("");
    startTransition(async () => {
      const result = await restoreLastDeletion();
      if (!result.ok) {
        setError(tx(result.error));
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["view"] });
      router.refresh();
    });
  }

  function dismiss() {
    startTransition(async () => {
      await dismissLastDeletion();
      router.refresh();
    });
  }

  return (
    <div className="fixed bottom-24 left-3 z-40 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-line bg-card p-3 shadow-lg shadow-ink/15 md:bottom-6 md:left-6 md:max-w-sm">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">{t("undo.title")}</p>
          <p className="mt-0.5 truncate text-sm">{deletion.label || t("trash.unknown")}</p>
          {deletion.detail ? <p className="truncate text-[11px] text-muted">{deletion.detail}</p> : null}
          {error ? <p className="mt-1 text-[11px] text-clay">{error}</p> : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          disabled={pending}
          aria-label={t("undo.dismiss")}
          className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-white hover:text-ink disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={restore}
          disabled={pending}
          className="inline-flex min-h-9 items-center rounded-full bg-pine px-3 text-xs font-medium text-paper disabled:opacity-60"
        >
          {t("undo.restore")}
        </button>
        <Link href="/trash" className="inline-flex min-h-9 items-center text-xs font-medium text-pine">
          {t("undo.trash")}
        </Link>
      </div>
    </div>
  );
}