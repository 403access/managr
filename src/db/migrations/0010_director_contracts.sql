-- The written managing-director service contract. The salary has to be fixed
-- in advance, so the signing date cannot be later than the start of the term.
CREATE TABLE director_contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  signed_on TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  ended_on TEXT,
  gross_monthly_cents INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX director_contracts_employee_idx ON director_contracts(employee_id, valid_from);