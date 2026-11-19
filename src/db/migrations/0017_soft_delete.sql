-- User-facing deletes become soft deletes so they can be restored from the trash.
-- Credentials (bank connections) and internal draft lines stay hard-deleted.
ALTER TABLE shareholders ADD COLUMN deleted_at TEXT;
ALTER TABLE policies ADD COLUMN deleted_at TEXT;
ALTER TABLE invoices ADD COLUMN deleted_at TEXT;
ALTER TABLE salary_periods ADD COLUMN deleted_at TEXT;
ALTER TABLE director_contracts ADD COLUMN deleted_at TEXT;
ALTER TABLE founder_health ADD COLUMN deleted_at TEXT;
ALTER TABLE absences ADD COLUMN deleted_at TEXT;
ALTER TABLE projects ADD COLUMN deleted_at TEXT;
ALTER TABLE milestones ADD COLUMN deleted_at TEXT;
ALTER TABLE tasks ADD COLUMN deleted_at TEXT;
ALTER TABLE time_entries ADD COLUMN deleted_at TEXT;
ALTER TABLE custom_deadlines ADD COLUMN deleted_at TEXT;
ALTER TABLE documents ADD COLUMN deleted_at TEXT;