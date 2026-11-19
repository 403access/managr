"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useI18n } from "./locale-provider";

const AddSheetContext = createContext<{ close: () => void } | null>(null);

/** Lets a form inside a create sheet close the sheet after a successful save. */
export function useAddSheet() {
  return useContext(AddSheetContext);
}

export const addButtonClass =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-pine text-paper transition hover:bg-pine-deep disabled:opacity-60";

function PlusGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

/** A plus button that opens its create form in a modal sheet. */
export function AddSheet({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const headingId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => setOpen(false);
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={addButtonClass}
        onClick={() => {
          dialogRef.current?.showModal();
          setOpen(true);
        }}
      >
        <PlusGlyph />
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={headingId}
        className="m-auto w-[min(42rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-ink/30"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 id={headingId} className="text-2xl leading-tight">
              {title}
            </h2>
            <button
              type="button"
              aria-label={t("common.close")}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink hover:border-ink"
              onClick={close}
            >
              <CloseGlyph />
            </button>
          </div>
          <div className="mt-4">
            <AddSheetContext.Provider value={{ close }}>{children}</AddSheetContext.Provider>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** A plus button that opens an existing full-page create form. */
export function AddLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} aria-label={label} title={label} className={addButtonClass}>
      <PlusGlyph />
    </Link>
  );
}