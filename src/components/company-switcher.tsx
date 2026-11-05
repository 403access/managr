"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { legalFormLabel } from "@/domain/company";
import { switchCompany } from "@/server/actions";
import { useI18n } from "./locale-provider";

type CompanyOption = { id: number; legalName: string; legalForm: string };

function initials(name: string): string {
  const words = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export function CompanySwitcher({ companies, activeId }: { companies: CompanyOption[]; activeId: number }) {
  const { t, tx } = useI18n();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const active = companies.find((company) => company.id === activeId) ?? companies[0];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!active || companies.length < 2) return null;

  function choose(id: number) {
    if (id === activeId || pending) {
      setOpen(false);
      return;
    }
    setError("");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("companyId", String(id));
      const result = await switchCompany({ error: "", message: "" }, formData);
      if (result.message) {
        window.location.reload();
        return;
      }
      setError(result.error || t("company.switchFailed"));
    });
  }

  return (
    <div ref={wrapRef} className="relative mt-3">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t("company.choose")}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex w-full items-center gap-2.5 rounded-2xl border px-2.5 py-2 text-left transition ${
          open ? "border-pine/40 bg-white shadow-sm" : "border-line bg-card hover:border-ink/25 hover:bg-white"
        } ${pending ? "opacity-70" : ""}`}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pine/10 text-[11px] font-semibold text-pine">
          {initials(active.legalName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block whitespace-normal break-words text-sm font-medium leading-snug">{active.legalName}</span>
          <span className="mt-0.5 block text-[11px] leading-tight text-muted">{legalFormLabel(active.legalForm)}</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={t("company.choose")}
          className="absolute left-0 top-full z-50 mt-2 w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-card p-1.5 shadow-xl shadow-ink/10"
        >
          <p className="px-2.5 pt-1 pb-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">
            {t("company.companies")}
          </p>
          <div className="grid gap-0.5">
            {companies.map((company) => {
              const current = company.id === activeId;
              return (
                <button
                  key={company.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current}
                  disabled={pending}
                  onClick={() => choose(company.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                    current ? "bg-pine/10" : "hover:bg-white"
                  }`}
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${
                      current ? "bg-pine text-paper" : "bg-ink/5 text-ink"
                    }`}
                  >
                    {initials(company.legalName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block whitespace-normal break-words text-sm leading-snug">{company.legalName}</span>
                    <span className="mt-0.5 block text-[11px] leading-tight text-muted">{legalFormLabel(company.legalForm)}</span>
                  </span>
                  {current ? (
                    <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-pine" aria-hidden="true">
                      <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mt-1 border-t border-line pt-1">
            <Link
              href="/company#companies"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex min-h-9 items-center rounded-xl px-2.5 text-xs font-medium text-pine hover:bg-white"
            >
              {t("company.manage")}
            </Link>
          </div>
          {error ? (
            <p role="alert" className="px-2.5 pt-1 pb-1 text-xs text-clay">
              {tx(error)}
            </p>
          ) : null}
          {pending ? (
            <p role="status" className="px-2.5 pt-1 pb-1 text-xs text-muted">
              {t("company.switching")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
