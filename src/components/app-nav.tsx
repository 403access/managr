"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LanguageSwitch, useI18n } from "./locale-provider";
import { moreNav, primaryNav, type NavIcon, type NavItem } from "./nav-items";

function active(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // /people/org is its own entry; a person record still belongs to People.
  if (href === "/people") return pathname === "/people" || /^\/people\/\d+$/.test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Icon({ name }: { name: NavIcon }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      {name === "desk" ? <path {...common} d="M4 10.5 12 4l8 6.5V20H4zM9 20v-6h6v6" /> : null}
      {name === "invoices" ? <path {...common} d="M7 3.5h7l5 5V20.5H7zM14 3.5V9h5.5M9 13h6M9 16.5h4" /> : null}
      {name === "customers" ? <path {...common} d="M4 5.5h16V18.5H4zM8 8.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5.8 15.5c.4-1.4 1.2-2 2.2-2s1.8.6 2.2 2M13 10h4M13 13.5h3" /> : null}
      {name === "time" ? <path {...common} d="M12 21a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 8v4.5l3 2" /> : null}
      {name === "dates" ? <path {...common} d="M5 5.5h14V20H5zM5 9.5h14M8 3.5v4M16 3.5v4" /> : null}
      {name === "company" ? <path {...common} d="M4 20.5h16M6 20.5V8l6-4 6 4v12.5M10 20.5v-4h4v4" /> : null}
      {name === "ledger" ? <path {...common} d="M5 5h14v14H5zM5 9h14M5 13h14M9 5v14" /> : null}
      {name === "cashflow" ? <path {...common} d="M4 6.5h5v11H4zM13 8.5h7M13 12h7M13 15.5h5M17.5 14l2 1.5-2 1.5" /> : null}
      {name === "bank" ? <path {...common} d="M3.5 20.5h17M5.5 20.5V10M9.5 20.5V10M14.5 20.5V10M18.5 20.5V10M4 10l8-5.5L20 10z" /> : null}
      {name === "people" ? <path {...common} d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4.5 19.5c.6-2.4 2.4-3.5 4.5-3.5s3.9 1.1 4.5 3.5M16 11a2.5 2.5 0 1 0 0-5M16.2 16c1.6.2 2.8 1.2 3.3 3.5" /> : null}
      {name === "org" ? <path {...common} d="M9.5 3.5h5v4h-5zM3.5 16.5h5v4h-5zM15.5 16.5h5v4h-5zM12 7.5v4.5M6 16.5v-2.5h12v2.5" /> : null}
      {name === "documents" ? <path {...common} d="M7 3.5h6l4 4V20.5H7zM13 3.5V8h4" /> : null}
      {name === "legal" ? <path {...common} d="M12 3.5v3M8 6.5h8M7 10.5 5 18h6l-2-7.5M17 10.5 15 18h6l-2-7.5M4 20.5h16" /> : null}
      {name === "projects" ? <path {...common} d="M4 7.5h6l2 2h8v9H4zM4 7.5v-2h6l2 2" /> : null}
      {name === "analytics" ? <path {...common} d="M4 20.5h16M7 20.5v-6M12 20.5V8M17 20.5V4.5" /> : null}
      {name === "milestones" ? <path {...common} d="M6 3.5v17M6 4.5h11l-2 3.5 2 3.5H6" /> : null}
      {name === "sources" ? <path {...common} d="M4 5.5h6.5a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 0-1.5-1.5H4zM20 5.5h-6.5A1.5 1.5 0 0 0 12 7v13a1.5 1.5 0 0 1 1.5-1.5H20zM7 9h2.5M7 12h2.5M14.5 9H17M14.5 12H17" /> : null}
    </svg>
  );
}

function Item({ item, pathname, label, collapsed, onNavigate }: { item: NavItem; pathname: string; label: string; collapsed?: boolean; onNavigate?: () => void }) {
  const on = active(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={`flex min-h-11 items-center rounded-xl text-sm ${collapsed ? "w-11 justify-center" : "gap-3 px-3"} ${on ? "bg-pine text-paper" : "text-ink hover:bg-white"}`}
      aria-current={on ? "page" : undefined}
    >
      <Icon name={item.icon} />
      {collapsed ? null : label}
    </Link>
  );
}

export function AppNav({ variant, collapsed = false }: { variant: "side" | "bottom"; collapsed?: boolean }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreOn = moreNav.some((item) => active(pathname, item.href));

  if (variant === "side") {
    return (
      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <nav className={`grid gap-1 overflow-y-auto ${collapsed ? "justify-items-center" : ""}`} aria-label={t("nav.sections")}>
          {primaryNav.map((item) => (
            <Item key={item.href} item={item} pathname={pathname} label={t(item.labelKey)} collapsed={collapsed} />
          ))}
          {collapsed ? (
            <span className="my-2 h-px w-8 justify-self-center bg-line" aria-hidden="true" />
          ) : (
            <p className="mt-4 px-3 text-xs font-medium tracking-wide text-muted uppercase">{t("nav.more")}</p>
          )}
          {moreNav.map((item) => (
            <Item key={item.href} item={item} pathname={pathname} label={t(item.labelKey)} collapsed={collapsed} />
          ))}
        </nav>
        <div className={`mt-auto pt-4 ${collapsed ? "flex justify-center" : ""}`}>
          <LanguageSwitch compact={collapsed} />
        </div>
      </div>
    );
  }

  return (
    <div className="md:hidden">
      {moreOpen ? (
        <div className="fixed inset-x-3 bottom-20 z-40 max-h-[70dvh] overflow-y-auto rounded-2xl border border-line bg-card p-2 shadow-lg">
          <nav className="grid gap-1" aria-label={t("nav.moreSections")}>
            {moreNav.map((item) => (
              <Item key={item.href} item={item} pathname={pathname} label={t(item.labelKey)} onNavigate={() => setMoreOpen(false)} />
            ))}
            <div className="px-2 py-1">
              <LanguageSwitch />
            </div>
          </nav>
        </div>
      ) : null}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label={t("nav.primary")}>
        {primaryNav.map((item) => {
          const on = active(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} className={`flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-center text-[11px] leading-tight ${on ? "text-pine" : "text-muted"}`} aria-current={on ? "page" : undefined}>
              <Icon name={item.icon} />
              {t(item.labelKey)}
            </Link>
          );
        })}
        <button type="button" className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] ${moreOn || moreOpen ? "text-pine" : "text-muted"}`} aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path d="M5 12h.01M12 12h.01M19 12h.01" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          {t("nav.more")}
        </button>
      </nav>
    </div>
  );
}
