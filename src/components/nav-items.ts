export type NavIcon = "desk" | "invoices" | "customers" | "time" | "dates" | "company" | "ledger" | "people" | "documents" | "legal" | "projects" | "analytics" | "sources";

export type NavItem = { href: string; labelKey: "nav.desk" | "nav.invoices" | "nav.customers" | "nav.time" | "nav.dates" | "nav.company" | "nav.ledger" | "nav.people" | "nav.documents" | "nav.legal" | "nav.projects" | "nav.analytics" | "nav.sources"; icon: NavIcon };

export const primaryNav: NavItem[] = [
  { href: "/", labelKey: "nav.desk", icon: "desk" },
  { href: "/invoices", labelKey: "nav.invoices", icon: "invoices" },
  { href: "/customers", labelKey: "nav.customers", icon: "customers" },
  { href: "/time", labelKey: "nav.time", icon: "time" },
  { href: "/obligations", labelKey: "nav.dates", icon: "dates" },
];

export const moreNav: NavItem[] = [
  { href: "/company", labelKey: "nav.company", icon: "company" },
  { href: "/ledger", labelKey: "nav.ledger", icon: "ledger" },
  { href: "/people", labelKey: "nav.people", icon: "people" },
  { href: "/projects", labelKey: "nav.projects", icon: "projects" },
  { href: "/analytics", labelKey: "nav.analytics", icon: "analytics" },
  { href: "/documents", labelKey: "nav.documents", icon: "documents" },
  { href: "/legal", labelKey: "nav.legal", icon: "legal" },
  { href: "/sources", labelKey: "nav.sources", icon: "sources" },
];
