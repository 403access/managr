export type NavIcon = "desk" | "invoices" | "time" | "dates" | "company" | "ledger" | "people" | "documents" | "legal";

export type NavItem = { href: string; label: string; icon: NavIcon };

export const primaryNav: NavItem[] = [
  { href: "/", label: "Desk", icon: "desk" },
  { href: "/invoices", label: "Invoices", icon: "invoices" },
  { href: "/time", label: "Time", icon: "time" },
  { href: "/obligations", label: "Dates", icon: "dates" },
];

export const moreNav: NavItem[] = [
  { href: "/company", label: "Company", icon: "company" },
  { href: "/ledger", label: "Ledger", icon: "ledger" },
  { href: "/people", label: "People", icon: "people" },
  { href: "/documents", label: "Documents", icon: "documents" },
  { href: "/legal", label: "Legal", icon: "legal" },
];
