-- Health cover of a shareholder-director is a personal policy, not a payroll
-- deduction. The status procedure is recorded separately from the policy.
CREATE TABLE founder_health (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  monthly_premium_cents INTEGER NOT NULL DEFAULT 0,
  starts_on TEXT NOT NULL,
  status_procedure TEXT NOT NULL DEFAULT 'not_required',
  status_on TEXT,
  status_outcome TEXT NOT NULL DEFAULT 'open',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX founder_health_employee_unique ON founder_health(company_id, employee_id);