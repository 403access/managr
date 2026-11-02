"use client";

import Link from "next/link";
import { saveCustomer } from "@/server/actions";
import type { invoicesView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { Tab, Tabs } from "@/components/tabs";
import { Card, Empty, Field, LinkButton, Money, PageHeader, Pill, TextInput } from "@/components/ui";

type Invoices = ReturnType<typeof invoicesView>;

export function InvoicesScreen() {
  const query = useView<Invoices>(queryKeys.invoices, viewPath.invoices);
  const { t, label } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader title={t("invoices.title")} lede={t("invoices.lede")} action={<LinkButton href="/invoices/new">{t("invoices.new")}</LinkButton>} />
          <Tabs label={t("tabs.sections")}>
          <Tab id="list" label={t("invoices.title")}>
          {data.invoices.length === 0 ? (
            <Empty>{t("invoices.empty")}</Empty>
          ) : (
            <div className="grid gap-2">
              {data.invoices.map((invoice) => (
                <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 sm:grid-cols-[8rem_1fr_auto_auto]">
                  <span className="text-sm font-medium">{invoice.number ?? t("common.draft")}</span>
                  <span>
                    <span className="block text-sm">{invoice.customerName}</span>
                    <span className="text-xs text-muted">{t("invoices.due", { date: formatDate(invoice.dueDate) })}</span>
                  </span>
                  <Money cents={invoice.grossCents} />
                  <Pill tone={invoice.displayStatus}>{label(invoice.displayStatus)}</Pill>
                </Link>
              ))}
            </div>
          )}
          </Tab>
          <Tab id="customers" label={t("invoices.customers")}>
            <div className="grid gap-2">
              {data.customers.map((customer) => (
                <Card key={customer.id}>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-sm text-muted">
                    {customer.street}, {customer.postalCode} {customer.city}
                  </p>
                  <ActionForm action={saveCustomer} className="mt-3 grid gap-3">
                    <input type="hidden" name="id" value={customer.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={t("common.name")}><TextInput name="name" defaultValue={customer.name} /></Field>
                      <Field label={t("common.email")}><TextInput name="email" defaultValue={customer.email} /></Field>
                      <Field label={t("common.street")}><TextInput name="street" defaultValue={customer.street} /></Field>
                      <Field label={t("common.postal")}><TextInput name="postalCode" defaultValue={customer.postalCode} /></Field>
                      <Field label={t("common.city")}><TextInput name="city" defaultValue={customer.city} /></Field>
                      <Field label={t("common.country")}><TextInput name="country" defaultValue={customer.country} /></Field>
                      <Field label={t("company.vatId")}><TextInput name="vatId" defaultValue={customer.vatId} /></Field>
                      <Field label={t("invoices.buyerReference")} hint={t("invoices.buyerReferenceHint")}>
                        <TextInput name="buyerReference" defaultValue={customer.buyerReference} maxLength={100} />
                      </Field>
                    </div>
                    <SubmitButton tone="quiet">{t("invoices.saveCustomer")}</SubmitButton>
                  </ActionForm>
                </Card>
              ))}
            </div>
            <Card className="mt-3">
              <ActionForm action={saveCustomer} resetOnSuccess>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("common.name")}><TextInput name="name" /></Field>
                  <Field label={t("common.email")}><TextInput name="email" /></Field>
                  <Field label={t("common.street")}><TextInput name="street" /></Field>
                  <Field label={t("common.postal")}><TextInput name="postalCode" /></Field>
                  <Field label={t("common.city")}><TextInput name="city" /></Field>
                  <Field label={t("common.country")}><TextInput name="country" defaultValue="Deutschland" /></Field>
                  <Field label={t("company.vatId")}><TextInput name="vatId" /></Field>
                  <Field label={t("invoices.buyerReference")} hint={t("invoices.buyerReferenceHint")}>
                    <TextInput name="buyerReference" maxLength={100} />
                  </Field>
                </div>
                <SubmitButton>{t("invoices.addCustomer")}</SubmitButton>
              </ActionForm>
            </Card>
          </Tab>
          </Tabs>
        </>
      )}
    </ViewGate>
  );
}
