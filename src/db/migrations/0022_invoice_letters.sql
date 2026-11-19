-- An invoice can carry a human letter around its positions. The stored text is
-- the invoice's own copy; a template only pre-fills it when the invoice is
-- written.
ALTER TABLE invoices ADD COLUMN letter_subject TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN letter_salutation TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN letter_intro TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN letter_payment TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN letter_closing TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN letter_signature TEXT NOT NULL DEFAULT '';

CREATE TABLE invoice_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  salutation TEXT NOT NULL DEFAULT '',
  intro TEXT NOT NULL DEFAULT '',
  payment TEXT NOT NULL DEFAULT '',
  closing TEXT NOT NULL DEFAULT '',
  signature TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX invoice_templates_company_name_unique ON invoice_templates(company_id, name);