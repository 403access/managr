export type NavIcon = "desk" | "invoices" | "customers" | "time" | "dates" | "tax" | "company" | "ledger" | "cashflow" | "bank" | "people" | "documents" | "legal" | "projects" | "analytics" | "milestones" | "sources" | "settings" | "assistant" | "trash";

export type NavItem = { href: string; labelKey: "nav.desk" | "nav.invoices" | "nav.customers" | "nav.time" | "nav.dates" | "nav.tax" | "nav.company" | "nav.ledger" | "nav.cashflow" | "nav.bank" | "nav.people" | "nav.documents" | "nav.legal" | "nav.projects" | "nav.analytics" | "nav.milestones" | "nav.sources" | "nav.settings" | "nav.assistant" | "nav.trash"; icon: NavIcon };

export const primaryNav: NavItem[] = [
  { href: "/", labelKey: "nav.desk", icon: "desk" },
  { href: "/invoices", labelKey: "nav.invoices", icon: "invoices" },
  { href: "/customers", labelKey: "nav.customers", icon: "customers" },
  { href: "/time", labelKey: "nav.time", icon: "time" },
  { href: "/obligations", labelKey: "nav.dates", icon: "dates" },
];

export const moreNav: NavItem[] = [
  { href: "/assistant", labelKey: "nav.assistant", icon: "assistant" },
  { href: "/company", labelKey: "nav.company", icon: "company" },
  { href: "/ledger", labelKey: "nav.ledger", icon: "ledger" },
  { href: "/cashflow", labelKey: "nav.cashflow", icon: "cashflow" },
  { href: "/tax", labelKey: "nav.tax", icon: "tax" },
  { href: "/bank", labelKey: "nav.bank", icon: "bank" },
  { href: "/people", labelKey: "nav.people", icon: "people" },
  { href: "/projects", labelKey: "nav.projects", icon: "projects" },
  { href: "/analytics", labelKey: "nav.analytics", icon: "analytics" },
  { href: "/milestones", labelKey: "nav.milestones", icon: "milestones" },
  { href: "/documents", labelKey: "nav.documents", icon: "documents" },
  { href: "/legal", labelKey: "nav.legal", icon: "legal" },
  { href: "/sources", labelKey: "nav.sources", icon: "sources" },
  { href: "/trash", labelKey: "nav.trash", icon: "trash" },
  { href: "/settings", labelKey: "nav.settings", icon: "settings" },
];
