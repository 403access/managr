"use client";

import { deleteDocument, saveDocument } from "@/server/actions";
import type { documentsView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useI18n } from "@/components/locale-provider";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Empty, Field, PageHeader, Section, SelectInput, TextInput, textLinkClass } from "@/components/ui";

type Documents = ReturnType<typeof documentsView>;

const categories = ["corporate", "tax", "invoice", "employment", "insurance", "other"] as const;

export function DocumentsScreen() {
  const query = useView<Documents>(queryKeys.documents, viewPath.documents);
  const { t, label } = useI18n();
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader title={t("docs.title")} lede={t("docs.lede")} />
          {data.documents.length === 0 ? (
            <Empty>{t("docs.empty")}</Empty>
          ) : (
            <div className="grid gap-2">
              {data.documents.map((document) => (
                <Card key={document.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <a className={textLinkClass} href={`/documents/${document.id}/file`}>
                      {document.title}
                    </a>
                    <p className="text-xs text-muted">
                      {label(document.category)} · {document.fileName} · {formatDate(document.uploadedAt.slice(0, 10))} · {Math.ceil(document.sizeBytes / 1024)} KB
                    </p>
                    {document.notes ? <p className="text-xs text-muted">{document.notes}</p> : null}
                  </div>
                  <ActionForm action={deleteDocument} compact confirm={t("docs.remove")}>
                    <input type="hidden" name="id" value={document.id} />
                    <SubmitButton tone="danger">{t("common.remove")}</SubmitButton>
                  </ActionForm>
                </Card>
              ))}
            </div>
          )}
          <Section title={t("docs.upload")}>
            <Card>
              <ActionForm action={saveDocument} resetOnSuccess>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("common.title")}><TextInput name="title" /></Field>
                  <Field label={t("common.category")}>
                    <SelectInput name="category" defaultValue="corporate">
                      {categories.map((category) => (
                        <option key={category} value={category}>{label(category)}</option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>
                <Field label={t("common.file")} hint={t("docs.fileHint")}>
                  <input name="file" type="file" className="min-h-11 w-full text-sm" />
                </Field>
                <Field label={t("common.notes")}><TextInput name="notes" /></Field>
                <SubmitButton>{t("docs.store")}</SubmitButton>
              </ActionForm>
            </Card>
          </Section>
        </>
      )}
    </ViewGate>
  );
}
