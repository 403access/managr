import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default function PrintLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-white text-ink">{children}</div>;
}
