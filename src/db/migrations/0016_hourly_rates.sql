-- Hourly rates cascade: a time entry overrides its project, which overrides the
-- customer, which overrides the company default. NULL means "inherit".
ALTER TABLE companies ADD COLUMN hourly_rate_cents INTEGER;
ALTER TABLE customers ADD COLUMN hourly_rate_cents INTEGER;
ALTER TABLE projects ADD COLUMN hourly_rate_cents INTEGER;
ALTER TABLE time_entries ADD COLUMN hourly_rate_cents INTEGER;