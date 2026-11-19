"use client";

import { Assistant } from "@/components/assistant";
import { useI18n } from "@/components/locale-provider";
import { Card, PageHeader } from "@/components/ui";

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="grid gap-0.5">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-xs font-medium text-muted">{label}</dt>
        <dd className="break-all text-right text-sm">{value}</dd>
      </div>
      {hint ? <p className="text-[11px] leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}

export function AssistantPageScreen({ web, toolCount, mcpUrl }: { web: boolean; toolCount: number; mcpUrl: string }) {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t("assistantPage.title")} lede={t("assistantPage.lede")} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Assistant variant="page" />
        <aside className="grid gap-3">
          <Card>
            <h2 className="text-base">{t("assistantPage.settings")}</h2>
            <dl className="mt-3 grid gap-3">
              <Row label={t("assistantPage.model")} value={t("assistantPage.modelValue")} hint={t("assistantPage.modelHint")} />
              <Row
                label={t("assistantPage.web")}
                value={web ? t("assistantPage.webOn") : t("assistantPage.webOff")}
                hint={t("assistantPage.webHint")}
              />
              <Row label={t("assistantPage.mcp")} value={mcpUrl} hint={t("assistantPage.mcpHint")} />
              <Row label={t("assistantPage.confirm")} value={t("assistantPage.confirmValue")} />
            </dl>
          </Card>
          <Card>
            <h2 className="text-base">{t("assistantPage.history")}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">{t("assistantPage.historyHint")}</p>
          </Card>
          <Card>
            <h2 className="text-base">{t("assistantPage.tools")}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">{t("assistantPage.toolsHint", { count: toolCount })}</p>
          </Card>
          <Card>
            <h2 className="text-base">{t("assistantPage.privacy")}</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted">{t("assistantPage.privacyText")}</p>
          </Card>
        </aside>
      </div>
    </>
  );
}