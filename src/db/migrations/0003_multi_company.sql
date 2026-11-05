-- Multiple companies, each with its own books. Existing rows belong to company 1.

ALTER TABLE companies ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0;
UPDATE companies SET is_active = 1 WHERE id = (SELECT MIN(id) FROM companies);
CREATE UNIQUE INDEX companies_active_unique ON companies(is_active) WHERE is_active = 1;

UPDATE companies SET legal_form = 'ug' WHERE legal_form LIKE 'UG%';

ALTER TABLE shareholders ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id);
ALTER TABLE customers ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id);
ALTER TABLE employees ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id);
ALTER TABLE tasks ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id);
ALTER TABLE time_entries ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id);
ALTER TABLE documents ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id);
ALTER TABLE custom_deadlines ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id);
ALTER TABLE resolutions ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id);
ALTER TABLE compliance_items ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id);
ALTER TABLE policies ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id);
ALTER TABLE reserve_movements ADD COLUMN company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id);

-- The invoice number is unique per company, not across the whole desk.
CREATE TABLE invoices_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  number TEXT,
  status TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  service_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  exemption_note TEXT NOT NULL DEFAULT '',
  buyer_reference TEXT NOT NULL DEFAULT '',
  journal_entry_id INTEGER REFERENCES journal_entries(id)
);
INSERT INTO invoices_new (id, company_id, customer_id, number, status, issue_date, service_date, due_date, notes, exemption_note, buyer_reference, journal_entry_id)
SELECT id, 1, customer_id, number, status, issue_date, service_date, due_date, notes, exemption_note, buyer_reference, journal_entry_id FROM invoices;
DROP TABLE invoices;
ALTER TABLE invoices_new RENAME TO invoices;
CREATE INDEX invoices_customer_idx ON invoices(customer_id);
CREATE INDEX invoices_company_idx ON invoices(company_id);
CREATE UNIQUE INDEX invoices_company_number_unique ON invoices(company_id, number);

-- The posting source is unique per company. The reserve uses a year key.
CREATE TABLE journal_entries_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id),
  entry_date TEXT NOT NULL,
  memo TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (company_id, source, source_id)
);
INSERT INTO journal_entries_new (id, company_id, entry_date, memo, source, source_id, created_at)
SELECT id, 1, entry_date, memo, source, source_id, created_at FROM journal_entries;
DROP TABLE journal_entries;
ALTER TABLE journal_entries_new RENAME TO journal_entries;
CREATE INDEX journal_entries_date_idx ON journal_entries(entry_date);
CREATE INDEX journal_entries_company_date_idx ON journal_entries(company_id, entry_date);

CREATE TABLE obligation_states_new (
  company_id INTEGER NOT NULL DEFAULT 1 REFERENCES companies(id),
  key TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (company_id, key)
);
INSERT INTO obligation_states_new (company_id, key, status, note, updated_at)
SELECT 1, key, status, note, updated_at FROM obligation_states;
DROP TABLE obligation_states;
ALTER TABLE obligation_states_new RENAME TO obligation_states;

CREATE INDEX shareholders_company_idx ON shareholders(company_id);
CREATE INDEX customers_company_idx ON customers(company_id);
CREATE INDEX employees_company_idx ON employees(company_id);
CREATE INDEX tasks_company_idx ON tasks(company_id);
CREATE INDEX time_entries_company_date_idx ON time_entries(company_id, entry_date);
CREATE INDEX documents_company_idx ON documents(company_id);
CREATE INDEX custom_deadlines_company_idx ON custom_deadlines(company_id);
CREATE INDEX resolutions_company_idx ON resolutions(company_id);
CREATE INDEX compliance_items_company_idx ON compliance_items(company_id);
CREATE INDEX policies_company_idx ON policies(company_id);
CREATE INDEX reserve_movements_company_idx ON reserve_movements(company_id);
