-- Positions can be grouped by the day of the time they bill. The desk-wide
-- default lives in app_settings; an invoice can override it, and NULL follows
-- the setting.
ALTER TABLE app_settings ADD COLUMN invoice_line_grouping TEXT NOT NULL DEFAULT 'none';
ALTER TABLE invoices ADD COLUMN line_grouping TEXT;