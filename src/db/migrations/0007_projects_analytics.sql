-- Projects tie time, tasks, and a customer together. A project can outlive a task.
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_on TEXT NOT NULL,
  ended_on TEXT,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE INDEX projects_company_idx ON projects(company_id);
CREATE INDEX projects_customer_idx ON projects(customer_id);

-- A task type is what kind of work it is; area stays the business area (tax, legal, invoices).
ALTER TABLE tasks ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN task_type TEXT NOT NULL DEFAULT 'other';
ALTER TABLE tasks ADD COLUMN deliverable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN completed_at TEXT;

CREATE INDEX tasks_project_idx ON tasks(project_id);

-- The time entry carries its own project and type so time logged without a task still counts.
ALTER TABLE time_entries ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE time_entries ADD COLUMN task_type TEXT NOT NULL DEFAULT 'other';

CREATE INDEX time_entries_project_idx ON time_entries(project_id);