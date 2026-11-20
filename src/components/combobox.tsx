"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

export type ComboboxOption = {
  value: string;
  label: string;
  hint?: string;
  /** A short chip shown beside the label, such as a protocol name. */
  tag?: string;
  /** A second, quieter line under the label in the list. */
  description?: string;
  disabled?: boolean;
};

type Props = {
  label: string;
  value: string | null;
  options: ComboboxOption[];
  onSelect: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  noResultsLabel: string;
  disabled?: boolean;
  className?: string;
};

function normalize(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

type Position = { left: number; width: number; top?: number; bottom?: number };

export function Combobox({
  label,
  value,
  options,
  onSelect,
  placeholder,
  searchPlaceholder,
  noResultsLabel,
  disabled = false,
  className = "",
}: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.value === value) ?? null;
  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return options;
    return options.filter((option) => normalize(option.label).includes(needle) || (option.hint && normalize(option.hint).includes(needle)));
  }, [options, query]);

  const measure = useCallback(() => {
    const element = triggerRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const available = Math.max(160, window.innerWidth - 16);
    const width = Math.min(Math.max(rect.width, 232), available);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = window.innerHeight - rect.bottom;
    const above = below < 280 && rect.top > below;
    setPosition({
      left,
      width,
      top: above ? undefined : rect.bottom + 4,
      bottom: above ? window.innerHeight - rect.top + 4 : undefined,
    });
  }, []);

  function openPopover() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled);
    setActive(selectedIndex >= 0 ? selectedIndex : Math.max(0, options.findIndex((option) => !option.disabled)));
  }

  function closeAndFocus() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(next: string) {
    onSelect(next);
    closeAndFocus();
  }

  useEffect(() => {
    if (!open) return;
    measure();
    const reflow = () => measure();
    window.addEventListener("resize", reflow);
    window.addEventListener("scroll", reflow, true);
    const pointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", pointer);
    return () => {
      window.removeEventListener("resize", reflow);
      window.removeEventListener("scroll", reflow, true);
      document.removeEventListener("pointerdown", pointer);
    };
  }, [measure, open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActive((current) => {
      if (current < filtered.length && !filtered[current]?.disabled) return current;
      const firstEnabled = filtered.findIndex((option) => !option.disabled);
      return firstEnabled >= 0 ? firstEnabled : 0;
    });
  }, [filtered, open, query]);

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (filtered.length ? (current + 1) % filtered.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (filtered.length ? (current - 1 + filtered.length) % filtered.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[active];
      if (option && !option.disabled) choose(option.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeAndFocus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className={className}>
      <span id={`${id}-label`} className="mb-1 block text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-1.5 rounded-xl border border-line bg-white px-2.5 text-left text-xs transition hover:border-ink/30 disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-label={`${label}: ${selected?.label ?? placeholder}`}
        title={selected?.label ?? placeholder}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPopover())}
      >
        <span className={`truncate ${selected ? "" : "text-muted"}`}>{selected?.label ?? placeholder}</span>
        <svg viewBox="0 0 16 16" className={`size-3.5 shrink-0 text-muted transition ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && position
        ? createPortal(
            <div
              ref={popoverRef}
              style={{ position: "fixed", left: position.left, width: position.width, top: position.top, bottom: position.bottom, zIndex: 90 }}
              className="overflow-hidden rounded-xl border border-line bg-card shadow-2xl shadow-ink/25"
            >
              <div className="border-b border-line p-2">
                <label className="sr-only" htmlFor={`${id}-search`}>
                  {searchPlaceholder}
                </label>
                <div className="relative">
                  <svg viewBox="0 0 16 16" className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted" aria-hidden="true">
                    <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="m10.5 10.5 3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <input
                    ref={inputRef}
                    id={`${id}-search`}
                    type="text"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls={`${id}-list`}
                    aria-autocomplete="list"
                    aria-activedescendant={filtered[active] ? `${id}-option-${active}` : undefined}
                    className="min-h-11 w-full rounded-lg border border-line bg-white pr-2 pl-8 text-sm text-ink"
                    placeholder={searchPlaceholder}
                    autoComplete="off"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={onSearchKeyDown}
                  />
                </div>
              </div>
              <ul id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} className="max-h-64 overflow-y-auto p-1">
                {filtered.length === 0 ? (
                  <li className="px-2 py-3 text-xs text-muted" role="presentation">
                    {noResultsLabel}
                  </li>
                ) : (
                  filtered.map((option, index) => (
                    <li
                      key={option.value}
                      id={`${id}-option-${index}`}
                      role="option"
                      aria-selected={option.value === value}
                      aria-disabled={option.disabled || undefined}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => {
                        if (!option.disabled) choose(option.value);
                      }}
                      className={`flex min-h-11 items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                        option.disabled ? "cursor-not-allowed text-muted/60" : "cursor-pointer"
                      } ${index === active && !option.disabled ? "bg-pine/10" : ""}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{option.label}</span>
                        {option.description ? (
                          <span className="mt-0.5 block truncate text-[10px] text-muted">{option.description}</span>
                        ) : null}
                      </span>
                      {option.tag ? (
                        <span className="mt-0.5 shrink-0 rounded-full bg-pine/10 px-1.5 py-0.5 text-[10px] font-medium text-pine">
                          {option.tag}
                        </span>
                      ) : null}
                      {option.hint ? <span className="mt-0.5 shrink-0 font-mono text-[10px] text-muted">{option.hint}</span> : null}
                      {option.value === value ? (
                        <span className="mt-0.5 shrink-0 text-pine" aria-hidden="true">
                          ✓
                        </span>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}