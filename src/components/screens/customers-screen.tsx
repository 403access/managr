"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { saveCustomer } from "@/server/actions";
import type { customerView, customersView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import {
  CUSTOMER_RELATIONSHIPS,
  DEFAULT_CUSTOMER_SORT,
  defaultCustomerDirection,
  filterCustomers,
  sortCustomers,
  type CustomerRelationship,
  type CustomerSortKey,
  type SortDirection,
} from "@/domain/customers";
import { formatEuro } from "@/domain/money";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AddSheet } from "@/components/add-sheet";
import { euroInput, formatDuration } from "@/components/amounts";
import { InfoButton } from "@/components/info-sheet";
import { useI18n } from "@/components/locale-provider";
import { useDetailSidebarMode } from "@/components/settings-provider";
import { SidePanel } from "@/components/side-panel";
import { useView, ViewGate } from "@/components/use-view";
import { useWideLayout } from "@/components/use-wide-layout";
import { Card, Empty, Field, Money, PageHeader, Pill, SelectInput, Stat, TextInput, buttonClass } from "@/components/ui";

type Customers = ReturnType<typeof customersView>;
type Customer = Customers["customers"][number];
type CustomerDetail = NonNullable<ReturnType<typeof customerView>>;

type CustomerFieldsValue = {
  name: string;
  email: string;
  website: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  vatId: string;
  buyerReference: string;
  hourlyRateCents: number | null;
};

function CustomerFields({ customer }: { customer?: CustomerFieldsValue }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("common.name")}><TextInput name="name" defaultValue={customer?.name} required /></Field>
      <Field label={t("common.email")}><TextInput name="email" type="email" defaultValue={customer?.email} /></Field>
      <Field label={t("common.website")}><TextInput name="website" type="url" defaultValue={customer?.website} maxLength={200} /></Field>
      <Field label={t("common.street")}><TextInput name="street" defaultValue={customer?.street} /></Field>
      <Field label={t("common.postal")}><TextInput name="postalCode" defaultValue={customer?.postalCode} /></Field>
      <Field label={t("common.city")}><TextInput name="city" defaultValue={customer?.city} /></Field>
      <Field label={t("common.country")}><TextInput name="country" defaultValue={customer?.country ?? "Deutschland"} /></Field>
      <Field label={t("company.vatId")}><TextInput name="vatId" defaultValue={customer?.vatId} /></Field>
      <Field label={t("invoices.buyerReference")} hint={t("invoices.buyerReferenceHint")}>
        <TextInput name="buyerReference" defaultValue={customer?.buyerReference} maxLength={100} />
      </Field>
      <Field label={t("rates.customer")} hint={t("rates.customerHint")}>
        <TextInput
          name="hourlyRate"
          inputMode="decimal"
          placeholder="95,00"
          defaultValue={customer?.hourlyRateCents == null ? "" : euroInput(customer.hourlyRateCents)}
        />
      </Field>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs font-medium tracking-wide text-muted uppercase sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function CustomerDetails({ data }: { data: CustomerDetail }) {
  const { t, label } = useI18n();
  const [editing, setEditing] = useState(false);
  const { customer, totals } = data;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t("customers.statProjects")} value={String(totals.projectCount)} />
        <Stat
          label={t("customers.statTime")}
          value={formatDuration(totals.minutes)}
          hint={t("customers.billableHint", { duration: formatDuration(totals.billableMinutes) })}
        />
        <Stat
          label={t("customers.statRevenue")}
          value={formatEuro(totals.revenueCents)}
          hint={t("customers.invoiceCount", { count: totals.invoiceCount })}
        />
        <Stat label={t("customers.statOpen")} value={formatEuro(totals.openCents)} />
      </div>
      {totals.lastActivity ? (
        <p className="text-xs text-muted">{t("customers.lastActivity", { date: formatDate(totals.lastActivity) })}</p>
      ) : null}
      {totals.billableValueCents > 0 ? (
        <p className="text-xs text-muted">{t("rates.billableValue", { amount: formatEuro(totals.billableValueCents) })}</p>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg">{t("customers.contact")}</h3>
          <button type="button" className={buttonClass("quiet")} onClick={() => setEditing((open) => !open)}>
            {editing ? t("common.close") : t("common.edit")}
          </button>
        </div>
        {editing ? (
          <ActionForm action={saveCustomer} className="mt-3 grid gap-3">
            <input type="hidden" name="id" value={customer.id} />
            <CustomerFields customer={customer} />
            <SubmitButton tone="quiet">{t("customers.save")}</SubmitButton>
          </ActionForm>
        ) : (
          <dl className="mt-3 grid gap-2 text-sm">
            <DetailRow label={t("customers.address")}>
              {customer.street || customer.postalCode || customer.city ? (
                <>
                  {customer.street ? <span className="block">{customer.street}</span> : null}
                  <span className="block">{[customer.postalCode, customer.city].filter(Boolean).join(" ") || "–"}</span>
                  <span className="block">{customer.country || "–"}</span>
                </>
              ) : (
                t("customers.noValue")
              )}
            </DetailRow>
            <DetailRow label={t("common.email")}>
              {customer.email ? <a href={`mailto:${customer.email}`} className="text-pine">{customer.email}</a> : t("customers.noValue")}
            </DetailRow>
            <DetailRow label={t("common.website")}>
              {customer.website ? (
                <a href={customer.website} target="_blank" rel="noreferrer" className="text-pine">{customer.website}</a>
              ) : (
                t("customers.noValue")
              )}
            </DetailRow>
            <DetailRow label={t("company.vatId")}>{customer.vatId || t("customers.noValue")}</DetailRow>
            <DetailRow label={t("invoices.buyerReference")}>{customer.buyerReference || t("customers.noValue")}</DetailRow>
            <DetailRow label={t("rates.customer")}>
              {customer.hourlyRateCents === null
                ? t("rates.noRate")
                : `${formatEuro(customer.hourlyRateCents)} / Std.`}
            </DetailRow>
          </dl>
        )}
        <Link href={`/analytics/report?customer=${customer.id}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-pine">
          {t("customers.report")}
        </Link>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg">{t("customers.projects")}</h3>
          <Link href="/projects" className="inline-flex min-h-11 items-center text-sm font-medium text-pine">
            {t("customers.openProjects")}
          </Link>
        </div>
        {data.projects.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("customers.noProjects")}</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {data.projects.map((project) => (
              <li key={project.id} className="rounded-xl border border-line bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="font-medium">{project.name}</span>
                  <Pill tone={project.status}>{label(project.status)}</Pill>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {project.endedOn
                    ? t("customers.projectPeriod", { start: formatDate(project.startedOn), end: formatDate(project.endedOn) })
                    : t("customers.projectSince", { start: formatDate(project.startedOn) })}
                  {" · "}
                  {t("customers.booked", { duration: formatDuration(project.minutes) })}
                </p>
                {project.taskCount > 0 ? (
                  <p className="mt-1 text-xs text-muted">
                    {t("customers.projectTasks", { open: project.openTasks, total: project.taskCount })}
                    {project.openDeliverables > 0
                      ? ` · ${t("customers.openDeliverables", { count: project.openDeliverables })}`
                      : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="text-lg">{t("customers.time")}</h3>
        {data.entries.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("customers.noTime")}</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              {t("customers.timeTotal", {
                duration: formatDuration(totals.minutes),
                billable: formatDuration(totals.billableMinutes),
              })}
            </p>
            <ul className="mt-3 grid gap-2">
              {data.entries.map((entry) => (
                <li key={entry.id} className="rounded-xl border border-line bg-white p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/time?week=${entry.entryDate}`} className="text-sm font-medium text-pine">
                      {formatDate(entry.entryDate)}
                      {entry.memo ? ` · ${entry.memo}` : ""}
                    </Link>
                    <span className="font-mono text-sm tabular-nums">{formatDuration(entry.minutes)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {entry.projectName || t("customers.noProject")}
                    {entry.employeeName ? ` · ${entry.employeeName}` : ""}
                    {" · "}
                    {entry.billable ? t("customers.billable") : t("customers.notBillable")}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg">{t("customers.invoices")}</h3>
          <Link href="/invoices" className="inline-flex min-h-11 items-center text-sm font-medium text-pine">
            {t("customers.openInvoices")}
          </Link>
        </div>
        {data.invoices.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("customers.noInvoices")}</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {data.invoices.map((invoice) => (
              <li key={invoice.id}>
                <Link
                  href={`/invoices/${invoice.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-3 hover:border-ink"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{invoice.number ?? t("common.draft")}</span>
                    <span className="block text-xs text-muted">
                      {t("invoices.issued", { date: formatDate(invoice.issueDate) })}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <Money cents={invoice.grossCents} />
                    <Pill tone={invoice.displayStatus}>{label(invoice.displayStatus)}</Pill>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CustomerDetailPanel({
  customer,
  variant,
  onClose,
}: {
  customer: Customer;
  variant: "inline" | "overlay";
  onClose: () => void;
}) {
  const query = useView<CustomerDetail>(queryKeys.customer(customer.id), viewPath.customer(customer.id));
  const { t } = useI18n();
  const subtitle = [customer.city, customer.country].filter(Boolean).join(", ");
  return (
    <SidePanel variant={variant} title={customer.name} subtitle={subtitle || undefined} onClose={onClose}>
      {query.isError ? (
        <p role="alert" className="text-sm text-clay">
          {query.error.message === "not-found" ? t("error.notFound") : t("error.refresh")}
        </p>
      ) : query.data ? (
        <CustomerDetails data={query.data} />
      ) : (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      )}
    </SidePanel>
  );
}

function SortHeader({
  label,
  column,
  sort,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  column: CustomerSortKey;
  sort: CustomerSortKey;
  direction: SortDirection;
  onSort: (column: CustomerSortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort === column;
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={`px-3 py-2 font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex min-h-9 items-center gap-1 rounded hover:text-ink ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        <span aria-hidden="true" className={active ? "text-pine" : "text-line"}>
          {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function CustomersBody({ data }: { data: Customers }) {
  const { t } = useI18n();
  const mode = useDetailSidebarMode("customers");
  const wide = useWideLayout();
  const inline = mode === "inline" && wide;
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [relationship, setRelationship] = useState<CustomerRelationship>("all");
  const [sort, setSort] = useState<{ key: CustomerSortKey; direction: SortDirection }>({
    key: DEFAULT_CUSTOMER_SORT,
    direction: defaultCustomerDirection(DEFAULT_CUSTOMER_SORT),
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const countries = useMemo(
    () => [...new Set(data.customers.map((customer) => customer.country).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
    [data.customers],
  );
  const filtered = useMemo(
    () => filterCustomers(data.customers, { query: search, country, relationship }),
    [country, data.customers, relationship, search],
  );
  const sorted = useMemo(() => sortCustomers(filtered, sort.key, sort.direction), [filtered, sort]);
  const selected = selectedId === null ? null : data.customers.find((customer) => customer.id === selectedId) ?? null;
  const activeFilters = Boolean(search.trim() || country || relationship !== "all");

  const closeCustomer = useCallback(() => {
    setSelectedId(null);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }, []);

  useEffect(() => {
    const match = /^#customer-(\d+)$/.exec(window.location.hash);
    if (!match) return;
    const id = Number(match[1]);
    if (data.customers.some((customer) => customer.id === id)) setSelectedId(id);
  }, [data.customers]);

  function openCustomer(id: number) {
    setSelectedId(id);
    window.history.replaceState(null, "", `#customer-${id}`);
  }

  function resetFilters() {
    setSearch("");
    setCountry("");
    setRelationship("all");
  }

  function changeSort(column: CustomerSortKey) {
    setSort((current) =>
      current.key === column
        ? { key: column, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key: column, direction: defaultCustomerDirection(column) },
    );
  }

  function relationshipLabel(value: CustomerRelationship): string {
    switch (value) {
      case "withProjects":
        return t("customers.filterWithProjects");
      case "withoutProjects":
        return t("customers.filterWithoutProjects");
      case "withInvoices":
        return t("customers.filterWithInvoices");
      case "withoutInvoices":
        return t("customers.filterWithoutInvoices");
      default:
        return t("customers.filterAll");
    }
  }

  const content = (
    <>
      <PageHeader
        title={t("customers.title")}
        lede={t("customers.lede")}
        info={<InfoButton topic="customers" />}
        action={
          <AddSheet label={t("customers.add")} title={t("customers.add")}>
            <ActionForm action={saveCustomer} resetOnSuccess>
              <CustomerFields />
              <SubmitButton>{t("customers.add")}</SubmitButton>
            </ActionForm>
          </AddSheet>
        }
      />
      {data.customers.length === 0 ? <Empty>{t("customers.empty")}</Empty> : null}
      {data.customers.length > 0 ? (
        <Card className="mb-3">
          <div role="group" aria-label={t("customers.filterLabel")} className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Field label={t("customers.filterSearch")}>
              <TextInput
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("customers.filterSearchPlaceholder")}
              />
            </Field>
            <Field label={t("customers.filterCountry")}>
              <SelectInput value={country} onChange={(event) => setCountry(event.target.value)}>
                <option value="">{t("customers.filterAllCountries")}</option>
                {countries.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t("customers.filterRelationship")}>
              <SelectInput value={relationship} onChange={(event) => setRelationship(event.target.value as CustomerRelationship)}>
                {CUSTOMER_RELATIONSHIPS.map((value) => (
                  <option key={value} value={value}>{relationshipLabel(value)}</option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted" aria-live="polite">
              {t("customers.filterResult", { shown: filtered.length, total: data.customers.length })}
            </p>
            {activeFilters ? (
              <button type="button" onClick={resetFilters} className="text-sm font-medium text-pine underline-offset-4 hover:underline">
                {t("customers.filterReset")}
              </button>
            ) : null}
          </div>
        </Card>
      ) : null}
      {data.customers.length > 0 && filtered.length === 0 ? <Empty>{t("customers.filterEmpty")}</Empty> : null}
      {filtered.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
              <tr>
                <SortHeader label={t("customers.tableCustomer")} column="name" sort={sort.key} direction={sort.direction} onSort={changeSort} />
                <SortHeader label={t("customers.tableCity")} column="city" sort={sort.key} direction={sort.direction} onSort={changeSort} />
                <SortHeader label={t("customers.tableProjects")} column="projectCount" sort={sort.key} direction={sort.direction} onSort={changeSort} align="right" />
                <SortHeader label={t("customers.tableTime")} column="minutes" sort={sort.key} direction={sort.direction} onSort={changeSort} align="right" />
                <SortHeader label={t("customers.tableInvoices")} column="invoiceCount" sort={sort.key} direction={sort.direction} onSort={changeSort} align="right" />
                <SortHeader label={t("customers.tableRevenue")} column="revenueCents" sort={sort.key} direction={sort.direction} onSort={changeSort} align="right" />
                <SortHeader label={t("customers.tableOpen")} column="openCents" sort={sort.key} direction={sort.direction} onSort={changeSort} align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((customer) => (
                <tr
                  key={customer.id}
                  id={`customer-${customer.id}`}
                  onClick={() => openCustomer(customer.id)}
                  className={`cursor-pointer border-b border-line/70 transition last:border-0 hover:bg-pine/5 ${selectedId === customer.id ? "bg-pine/5" : ""}`}
                >
                  <td className="px-3 py-3 align-top">
                    <button
                      type="button"
                      className="block text-left font-medium text-pine underline-offset-4 hover:underline"
                      aria-label={t("customers.openDetails", { name: customer.name })}
                      onClick={(event) => {
                        event.stopPropagation();
                        openCustomer(customer.id);
                      }}
                    >
                      {customer.name}
                    </button>
                    <span className="mt-0.5 block max-w-[16rem] truncate text-xs text-muted">
                      {customer.email || customer.buyerReference || t("customers.noValue")}
                    </span>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <span className="block">{customer.city || t("customers.noValue")}</span>
                    <span className="mt-0.5 block text-xs text-muted">{customer.country || t("customers.noValue")}</span>
                  </td>
                  <td className="px-3 py-3 text-right align-top font-mono tabular-nums">{customer.projectCount}</td>
                  <td className="px-3 py-3 text-right align-top">
                    <span className="block font-mono tabular-nums">{formatDuration(customer.minutes)}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {t("customers.billableHint", { duration: formatDuration(customer.billableMinutes) })}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right align-top font-mono tabular-nums">{customer.invoiceCount}</td>
                  <td className="px-3 py-3 text-right align-top"><Money cents={customer.revenueCents} /></td>
                  <td className="px-3 py-3 text-right align-top"><Money cents={customer.openCents} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );

  if (inline && selected) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">{content}</div>
        <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <CustomerDetailPanel key={selected.id} customer={selected} variant="inline" onClose={closeCustomer} />
        </aside>
      </div>
    );
  }

  return (
    <>
      {content}
      {selected ? <CustomerDetailPanel key={selected.id} customer={selected} variant="overlay" onClose={closeCustomer} /> : null}
    </>
  );
}

export function CustomersScreen() {
  const query = useView<Customers>(queryKeys.customers, viewPath.customers);
  return (
    <ViewGate query={query}>
      {(data) => <CustomersBody data={data} />}
    </ViewGate>
  );
}