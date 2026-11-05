CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  legal_name TEXT NOT NULL,
  legal_form TEXT NOT NULL DEFAULT 'ug',
  street TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'Deutschland',
  state_code TEXT NOT NULL DEFAULT 'BE',
  register_court TEXT NOT NULL DEFAULT '',
  register_number TEXT NOT NULL DEFAULT '',
  tax_number TEXT NOT NULL DEFAULT '',
  vat_id TEXT NOT NULL DEFAULT '',
  economic_id TEXT NOT NULL DEFAULT '',
  share_capital_cents INTEGER NOT NULL,
  loss_carryforward_cents INTEGER NOT NULL DEFAULT 0,
  prior_year_revenue_cents INTEGER NOT NULL DEFAULT 0,
  fiscal_year_start_month INTEGER NOT NULL DEFAULT 1,
  founding_date TEXT NOT NULL,
  kleinunternehmer INTEGER NOT NULL DEFAULT 0,
  vat_permanent_extension INTEGER NOT NULL DEFAULT 0,
  uses_tax_advisor INTEGER NOT NULL DEFAULT 0,
  default_vat_bps INTEGER NOT NULL DEFAULT 1900,
  iban TEXT NOT NULL DEFAULT '',
  bic TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  ihk TEXT NOT NULL DEFAULT '',
  berufsgenossenschaft TEXT NOT NULL DEFAULT '',
  hebesatz_percent INTEGER NOT NULL DEFAULT 410,
  additional_kv_bps INTEGER NOT NULL DEFAULT 290,
  invoice_prefix TEXT NOT NULL DEFAULT 'RE-',
  next_invoice_seq INTEGER NOT NULL DEFAULT 1,
  payment_terms_days INTEGER NOT NULL DEFAULT 14,
  managing_director TEXT NOT NULL DEFAULT '',
  is_sample INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE shareholders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  street TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  share_bps INTEGER NOT NULL,
  nominal_cents INTEGER NOT NULL
);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  street TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT 'Deutschland',
  email TEXT NOT NULL DEFAULT '',
  vat_id TEXT NOT NULL DEFAULT ''
);

CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  pnl TEXT NOT NULL,
  system INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date TEXT NOT NULL,
  memo TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (source, source_id)
);

CREATE TABLE journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES journal_entries(id),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  debit_cents INTEGER NOT NULL,
  credit_cents INTEGER NOT NULL
);

CREATE TABLE invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  number TEXT UNIQUE,
  status TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  service_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  exemption_note TEXT NOT NULL DEFAULT '',
  journal_entry_id INTEGER REFERENCES journal_entries(id)
);

CREATE TABLE invoice_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL,
  unit_net_cents INTEGER NOT NULL,
  vat_bps INTEGER NOT NULL
);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  paid_on TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  journal_entry_id INTEGER REFERENCES journal_entries(id)
);

CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  sv_status TEXT NOT NULL,
  ownership_bps INTEGER NOT NULL DEFAULT 0,
  street TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL,
  end_date TEXT,
  weekly_minutes INTEGER NOT NULL,
  workdays_per_week INTEGER NOT NULL,
  vacation_days INTEGER NOT NULL,
  gross_monthly_cents INTEGER NOT NULL,
  tax_class TEXT NOT NULL DEFAULT '',
  tax_id TEXT NOT NULL DEFAULT '',
  sv_number TEXT NOT NULL DEFAULT '',
  church_tax INTEGER NOT NULL DEFAULT 0,
  health_insurance_name TEXT NOT NULL DEFAULT '',
  additional_kv_bps INTEGER,
  childless_surcharge INTEGER NOT NULL DEFAULT 0,
  care_discount_steps INTEGER NOT NULL DEFAULT 0,
  minijob_public_health INTEGER NOT NULL DEFAULT 1,
  pension_opt_out INTEGER NOT NULL DEFAULT 0,
  flat_tax INTEGER NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE absences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  status TEXT NOT NULL,
  area TEXT NOT NULL DEFAULT 'general'
);

CREATE TABLE time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  memo TEXT NOT NULL DEFAULT '',
  task_id INTEGER REFERENCES tasks(id),
  employee_id INTEGER REFERENCES employees(id),
  billable INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  file_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  uploaded_at TEXT NOT NULL
);

CREATE TABLE obligation_states (
  key TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE custom_deadlines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  due_date TEXT NOT NULL,
  recurrence TEXT NOT NULL,
  status TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE resolutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  resolved_on TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT ''
);

CREATE TABLE compliance_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  area TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  done INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL
);

CREATE TABLE policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  policy_number TEXT NOT NULL DEFAULT '',
  monthly_premium_cents INTEGER NOT NULL DEFAULT 0,
  renewal_date TEXT,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE reserve_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  moved_on TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  journal_entry_id INTEGER REFERENCES journal_entries(id)
);

CREATE INDEX journal_lines_entry_idx ON journal_lines(entry_id);
CREATE INDEX journal_lines_account_idx ON journal_lines(account_id);
CREATE INDEX journal_entries_date_idx ON journal_entries(entry_date);
CREATE INDEX invoices_customer_idx ON invoices(customer_id);
CREATE INDEX time_entries_date_idx ON time_entries(entry_date);
