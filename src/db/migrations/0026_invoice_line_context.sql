ALTER TABLE invoices ADD COLUMN show_customer_in_lines INTEGER NOT NULL DEFAULT 1;
ALTER TABLE invoices ADD COLUMN show_project_in_lines INTEGER NOT NULL DEFAULT 1;
ALTER TABLE invoice_lines ADD COLUMN description_edited INTEGER NOT NULL DEFAULT 0;
