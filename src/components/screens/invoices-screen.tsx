"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { invoicesView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { queryKeys, viewPath } from "@/client/query-keys";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { Empty, LinkButton, Money, PageHeader, Pill, textLinkClass } from "@/components/ui";

type Invoices = ReturnType<typeof invoicesView>;

export function InvoicesScreen({ children }: { children?: ReactNode }) {
  const query = useView<Invoices>(queryKeys.invoices, viewPath.invoices);
  const pathname = usePathname();
  const { t, label } = useI18n();
  const index = pathname === "/invoices";
  const selectedId = Number(pathname.match(/^\/invoices\/(\d+)/)?.[1] ?? 0);
  return (
    <ViewGate query={query}>
      {(data) => (
        <div className="lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[24rem_minmax(0,1fr)] 2xl:grid-cols-[26rem_minmax(0,1fr)]">
          <section className={`min-w-0 ${index ? "" : "hidden lg:block"}`}>
            <div className="lg:sticky lg:top-0 lg:max-h-dvh lg:overflow-y-auto lg:pb-8 lg:overscroll-contain">
              <PageHeader title={t("invoices.title")} lede={t("invoices.lede")} action={<LinkButton href="/invoices/new">{t("invoices.new")}</LinkButton>} />
              <div className="pt-2">
                {data.invoices.length === 0 ? (
                  <Empty>{t("invoices.empty")}</Empty>
                ) : (
                  <div className="grid gap-2">
                    {data.invoices.map((invoice) => {
                      const selected = invoice.id === selectedId;
                      return (
                        <Link
                          key={invoice.id}
                          href={`/invoices/${invoice.id}`}
                          aria-current={selected ? "page" : undefined}
                          className={`grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-2xl border px-4 py-3 transition ${selected ? "border-pine bg-pine/5" : "border-line bg-card hover:border-ink"}`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{invoice.customerName}</span>
                            <span className="block truncate text-xs text-muted">
                              {invoice.number ?? t("common.draft")} · {t("invoices.due", { date: formatDate(invoice.dueDate) })}
                            </span>
                          </span>
                          <span className="flex flex-col items-end gap-1 text-right">
                            <Money cents={invoice.grossCents} />
                            <Pill tone={invoice.displayStatus}>{label(invoice.displayStatus)}</Pill>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
          <section className={`min-w-0 ${index ? "hidden lg:block" : ""}`}>
            {index ? (
              <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
                <div className="max-w-md">
                  <h2 className="text-2xl text-ink">{t("invoices.selectTitle")}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{t("invoices.selectBody")}</p>
                </div>
              </div>
            ) : (
              <>
                <Link href="/invoices" className={`${textLinkClass} mb-2 lg:hidden`}>
                  {t("common.back")}
                </Link>
                {children}
              </>
            )}
          </section>
        </div>
      )}
    </ViewGate>
  );
}
