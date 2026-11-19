-- Tax returns are prepared from the books, reviewed, and then filed manually or
-- (from phase 3) through ELSTER. A filing carries a frozen figure snapshot: later
-- journal changes do not silently change something that was already reviewed.
CREATE TABLE tax_filings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  year INTEGER NOT NULL,
  period_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  due_date TEXT,
  figures_json TEXT NOT NULL DEFAULT '{}',
  figures_hash TEXT NOT NULL DEFAULT '',
  checks_json TEXT NOT NULL DEFAULT '[]',
  format_version TEXT NOT NULL DEFAULT '',
  replaces_id INTEGER REFERENCES tax_filings(id),
  submitted_at TEXT,
  accepted_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX tax_filings_company_year_idx ON tax_filings(company_id, year, kind);

-- Append-only. A status change is never rewritten; the history is the evidence.
CREATE TABLE tax_filing_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tax_filing_id INTEGER NOT NULL REFERENCES tax_filings(id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  type TEXT NOT NULL,
  actor TEXT NOT NULL,
  from_status TEXT NOT NULL DEFAULT '',
  to_status TEXT NOT NULL DEFAULT '',
  detail_json TEXT NOT NULL DEFAULT '{}',
  payload_hash TEXT NOT NULL DEFAULT ''
);

CREATE INDEX tax_filing_events_filing_idx ON tax_filing_events(tax_filing_id, at);

-- Certificate and PIN columns stay empty until the ERiC phase. The table is
-- here now so the settings screen has one home and later code does not reshape it.
CREATE TABLE elster_settings (
  company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  environment TEXT NOT NULL DEFAULT 'test',
  hersteller_id TEXT NOT NULL DEFAULT '',
  software_name TEXT NOT NULL DEFAULT 'managr',
  software_version TEXT NOT NULL DEFAULT '',
  certificate_name TEXT NOT NULL DEFAULT '',
  certificate_ciphertext TEXT NOT NULL DEFAULT '',
  certificate_valid_until TEXT,
  certificate_fingerprint TEXT NOT NULL DEFAULT '',
  privacy_acknowledged_at TEXT,
  eric_version TEXT NOT NULL DEFAULT '',
  last_checked_at TEXT,
  updated_at TEXT NOT NULL
);

-- Every submission attempt is its own row. A manual filing has no ERiC ticket;
-- the protocol file and the typed ticket are the evidence.
CREATE TABLE elster_transmissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tax_filing_id INTEGER NOT NULL REFERENCES tax_filings(id) ON DELETE CASCADE,
  environment TEXT NOT NULL,
  transport TEXT NOT NULL,
  test_marker TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  eric_version TEXT NOT NULL DEFAULT '',
  request_sha256 TEXT NOT NULL DEFAULT '',
  ticket TEXT NOT NULL DEFAULT '',
  protocol_json TEXT NOT NULL DEFAULT '{}',
  protocol_path TEXT NOT NULL DEFAULT '',
  protocol_name TEXT NOT NULL DEFAULT '',
  protocol_mime TEXT NOT NULL DEFAULT '',
  protocol_size_bytes INTEGER NOT NULL DEFAULT 0,
  error_code TEXT NOT NULL DEFAULT '',
  error_text TEXT NOT NULL DEFAULT ''
);

CREATE INDEX elster_transmissions_filing_idx ON elster_transmissions(tax_filing_id, started_at);