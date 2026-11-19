-- People who work with the company but are not employed by it, such as a
-- customer's staff. They can be named on a time entry without creating an
-- employee, payroll, or social-insurance record.
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  deleted_at TEXT
);

CREATE INDEX contacts_company_idx ON contacts(company_id);
CREATE INDEX contacts_customer_idx ON contacts(customer_id);

ALTER TABLE time_entries ADD COLUMN contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;