CREATE TABLE salary_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  valid_from TEXT NOT NULL,
  gross_monthly_cents INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX salary_periods_employee_from_unique ON salary_periods(employee_id, valid_from);