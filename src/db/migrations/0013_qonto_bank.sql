-- A Qonto connection belongs to one company. The API key is read-only in
-- practice and is stored in this local database; it never reaches the browser.
CREATE TABLE bank_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'qonto',
  label TEXT NOT NULL DEFAULT 'Qonto',
  login TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  staging_token TEXT NOT NULL DEFAULT '',
  org_id TEXT NOT NULL DEFAULT '',
  org_name TEXT NOT NULL DEFAULT '',
  org_slug TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  last_error TEXT NOT NULL DEFAULT '',
  last_synced_at TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX bank_connections_company_provider_unique ON bank_connections(company_id, provider);

CREATE TABLE bank_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  connection_id INTEGER NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL DEFAULT '',
  iban TEXT NOT NULL DEFAULT '',
  bic TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'EUR',
  balance_cents INTEGER NOT NULL DEFAULT 0,
  authorized_balance_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  is_main INTEGER NOT NULL DEFAULT 0,
  is_external INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT '',
  synced_at TEXT NOT NULL
);

CREATE UNIQUE INDEX bank_accounts_connection_external_unique ON bank_accounts(connection_id, external_id);
CREATE INDEX bank_accounts_company_idx ON bank_accounts(company_id);

CREATE TABLE bank_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  external_ref TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  side TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  booked_on TEXT NOT NULL,
  emitted_at TEXT NOT NULL DEFAULT '',
  settled_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  counterparty_name TEXT NOT NULL DEFAULT '',
  reference TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  operation_type TEXT NOT NULL DEFAULT '',
  subject_type TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  cashflow_category TEXT NOT NULL DEFAULT '',
  cashflow_subcategory TEXT NOT NULL DEFAULT '',
  vat_amount_cents INTEGER,
  vat_rate_bps INTEGER,
  card_last_digits TEXT NOT NULL DEFAULT '',
  counterparty_iban TEXT NOT NULL DEFAULT '',
  counterparty_bic TEXT NOT NULL DEFAULT '',
  attachment_count INTEGER NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL
);

CREATE UNIQUE INDEX bank_transactions_account_external_unique ON bank_transactions(account_id, external_id);
CREATE INDEX bank_transactions_company_date_idx ON bank_transactions(company_id, booked_on);
CREATE INDEX bank_transactions_account_date_idx ON bank_transactions(account_id, booked_on);