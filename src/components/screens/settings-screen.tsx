"use client";

import { deleteInvoiceTemplate, saveInvoiceTemplate, saveSettings } from "@/server/actions";
import type { settingsView } from "@/server/views";
import { DEFAULT_INVOICE_TEMPLATE, type InvoiceLetter } from "@/domain/invoice-letter";
import { DETAIL_PAGE_KEYS, resolveDetailSidebarMode, type DetailPageKey, type DetailSidebarMode } from "@/domain/settings";
import type { MessageKey } from "@/i18n";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { euroInput } from "@/components/amounts";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Field, PageHeader, SelectInput, TextArea, TextInput } from "@/components/ui";

type Settings = ReturnType<typeof settingsView>;

const PAGE_LABELS: Record<DetailPageKey, MessageKey> = {
  customers: "nav.customers",
  time: "nav.time",
  obligations: "nav.dates",
  company: "nav.company",
  ledger: "nav.ledger",
  projects: "nav.projects",
  documents: "nav.documents",
  legal: "nav.legal",
  milestones: "nav.milestones",
  assistant: "nav.assistant",
};

function pageLabel(t: (key: MessageKey) => string, page: DetailPageKey): string {
  return t(PAGE_LABELS[page]);
}

function modeLabel(t: (key: MessageKey) => string, mode: DetailSidebarMode): string {
  return mode === "inline" ? t("settings.modeInline") : t("settings.modeOverlay");
}

/** The letter fields shared by the new and the edit form of a template. */
function TemplateFields({ defaults }: { defaults: InvoiceLetter }) {
  const { t } = useI18n();
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("invoices.letterSubject")}>
          <TextInput name="subject" defaultValue={defaults.subject} maxLength={200} />
        </Field>
        <Field label={t("invoices.letterSalutation")}>
          <TextInput name="salutation" defaultValue={defaults.salutation} maxLength={300} />
        </Field>
      </div>
      <Field label={t("invoices.letterIntro")} hint={t("settings.templatesPlaceholders")}>
        <TextArea name="intro" defaultValue={defaults.intro} maxLength={2000} />
      </Field>
      <Field label={t("invoices.letterPayment")} hint={t("settings.templatesPlaceholders")}>
        <TextArea name="payment" defaultValue={defaults.payment} maxLength={1000} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("invoices.letterClosing")}>
          <TextArea compact name="closing" defaultValue={defaults.closing} maxLength={1000} />
        </Field>
        <Field label={t("invoices.letterSignature")}>
          <TextArea compact name="signature" defaultValue={defaults.signature} maxLength={300} />
        </Field>
      </div>
    </>
  );
}

export function SettingsScreen() {
  const query = useView<Settings>(queryKeys.settings, viewPath.settings);
  const { t } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader title={t("settings.title")} lede={t("settings.lede")} />
          <ActionForm action={saveSettings} className="grid gap-4">
            <Card>
              <h2 className="text-xl">{t("rates.settingsTitle")}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t("rates.settingsLede")}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label={t("rates.global")} hint={t("rates.globalHint")}>
                  <TextInput
                    name="hourlyRate"
                    inputMode="decimal"
                    placeholder="95,00"
                    defaultValue={data.hourlyRateCents === null ? "" : euroInput(data.hourlyRateCents)}
                  />
                </Field>
              </div>
            </Card>

            <Card>
              <h2 className="text-xl">{t("settings.sidebarTitle")}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t("settings.sidebarLede")}</p>
              <fieldset className="mt-4 grid gap-2">
                <legend className="mb-1 text-sm font-medium">{t("settings.global")}</legend>
                <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-3">
                  <input
                    type="radio"
                    name="detailSidebarMode"
                    value="inline"
                    defaultChecked={data.settings.detailSidebarMode === "inline"}
                    className="mt-1 size-4 accent-pine"
                  />
                  <span>
                    <span className="block text-sm font-medium">{t("settings.modeInline")}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{t("settings.modeInlineHint")}</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-3">
                  <input
                    type="radio"
                    name="detailSidebarMode"
                    value="overlay"
                    defaultChecked={data.settings.detailSidebarMode === "overlay"}
                    className="mt-1 size-4 accent-pine"
                  />
                  <span>
                    <span className="block text-sm font-medium">{t("settings.modeOverlay")}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{t("settings.modeOverlayHint")}</span>
                  </span>
                </label>
              </fieldset>
            </Card>

            <Card>
              <h2 className="text-xl">{t("settings.pagesTitle")}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t("settings.pagesLede")}</p>
              <div className="mt-4 grid gap-3">
                {DETAIL_PAGE_KEYS.map((page) => {
                  const effective = resolveDetailSidebarMode(data.settings, page);
                  return (
                    <div
                      key={page}
                      className="grid gap-3 rounded-xl border border-line bg-white p-3 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center"
                    >
                      <div>
                        <p className="font-medium">{pageLabel(t, page)}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {t("settings.pageEffective", { mode: modeLabel(t, effective) })}
                        </p>
                      </div>
                      <Field label={t("settings.pageSetting")}>
                        <SelectInput name={`page.${page}`} defaultValue={data.settings.detailSidebarOverrides[page] ?? ""}>
                          <option value="">{t("settings.pageGlobal")}</option>
                          <option value="inline">{t("settings.modeInline")}</option>
                          <option value="overlay">{t("settings.modeOverlay")}</option>
                        </SelectInput>
                      </Field>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <h2 className="text-xl">{t("settings.linesTitle")}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{t("settings.linesLede")}</p>
              <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
                <legend className="mb-1 text-sm font-medium">{t("settings.linesOrder")}</legend>
                <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-3">
                  <input
                    type="radio"
                    name="invoiceLineOrder"
                    value="newestFirst"
                    defaultChecked={data.settings.invoiceLineOrder === "newestFirst"}
                    className="mt-1 size-4 accent-pine"
                  />
                  <span>
                    <span className="block text-sm font-medium">{t("settings.linesNewest")}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{t("settings.linesNewestHint")}</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-3">
                  <input
                    type="radio"
                    name="invoiceLineOrder"
                    value="oldestFirst"
                    defaultChecked={data.settings.invoiceLineOrder === "oldestFirst"}
                    className="mt-1 size-4 accent-pine"
                  />
                  <span>
                    <span className="block text-sm font-medium">{t("settings.linesOldest")}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{t("settings.linesOldestHint")}</span>
                  </span>
                </label>
              </fieldset>
              <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
                <legend className="mb-1 text-sm font-medium">{t("settings.linesGrouping")}</legend>
                <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-3">
                  <input
                    type="radio"
                    name="invoiceLineGrouping"
                    value="none"
                    defaultChecked={data.settings.invoiceLineGrouping === "none"}
                    className="mt-1 size-4 accent-pine"
                  />
                  <span>
                    <span className="block text-sm font-medium">{t("settings.linesGroupNone")}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{t("settings.linesGroupNoneHint")}</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-3">
                  <input
                    type="radio"
                    name="invoiceLineGrouping"
                    value="date"
                    defaultChecked={data.settings.invoiceLineGrouping === "date"}
                    className="mt-1 size-4 accent-pine"
                  />
                  <span>
                    <span className="block text-sm font-medium">{t("settings.linesGroupDate")}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted">{t("settings.linesGroupDateHint")}</span>
                  </span>
                </label>
              </fieldset>
            </Card>

            <div>
              <SubmitButton>{t("settings.save")}</SubmitButton>
            </div>
          </ActionForm>

          <Card id="templates" className="mt-4 scroll-mt-6">
            <h2 className="text-xl">{t("settings.templatesTitle")}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{t("settings.templatesLede")}</p>
            {data.templates.length === 0 ? (
              <p className="mt-4 text-sm text-muted">{t("settings.templatesEmpty")}</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {data.templates.map((template) => (
                  <details key={template.id} className="rounded-xl border border-line bg-white p-3">
                    <summary className="cursor-pointer text-sm font-medium">{template.name}</summary>
                    <div className="mt-3 grid gap-3">
                      <ActionForm action={saveInvoiceTemplate} className="grid gap-3">
                        <input type="hidden" name="id" value={template.id} />
                        <Field label={t("settings.templatesName")}>
                          <TextInput name="name" defaultValue={template.name} maxLength={160} />
                        </Field>
                        <TemplateFields defaults={template} />
                        <div>
                          <SubmitButton tone="quiet">{t("settings.templatesUpdate")}</SubmitButton>
                        </div>
                      </ActionForm>
                      <ActionForm action={deleteInvoiceTemplate} compact confirm={t("settings.templatesDeleteConfirm")}>
                        <input type="hidden" name="id" value={template.id} />
                        <SubmitButton tone="danger">{t("settings.templatesDelete")}</SubmitButton>
                      </ActionForm>
                    </div>
                  </details>
                ))}
              </div>
            )}
            <details className="mt-4 rounded-xl border border-line bg-white p-3">
              <summary className="cursor-pointer text-sm font-medium">{t("settings.templatesNew")}</summary>
              <ActionForm action={saveInvoiceTemplate} className="mt-3 grid gap-3" resetOnSuccess>
                <Field label={t("settings.templatesName")}>
                  <TextInput name="name" required maxLength={160} />
                </Field>
                <TemplateFields defaults={DEFAULT_INVOICE_TEMPLATE} />
                <div>
                  <SubmitButton>{t("settings.templatesSave")}</SubmitButton>
                </div>
              </ActionForm>
            </details>
          </Card>
        </>
      )}
    </ViewGate>
  );
}