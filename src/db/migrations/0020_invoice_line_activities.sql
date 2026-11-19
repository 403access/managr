-- An invoice line can name the time activity it came from. The link keeps an
-- activity from being billed twice and lets the invoice form offer the open
-- activities of a customer.
ALTER TABLE invoice_lines ADD COLUMN time_entry_id INTEGER REFERENCES time_entries(id);
ALTER TABLE invoice_lines ADD COLUMN time_activity_id INTEGER REFERENCES time_entry_activities(id);

CREATE INDEX invoice_lines_activity_idx ON invoice_lines(time_activity_id);