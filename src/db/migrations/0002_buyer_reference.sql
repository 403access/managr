ALTER TABLE customers ADD COLUMN buyer_reference TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN buyer_reference TEXT NOT NULL DEFAULT '';
