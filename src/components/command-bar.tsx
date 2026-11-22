"use client";

import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { queryKeys, viewPath } from "@/client/query-keys";
import type { CommandPageKey, commandView } from "@/server/views";
import { NavIconGlyph } from "./app-nav";
import { useI18n } from "./locale-provider";
import { moreNav, primaryNav, type NavItem } from "./nav-items";
import { useView } from "./use-view";

type CommandData = ReturnType<typeof commandView>;
type Entry = CommandData["entries"][number];

const entryPageOrder: CommandPageKey[] = [
  "invoices",
  "customers",
  "people",
  "projects",
  "documents",
  "obligations",
  "milestones",
  "legal",
  "company",
  "ledger",
];

const allPages: NavItem[] = [...primaryNav, ...moreNav];

const pageByKey = {
  invoices: allPages.find((page) => page.href === "/invoices")!,
  customers: allPages.find((page) => page.href === "/customers")!,
  people: allPages.find((page) => page.href === "/people")!,
  projects: allPages.find((page) => page.href === "/projects")!,
  documents: allPages.find((page) => page.href === "/documents")!,
  obligations: allPages.find((page) => page.href === "/obligations")!,
  milestones: allPages.find((page) => page.href === "/milestones")!,
  legal: allPages.find((page) => page.href === "/legal")!,
  company: allPages.find((page) => page.href === "/company")!,
  ledger: allPages.find((page) => page.href === "/ledger")!,
} satisfies Record<CommandPageKey, NavItem>;

type Row =
  | { kind: "page"; key: string; title: string; href: string; icon: NavItem["icon"]; detail: string }
  | { kind: "entry"; key: string; title: string; href: string; detail: string; page: CommandPageKey };

type PageRow = Extract<Row, { kind: "page" }>;

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss");
}

function matchScore(text: string, needle: string): number {
  if (!needle) return 0;
  const tokens = needle.split(" ").filter(Boolean);
  if (!tokens.every((token) => text.includes(token))) return 0;
  const bonus = text === needle ? 3 : text.startsWith(needle) ? 2 : text.includes(needle) ? 1 : 0;
  return tokens.length + bonus;
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" strokeLinecap="round" />
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

function OptionRow({
  active,
  id,
  index,
  title,
  detail,
  icon,
  onHover,
  onSelect,
}: {
  active: boolean;
  id: string;
  index: number;
  title: string;
  detail: string;
  icon?: ReactNode;
  onHover: (index: number) => void;
  onSelect: () => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onMouseEnter={() => onHover(index)}
      onClick={onSelect}
      className={`flex min-h-11 w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition ${active ? "bg-pine text-paper" : "text-ink hover:bg-white"}`}
    >
      {icon ? <span className={`mt-0.5 shrink-0 ${active ? "text-paper" : "text-muted"}`}>{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {detail ? <span className={`mt-0.5 block truncate text-xs ${active ? "text-paper/75" : "text-muted"}`}>{detail}</span> : null}
      </span>
    </button>
  );
}

export function CommandBar({
  open,
  onOpen,
  onClose,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const { t, tx } = useI18n();
  const titleId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const queryText = normalize(query.trim());
  const index = useView<CommandData>(queryKeys.command, viewPath.command, { enabled: open });

  const pageRows = useMemo<PageRow[]>(() => {
    if (!queryText) return allPages.map((page) => pageRow(page, t));
    return allPages
      .map((page) => ({ page, score: matchScore(normalize(t(page.labelKey)), queryText) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((item) => pageRow(item.page, t));
  }, [queryText, t]);

  const entryRows = useMemo(() => {
    if (!queryText || !index.data) return [];
    return index.data.entries
      .map((entry) => ({
        entry: { ...entry, title: tx(entry.title), detail: tx(entry.detail) },
        score: matchScore(
          normalize([tx(entry.title), tx(entry.detail), entry.keywords, t(pageByKey[entry.page].labelKey)].join(" ")),
          queryText,
        ),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((item) => item.entry);
  }, [index.data, queryText, t, tx]);

  const groupedEntries = useMemo(() => {
    return entryPageOrder
      .map((page) => ({ page, entries: entryRows.filter((entry) => entry.page === page) }))
      .filter((group) => group.entries.length > 0);
  }, [entryRows]);

  const rows = useMemo<Row[]>(
    () => [
      ...pageRows,
      ...groupedEntries.flatMap((group) =>
        group.entries.map((entry) => ({
          kind: "entry" as const,
          key: entry.id,
          title: entry.title,
          href: entry.href,
          detail: entry.detail,
          page: entry.page,
        })),
      ),
    ],
    [groupedEntries, pageRows],
  );

  const rowIndex = useMemo(() => new Map(rows.map((row, position) => [row.key, position])), [rows]);
  const optionId = (position: number) => `${listId}-option-${position}`;

  useEffect(() => {
    function handleShortcut(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpen();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [onOpen]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => inputRef.current?.focus());

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
        (element) => element.offsetParent !== null && element.tabIndex >= 0,
      );
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
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    setActive((current) => (current < rows.length ? current : 0));
  }, [open, rows.length]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // optionId depends on listId, which stays stable for the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  const select = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (rows.length ? (current + 1) % rows.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (rows.length ? (current - 1 + rows.length) % rows.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[active];
      if (row) select(row.href);
    }
  }

  if (!open) return null;

  const showPages = pageRows.length > 0;
  const showEntries = groupedEntries.length > 0;
  const hasResults = showPages || showEntries;
  const loading = Boolean(queryText) && index.isLoading;
  const failed = Boolean(queryText) && index.isError;

  const content = (
    <div className="fixed inset-0 z-[80]">
      <div aria-hidden="true" className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-x-3 top-[8dvh] mx-auto flex max-h-[80dvh] max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl transition-colors focus-within:border-pine/40 sm:top-[12dvh]"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
          <SearchGlyph />
          <h2 id={titleId} className="sr-only">
            {t("command.title")}
          </h2>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label={t("command.title")}
            aria-activedescendant={rows[active] ? optionId(active) : undefined}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted"
            placeholder={t("command.placeholder")}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="hidden shrink-0 rounded border border-line bg-white px-1.5 py-0.5 font-mono text-[10px] text-muted sm:inline">Esc</kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            title={t("common.close")}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-white hover:text-ink"
          >
            <CloseGlyph />
          </button>
        </div>

        <div id={listId} role="listbox" aria-label={t("command.title")} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {loading ? <p className="px-3 py-6 text-sm text-muted">{t("common.loading")}</p> : null}
          {failed ? (
            <p className="px-3 py-6 text-sm text-clay" role="alert">
              {t("error.refresh")}
            </p>
          ) : null}
          {!loading && !failed && !hasResults ? (
            <p className="px-3 py-6 text-sm text-muted">
              {queryText ? t("command.empty", { query: query.trim() }) : t("command.start")}
            </p>
          ) : null}

          {!loading && showPages ? (
            <section role="group" aria-labelledby={`${listId}-pages`}>
              <p id={`${listId}-pages`} className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">
                {t("command.pages")}
              </p>
              {pageRows.map((row) => {
                const position = rowIndex.get(row.key) ?? 0;
                return (
                  <OptionRow
                    key={row.key}
                    id={optionId(position)}
                    index={position}
                    active={active === position}
                    title={row.title}
                    detail={row.detail}
                    icon={<NavIconGlyph name={row.icon} />}
                    onHover={setActive}
                    onSelect={() => select(row.href)}
                  />
                );
              })}
              {!queryText ? <p className="px-3 pt-3 pb-2 text-xs leading-relaxed text-muted">{t("command.start")}</p> : null}
            </section>
          ) : null}

          {!loading && showEntries ? (
            <section role="group" aria-labelledby={`${listId}-entries`}>
              <p id={`${listId}-entries`} className="px-3 pt-4 pb-1 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">
                {t("command.entries")}
              </p>
              {groupedEntries.map((group) => (
                <div key={group.page} role="presentation">
                  <p className="px-3 pt-2 pb-1 text-xs font-medium text-muted">{t(pageByKey[group.page].labelKey)}</p>
                  {group.entries.map((entry) => {
                    const position = rowIndex.get(entry.id) ?? 0;
                    return (
                      <OptionRow
                        key={entry.id}
                        id={optionId(position)}
                        index={position}
                        active={active === position}
                        title={entry.title}
                        detail={entry.detail}
                        onHover={setActive}
                        onSelect={() => select(entry.href)}
                      />
                    );
                  })}
                </div>
              ))}
            </section>
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 text-[11px] text-muted">
          <span>{t("command.navigate")}</span>
          <span className="hidden sm:inline">{t("command.shortcut")}</span>
        </footer>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

function pageRow(page: NavItem, t: (key: NavItem["labelKey"]) => string): PageRow {
  return { kind: "page", key: `page-${page.href}`, title: t(page.labelKey), href: page.href, icon: page.icon, detail: "" };
}