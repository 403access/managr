"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { detailPageKeyForPath, resolveDetailSidebarMode } from "@/domain/settings";
import { SidePanel } from "./side-panel";
import { useUiSettings } from "./settings-provider";
import { useWideLayout } from "./use-wide-layout";

type AddSheetRequest = { title: string; children: ReactNode };

type AddSheetHostValue = {
  panel: AddSheetRequest | null;
  open: (panel: AddSheetRequest) => void;
  close: () => void;
};

const AddSheetContext = createContext<{ close: () => void } | null>(null);
const AddSheetHostContext = createContext<AddSheetHostValue | null>(null);

/** Lets a form inside a side panel close the panel after a successful save. */
export function useAddSheet() {
  return useContext(AddSheetContext);
}

function useAddSheetHost(): AddSheetHostValue {
  const value = useContext(AddSheetHostContext);
  if (!value) throw new Error("AddSheetProvider is missing.");
  return value;
}

/**
 * Holds the open add form above the app shell. The host renders it as a column
 * on wide screens or as an overlay on narrow ones.
 */
export function AddSheetProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [panel, setPanel] = useState<AddSheetRequest | null>(null);
  const close = useCallback(() => setPanel(null), []);
  const open = useCallback((next: AddSheetRequest) => setPanel(next), []);

  useEffect(() => {
    setPanel(null);
  }, [pathname]);

  const value = useMemo<AddSheetHostValue>(() => ({ panel, open, close }), [close, open, panel]);

  return <AddSheetHostContext.Provider value={value}>{children}</AddSheetHostContext.Provider>;
}

/** The side panel column itself. Place it inside the app shell's flex row. */
export function AddSheetHost() {
  const { panel, close } = useAddSheetHost();
  const pathname = usePathname();
  const settings = useUiSettings();
  const wide = useWideLayout();
  if (!panel) return null;
  const page = detailPageKeyForPath(pathname);
  const mode = page ? resolveDetailSidebarMode(settings, page) : settings.detailSidebarMode;
  const inline = mode === "inline" && wide;
  return (
    <AddSheetContext.Provider value={{ close }}>
      <SidePanel variant={inline ? "column" : "overlay"} title={panel.title} onClose={close}>
        {panel.children}
      </SidePanel>
    </AddSheetContext.Provider>
  );
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

/** A plus button that opens its create form in the app's side panel. */
export function AddSheet({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  const host = useAddSheetHost();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-haspopup="dialog"
      className={addButtonClass}
      onClick={() => host.open({ title, children })}
    >
      <PlusGlyph />
    </button>
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