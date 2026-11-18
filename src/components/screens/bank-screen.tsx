"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { disconnectBank, saveBankConnection, syncBank } from "@/server/actions";
import type { bankView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { formatEuro } from "@/domain/money";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Disclaimer, Empty, Field, PageHeader, Pill, SelectInput, Stat, TextInput } from "@/components/ui";

type Bank = ReturnType<typeof bankView>;
type Account = Bank["accounts"][number];
type Transaction = Bank["transactions"][number];

const STATUSES = ["completed", "pending", "declined", "reversed"] as const;

function timestamp(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function signedEuro(cents: number): string {
  return `${cents > 0 ? "+" : ""}${formatEuro(cents)}`;
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function yearLinkClass(active: boolean): string {
  return `inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium ${
    active ? "bg-pine text-paper" : "border border-line bg-card text-ink hover:border-ink"
  }`;
}

function ConnectForm({ connection }: { connection: Bank["connection"] }) {
  const { t } = useI18n();
  return (
    <ActionForm action={saveBankConnection}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("bank.login")} hint={t("bank.loginHint")}>
          <TextInput name="login" defaultValue={connection?.login ?? ""} autoComplete="off" required />
        </Field>
        <Field
          label={t("bank.secretKey")}
          hint={
            connection
              ? `${t("bank.secretStored", { hint: connection.secretHint })} ${t("bank.keepSecret")}`
              : t("bank.secretHint")
          }
        >
          <TextInput
            type="password"
            name="secretKey"
            placeholder={connection?.secretHint ?? ""}
            autoComplete="new-password"
            required={!connection}
          />
        </Field>
        <Field label={t("bank.environment")}>
          <SelectInput name="environment" defaultValue={connection?.environment ?? "production"}>
            <option value="production">{t("bank.environmentProduction")}</option>
            <option value="sandbox">{t("bank.environmentSandbox")}</option>
          </SelectInput>
        </Field>
        <Field label={t("bank.stagingToken")} hint={t("bank.stagingTokenHint")}>
          <TextInput
            type="password"
            name="stagingToken"
            placeholder={connection?.stagingTokenSet ? "••••" : ""}
            autoComplete="off"
          />
        </Field>
      </div>
      <SubmitButton pendingLabel={t("bank.syncing")}>
        {connection ? t("bank.saveConnection") : t("bank.connect")}
      </SubmitButton>
    </ActionForm>
  );
}

function ConnectCard() {
  const { t } = useI18n();
  return (
    <Card>
      <h2 className="text-2xl">{t("bank.connectTitle")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{t("bank.connectLede")}</p>
      <ol className="mt-3 grid gap-1 text-sm leading-relaxed">
        <li>1. {t("bank.connectStep1")}</li>
        <li>2. {t("bank.connectStep2")}</li>
        <li>3. {t("bank.connectStep3")}</li>
      </ol>
      <div className="mt-4">
        <ConnectForm connection={null} />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted">{t("bank.connectNote")}</p>
    </Card>
  );
}

function AccountCard({ account }: { account: Account }) {
  const { t } = useI18n();
  const updated = timestamp(account.updatedAt);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{account.name}</p>
          {account.iban ? <p className="mt-1 font-mono text-xs text-muted">{account.iban}</p> : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {account.main ? <Pill tone="main">{t("bank.main")}</Pill> : null}
          {account.status === "closed" ? <Pill tone="closed">{t("bank.closed")}</Pill> : null}
          {account.external ? <Pill tone="external">{t("bank.external")}</Pill> : null}
        </div>
      </div>
      <p className="mt-3 font-mono text-2xl tabular-nums">{formatEuro(account.balanceCents)}</p>
      <p className="mt-1 text-xs text-muted">
        {t("bank.authorizedBalance")}: {formatEuro(account.authorizedBalanceCents)}
      </p>
      {account.bic ? <p className="mt-1 font-mono text-xs text-muted">BIC {account.bic}</p> : null}
      {updated ? <p className="mt-1 text-xs text-muted">{t("bank.updatedAt", { when: updated })}</p> : null}
    </Card>
  );
}

function TransactionRow({ row }: { row: Transaction }) {
  const { t, label } = useI18n();
  const category = row.cashflowSubcategory || row.cashflowCategory || (row.category ? humanize(row.category) : "");
  const purposes = [row.reference, row.note].filter(
    (value, index, all) => Boolean(value) && value !== row.counterpartyName && value !== row.label && all.indexOf(value) === index,
  );
  const rate =
    row.vatRateBps === null
      ? ""
      : row.vatRateBps < 0
        ? t("bank.vatUncategorized")
        : t("bank.vat", {
            rate: `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(row.vatRateBps / 100)} %`,
          });
  const vat = rate ? (row.vatAmountCents === null ? rate : `${rate} · ${formatEuro(row.vatAmountCents)}`) : "";
  return (
    <li className="rounded-xl border border-line bg-white px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{row.counterpartyName || row.label || t("bank.counterparty")}</p>
          <p className="mt-1 text-xs text-muted">
            {formatDate(row.bookedOn)} · {row.accountName}
          </p>
        </div>
        <p className={`shrink-0 font-mono text-sm tabular-nums ${row.amountCents < 0 ? "text-clay" : "text-moss"}`}>
          {signedEuro(row.amountCents)}
        </p>
      </div>
      {purposes.length > 0 ? <p className="mt-2 text-xs leading-relaxed text-muted">{purposes.join(" · ")}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <Pill tone={row.status}>{label(row.status)}</Pill>
        {category ? <span className="rounded-full bg-ink/5 px-2 py-0.5 text-muted">{category}</span> : null}
        {vat ? <span className="text-muted">{vat}</span> : null}
        {row.attachmentCount > 0 ? (
          <span className="text-muted">
            {row.attachmentCount === 1 ? t("bank.attachment") : t("bank.attachments", { count: row.attachmentCount })}
          </span>
        ) : null}
        {row.cardLastDigits ? <span className="text-muted">{t("bank.card", { digits: row.cardLastDigits })}</span> : null}
      </div>
    </li>
  );
}

function ConnectionCard({ connection }: { connection: NonNullable<Bank["connection"]> }) {
  const { t } = useI18n();
  const synced = timestamp(connection.lastSyncedAt);
  const environment =
    connection.environment === "sandbox" ? t("bank.environmentSandbox") : t("bank.environmentProduction");
  return (
    <Card className="mt-6">
      <details>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
          <span>
            <span className="block text-lg font-medium">{t("bank.settings")}</span>
            <span className="mt-1 block text-xs text-muted">
              {connection.orgName || connection.label} · {connection.login} · {environment}
            </span>
          </span>
          <span className="text-sm font-medium text-pine">{t("bank.settingsEdit")}</span>
        </summary>
        <div className="mt-4 grid gap-4">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">{t("bank.organization")}</dt>
              <dd>{connection.orgName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("bank.lastSync")}</dt>
              <dd>{synced ?? t("bank.neverSynced")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("bank.login")}</dt>
              <dd className="font-mono text-xs">{connection.login}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{t("bank.secretKey")}</dt>
              <dd className="font-mono text-xs">{connection.secretHint}</dd>
            </div>
          </dl>
          <ConnectForm connection={connection} />
          <ActionForm action={disconnectBank} compact confirm={t("bank.disconnectConfirm")}>
            <SubmitButton tone="danger">{t("bank.disconnect")}</SubmitButton>
          </ActionForm>
        </div>
      </details>
    </Card>
  );
}

function BankBody({ data }: { data: Bank }) {
  const { t, tx, label } = useI18n();
  const [accountId, setAccountId] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.transactions.filter((row) => {
      if (accountId !== "all" && String(row.accountId) !== accountId) return false;
      if (status !== "all" && row.status !== status) return false;
      if (!needle) return true;
      return [
        row.counterpartyName,
        row.label,
        row.reference,
        row.note,
        row.accountName,
        row.cashflowCategory,
        row.cashflowSubcategory,
        row.category,
        row.operationType,
        formatEuro(row.amountCents),
        String(row.amountCents),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [accountId, data.transactions, search, status]);

  const groups = useMemo(() => {
    const byDate = new Map<string, Transaction[]>();
    for (const row of rows) {
      const list = byDate.get(row.bookedOn) ?? [];
      list.push(row);
      byDate.set(row.bookedOn, list);
    }
    return [...byDate.entries()];
  }, [rows]);

  const synced = timestamp(data.connection?.lastSyncedAt ?? null);
  const range = data.all ? t("bank.allYears") : String(data.year);
  const filtered = Boolean(search.trim() || accountId !== "all" || status !== "all");

  function resetFilters() {
    setAccountId("all");
    setStatus("all");
    setSearch("");
  }

  if (!data.connection) {
    return (
      <>
        <PageHeader title={t("bank.title")} lede={t("bank.lede")} />
        <ConnectCard />
        <div className="mt-4">
          <Disclaimer>{t("bank.readOnly")}</Disclaimer>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("bank.title")}
        lede={t("bank.lede")}
        action={
          <div className="grid justify-items-end gap-1">
            <ActionForm action={syncBank} compact>
              <SubmitButton pendingLabel={t("bank.syncing")}>{t("bank.sync")}</SubmitButton>
            </ActionForm>
            <p className="text-xs text-muted">{synced ? t("bank.syncedAt", { when: synced }) : t("bank.neverSynced")}</p>
          </div>
        }
      />

      {data.connection.lastError ? (
        <Card className="mb-4 border-clay/40 bg-clay/5">
          <p role="alert" className="text-sm text-clay">
            {t("bank.connectionError", { error: tx(data.connection.lastError) })}
          </p>
          <p className="mt-1 text-xs text-muted">{t("bank.connectionErrorHint")}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={t("bank.total")}
          value={formatEuro(data.totals.balanceCents)}
          hint={t("bank.totalHint", { active: data.totals.activeCount, count: data.totals.accountCount })}
        />
        <Stat label={t("bank.available")} value={formatEuro(data.totals.authorizedBalanceCents)} hint={t("bank.availableHint")} />
        <Stat label={t("bank.inflow")} value={formatEuro(data.summary.inflowCents)} hint={range} />
        <Stat
          label={t("bank.outflow")}
          value={formatEuro(data.summary.outflowCents)}
          hint={t("bank.movementHint", { count: data.summary.completedCount, net: formatEuro(data.summary.netCents) })}
        />
      </div>

      <section className="mt-6">
        <h2 className="mb-3 text-2xl">{t("bank.accounts")}</h2>
        {data.accounts.length === 0 ? (
          <Empty>{t("bank.noAccounts")}</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl">{t("bank.transactions")}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t("bank.transactionsLede")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.years.map((year) => (
              <Link
                key={year}
                href={`/bank?year=${year}`}
                aria-current={!data.all && data.year === year ? "page" : undefined}
                className={yearLinkClass(!data.all && data.year === year)}
              >
                {year}
              </Link>
            ))}
            <Link
              href="/bank?all=1"
              aria-current={data.all ? "page" : undefined}
              className={yearLinkClass(data.all)}
            >
              {t("bank.allYears")}
            </Link>
          </div>
        </div>

        <Card>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)]">
            <Field label={t("bank.filterAccount")}>
              <SelectInput value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                <option value="all">{t("bank.filterAllAccounts")}</option>
                {data.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t("bank.filterStatus")}>
              <SelectInput value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">{t("bank.filterAllStatuses")}</option>
                {STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {label(item)}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label={t("bank.filterSearch")}>
              <TextInput
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("bank.filterSearchPlaceholder")}
              />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted" aria-live="polite">
              {t("bank.filterResult", { shown: rows.length, total: data.transactions.length })}
            </p>
            {filtered ? (
              <button
                type="button"
                onClick={resetFilters}
                className="min-h-11 text-sm font-medium text-pine underline-offset-4 hover:underline"
              >
                {t("bank.filterReset")}
              </button>
            ) : null}
          </div>
          {data.truncated ? <p className="mt-2 text-xs leading-relaxed text-amber">{t("bank.truncated")}</p> : null}

          {data.transactions.length === 0 ? (
            <div className="mt-4">
              <Empty>{t("bank.empty")}</Empty>
            </div>
          ) : rows.length === 0 ? (
            <div className="mt-4">
              <Empty>{t("bank.filterEmpty")}</Empty>
            </div>
          ) : (
            <div className="mt-4 grid gap-4">
              {groups.map(([date, items]) => (
                <section key={date}>
                  <h3 className="mb-2 font-mono text-xs tracking-wide text-muted uppercase">{formatDate(date)}</h3>
                  <ul className="grid gap-2">
                    {items.map((row) => (
                      <TransactionRow key={row.id} row={row} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Card>
      </section>

      <ConnectionCard connection={data.connection} />
      <div className="mt-4">
        <Disclaimer>{t("bank.readOnly")}</Disclaimer>
      </div>
    </>
  );
}

export function BankScreen({ year, all }: { year: number; all: boolean }) {
  const query = useView<Bank>(queryKeys.bank(year, all), viewPath.bank(year, all));
  return <ViewGate query={query}>{(data) => <BankBody data={data} />}</ViewGate>;
}