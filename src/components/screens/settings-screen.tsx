"use client";

import { saveSettings } from "@/server/actions";
import type { settingsView } from "@/server/views";
import { DETAIL_PAGE_KEYS, resolveDetailSidebarMode, type DetailPageKey, type DetailSidebarMode } from "@/domain/settings";
import type { MessageKey } from "@/i18n";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Field, PageHeader, SelectInput } from "@/components/ui";

type Settings = ReturnType<typeof settingsView>;

function pageLabel(t: (key: MessageKey) => string, page: DetailPageKey): string {
  return page === "customers" ? t("nav.customers") : page;
}

function modeLabel(t: (key: MessageKey) => string, mode: DetailSidebarMode): string {
  return mode === "inline" ? t("settings.modeInline") : t("settings.modeOverlay");
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

            <div>
              <SubmitButton>{t("settings.save")}</SubmitButton>
            </div>
          </ActionForm>
        </>
      )}
    </ViewGate>
  );
}