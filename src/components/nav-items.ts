export type NavIcon = "desk" | "invoices" | "customers" | "time" | "dates" | "company" | "ledger" | "people" | "documents" | "legal";

export type NavItem = { href: string; labelKey: "nav.desk" | "nav.invoices" | "nav.customers" | "nav.time" | "nav.dates" | "nav.company" | "nav.ledger" | "nav.people" | "nav.documents" | "nav.legal"; icon: NavIcon };

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
  { href: "/documents", labelKey: "nav.documents", icon: "documents" },
  { href: "/legal", labelKey: "nav.legal", icon: "legal" },
];
