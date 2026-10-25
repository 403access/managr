"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { moreNav, primaryNav, type NavIcon, type NavItem } from "./nav-items";

function active(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Icon({ name }: { name: NavIcon }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      {name === "desk" ? <path {...common} d="M4 10.5 12 4l8 6.5V20H4zM9 20v-6h6v6" /> : null}
      {name === "invoices" ? <path {...common} d="M7 3.5h7l5 5V20.5H7zM14 3.5V9h5.5M9 13h6M9 16.5h4" /> : null}
      {name === "time" ? <path {...common} d="M12 21a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 8v4.5l3 2" /> : null}
      {name === "dates" ? <path {...common} d="M5 5.5h14V20H5zM5 9.5h14M8 3.5v4M16 3.5v4" /> : null}
      {name === "company" ? <path {...common} d="M4 20.5h16M6 20.5V8l6-4 6 4v12.5M10 20.5v-4h4v4" /> : null}
      {name === "ledger" ? <path {...common} d="M5 5h14v14H5zM5 9h14M5 13h14M9 5v14" /> : null}
      {name === "people" ? <path {...common} d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4.5 19.5c.6-2.4 2.4-3.5 4.5-3.5s3.9 1.1 4.5 3.5M16 11a2.5 2.5 0 1 0 0-5M16.2 16c1.6.2 2.8 1.2 3.3 3.5" /> : null}
      {name === "documents" ? <path {...common} d="M7 3.5h6l4 4V20.5H7zM13 3.5V8h4" /> : null}
      {name === "legal" ? <path {...common} d="M12 3.5v3M8 6.5h8M7 10.5 5 18h6l-2-7.5M17 10.5 15 18h6l-2-7.5M4 20.5h16" /> : null}
    </svg>
  );
}

function Item({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const on = active(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm ${on ? "bg-pine text-paper" : "text-ink hover:bg-white"}`}
      aria-current={on ? "page" : undefined}
    >
      <Icon name={item.icon} />
      {item.label}
    </Link>
  );
}

export function AppNav({ variant }: { variant: "side" | "bottom" }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreOn = moreNav.some((item) => active(pathname, item.href));

  if (variant === "side") {
    return (
      <nav className="mt-8 grid gap-1" aria-label="Sections">
        {primaryNav.map((item) => (
          <Item key={item.href} item={item} pathname={pathname} />
        ))}
        <p className="mt-4 px-3 text-xs font-medium tracking-wide text-muted uppercase">More</p>
        {moreNav.map((item) => (
          <Item key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
    );
  }

  return (
    <div className="md:hidden">
      {moreOpen ? (
        <div className="fixed inset-x-3 bottom-20 z-40 rounded-2xl border border-line bg-card p-2 shadow-lg">
          <nav className="grid gap-1" aria-label="More sections">
            {moreNav.map((item) => (
              <Item key={item.href} item={item} pathname={pathname} onNavigate={() => setMoreOpen(false)} />
            ))}
          </nav>
        </div>
      ) : null}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Primary">
        {primaryNav.map((item) => {
          const on = active(pathname, item.href);
          return (
            <Link key={item.href} href={item.href} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] ${on ? "text-pine" : "text-muted"}`} aria-current={on ? "page" : undefined}>
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
        <button type="button" className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] ${moreOn || moreOpen ? "text-pine" : "text-muted"}`} aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}>
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path d="M5 12h.01M12 12h.01M19 12h.01" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          More
        </button>
      </nav>
    </div>
  );
}
