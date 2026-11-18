-- Reporting lines for the org chart. A person without a manager is a root;
-- removing a manager leaves their reports as roots instead of deleting them.
ALTER TABLE employees ADD COLUMN manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL;

CREATE INDEX employees_manager_idx ON employees(manager_id);