"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useI18n } from "./locale-provider";

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableChildren(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(focusableSelector)].filter((element) => element.offsetParent !== null);
}

/**
 * A right-hand panel. `column` is a full-height rail beside the app content,
 * `inline` docks next to a page's content, and `overlay` floats above the page
 * and traps focus until it closes.
 */
export function SidePanel({
  variant,
  title,
  subtitle,
  onClose,
  children,
}: {
  variant: "column" | "inline" | "overlay";
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const headingId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (variant !== "overlay") return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = focusableChildren(panelRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, variant]);

  const header = (
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 id={headingId} className="truncate text-2xl leading-tight">
          {title}
        </h2>
        {subtitle ? <p className="mt-1 truncate text-sm text-muted">{subtitle}</p> : null}
      </div>
      <button
        ref={closeRef}
        type="button"
        aria-label={t("common.close")}
        title={t("common.close")}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink hover:border-ink"
        onClick={onClose}
      >
        <CloseGlyph />
      </button>
    </header>
  );

  const body = (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-6">{children}</div>
  );

  if (variant === "column") {
    return (
      <aside
        ref={panelRef}
        role="region"
        aria-labelledby={headingId}
        className="sticky top-0 hidden h-dvh w-[22rem] shrink-0 flex-col overflow-hidden border-l border-line bg-card lg:flex xl:w-[26rem] 2xl:w-[28rem]"
      >
        {header}
        {body}
      </aside>
    );
  }

  if (variant === "inline") {
    return (
      <section
        ref={panelRef}
        role="region"
        aria-labelledby={headingId}
        className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-sm"
      >
        {header}
        {body}
      </section>
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      <div aria-hidden="true" className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-line bg-paper shadow-2xl"
      >
        {header}
        {body}
      </div>
    </div>
  );
}