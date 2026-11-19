-- Positions on an invoice list in reverse chronological order by default: the
-- newest time comes first. The settings page can switch to oldest first.
ALTER TABLE app_settings ADD COLUMN invoice_line_order TEXT NOT NULL DEFAULT 'newestFirst';