"use client";

import Link from "next/link";
import { saveCustomer } from "@/server/actions";
import type { invoicesView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Empty, Field, LinkButton, Money, PageHeader, Pill, Section, TextInput } from "@/components/ui";

type Invoices = ReturnType<typeof invoicesView>;

export function InvoicesScreen() {
  const query = useView<Invoices>(queryKeys.invoices, viewPath.invoices);
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader title="Invoices" lede="Drafts stay unnumbered. Issuing assigns the next number and posts the receivable." action={<LinkButton href="/invoices/new">New invoice</LinkButton>} />
          {data.invoices.length === 0 ? (
            <Empty>No invoices yet.</Empty>
          ) : (
            <div className="grid gap-2">
              {data.invoices.map((invoice) => (
                <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3 sm:grid-cols-[8rem_1fr_auto_auto]">
                  <span className="text-sm font-medium">{invoice.number ?? "Draft"}</span>
                  <span>
                    <span className="block text-sm">{invoice.customerName}</span>
                    <span className="text-xs text-muted">Due {formatDate(invoice.dueDate)}</span>
                  </span>
                  <Money cents={invoice.grossCents} />
                  <Pill tone={invoice.displayStatus}>{invoice.displayStatus}</Pill>
                </Link>
              ))}
            </div>
          )}
          <Section title="Customers">
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
                      <Field label="Name"><TextInput name="name" defaultValue={customer.name} /></Field>
                      <Field label="Email"><TextInput name="email" defaultValue={customer.email} /></Field>
                      <Field label="Street"><TextInput name="street" defaultValue={customer.street} /></Field>
                      <Field label="Postal code"><TextInput name="postalCode" defaultValue={customer.postalCode} /></Field>
                      <Field label="City"><TextInput name="city" defaultValue={customer.city} /></Field>
                      <Field label="Country"><TextInput name="country" defaultValue={customer.country} /></Field>
                      <Field label="VAT id"><TextInput name="vatId" defaultValue={customer.vatId} /></Field>
                    </div>
                    <SubmitButton tone="quiet">Save customer</SubmitButton>
                  </ActionForm>
                </Card>
              ))}
            </div>
            <Card className="mt-3">
              <ActionForm action={saveCustomer} resetOnSuccess>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name"><TextInput name="name" /></Field>
                  <Field label="Email"><TextInput name="email" /></Field>
                  <Field label="Street"><TextInput name="street" /></Field>
                  <Field label="Postal code"><TextInput name="postalCode" /></Field>
                  <Field label="City"><TextInput name="city" /></Field>
                  <Field label="Country"><TextInput name="country" defaultValue="Deutschland" /></Field>
                  <Field label="VAT id"><TextInput name="vatId" /></Field>
                </div>
                <SubmitButton>Add customer</SubmitButton>
              </ActionForm>
            </Card>
          </Section>
        </>
      )}
    </ViewGate>
  );
}
