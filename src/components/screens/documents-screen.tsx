"use client";

import { deleteDocument, saveDocument } from "@/server/actions";
import type { documentsView } from "@/server/views";
import { formatDate } from "@/domain/calendar";
import { queryKeys, viewPath } from "@/client/query-keys";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { useView, ViewGate } from "@/components/use-view";
import { Card, Empty, Field, PageHeader, Section, SelectInput, TextInput, textLinkClass } from "@/components/ui";

type Documents = ReturnType<typeof documentsView>;

export function DocumentsScreen() {
  const query = useView<Documents>(queryKeys.documents, viewPath.documents);
  return (
    <ViewGate query={query}>
      {(data) => (
        <>
          <PageHeader title="Documents" lede="Files stay in data/uploads on this computer. Nothing is sent anywhere." />
          {data.documents.length === 0 ? (
            <Empty>No documents yet.</Empty>
          ) : (
            <div className="grid gap-2">
              {data.documents.map((document) => (
                <Card key={document.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <a className={textLinkClass} href={`/documents/${document.id}/file`}>
                      {document.title}
                    </a>
                    <p className="text-xs text-muted">
                      {document.category} · {document.fileName} · {formatDate(document.uploadedAt.slice(0, 10))} · {Math.ceil(document.sizeBytes / 1024)} KB
                    </p>
                    {document.notes ? <p className="text-xs text-muted">{document.notes}</p> : null}
                  </div>
                  <ActionForm action={deleteDocument} compact confirm="Remove this document and its file?">
                    <input type="hidden" name="id" value={document.id} />
                    <SubmitButton tone="danger">Remove</SubmitButton>
                  </ActionForm>
                </Card>
              ))}
            </div>
          )}
          <Section title="Upload">
            <Card>
              <ActionForm action={saveDocument} resetOnSuccess>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Title"><TextInput name="title" /></Field>
                  <Field label="Category">
                    <SelectInput name="category" defaultValue="corporate">
                      <option value="corporate">Corporate</option>
                      <option value="tax">Tax</option>
                      <option value="invoice">Invoice</option>
                      <option value="employment">Employment</option>
                      <option value="insurance">Insurance</option>
                      <option value="other">Other</option>
                    </SelectInput>
                  </Field>
                </div>
                <Field label="File" hint="Up to 12 MB.">
                  <input name="file" type="file" className="min-h-11 w-full text-sm" />
                </Field>
                <Field label="Notes"><TextInput name="notes" /></Field>
                <SubmitButton>Store document</SubmitButton>
              </ActionForm>
            </Card>
          </Section>
        </>
      )}
    </ViewGate>
  );
}
