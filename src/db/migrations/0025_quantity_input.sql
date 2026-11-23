ALTER TABLE app_settings ADD COLUMN invoice_quantity_input TEXT NOT NULL DEFAULT 'hoursMinutes';
ALTER TABLE invoices ADD COLUMN quantity_input TEXT;
