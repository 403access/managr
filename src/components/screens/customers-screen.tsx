"use client";

import { saveCustomer } from "@/server/actions";
import type { customersView } from "@/server/views";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Empty, Field, PageHeader, TextInput } from "@/components/ui";

type Customers = ReturnType<typeof customersView>;
type Customer = Customers["customers"][number];

function CustomerFields({ customer }: { customer?: Customer }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t("common.name")}><TextInput name="name" defaultValue={customer?.name} /></Field>
      <Field label={t("common.email")}><TextInput name="email" defaultValue={customer?.email} /></Field>
      <Field label={t("common.street")}><TextInput name="street" defaultValue={customer?.street} /></Field>
      <Field label={t("common.postal")}><TextInput name="postalCode" defaultValue={customer?.postalCode} /></Field>
      <Field label={t("common.city")}><TextInput name="city" defaultValue={customer?.city} /></Field>
      <Field label={t("common.country")}><TextInput name="country" defaultValue={customer?.country ?? "Deutschland"} /></Field>
      <Field label={t("company.vatId")}><TextInput name="vatId" defaultValue={customer?.vatId} /></Field>
      <Field label={t("invoices.buyerReference")} hint={t("invoices.buyerReferenceHint")}>
        <TextInput name="buyerReference" defaultValue={customer?.buyerReference} maxLength={100} />
      </Field>
    </div>
  );
}

export function CustomersScreen() {
  const query = useView<Customers>(queryKeys.customers, viewPath.customers);
  const { t } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader title={t("customers.title")} lede={t("customers.lede")} />
          {data.customers.length === 0 ? <Empty>{t("customers.empty")}</Empty> : null}
          <div className="grid gap-3 xl:grid-cols-2">
            {data.customers.map((customer) => (
              <Card key={customer.id}>
                <p className="font-medium">{customer.name}</p>
                <p className="text-sm text-muted">
                  {customer.street}, {customer.postalCode} {customer.city}
                </p>
                <ActionForm action={saveCustomer} className="mt-3 grid gap-3">
                  <input type="hidden" name="id" value={customer.id} />
                  <CustomerFields customer={customer} />
                  <SubmitButton tone="quiet">{t("customers.save")}</SubmitButton>
                </ActionForm>
              </Card>
            ))}
          </div>
          <Card className="mt-3">
            <ActionForm action={saveCustomer} resetOnSuccess>
              <CustomerFields />
              <SubmitButton>{t("customers.add")}</SubmitButton>
            </ActionForm>
          </Card>
        </>
      )}
    </ViewGate>
  );
}
