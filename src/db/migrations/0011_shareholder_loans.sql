-- A loan from a shareholder is a liability of the company, separate from salary.
-- The agreement stores the original drawdown; later drawdowns, repayments, and
-- interest are movements. Every movement posts to the append-only journal.
CREATE TABLE shareholder_loans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  shareholder_id INTEGER NOT NULL REFERENCES shareholders(id),
  label TEXT NOT NULL,
  opened_on TEXT NOT NULL,
  principal_cents INTEGER NOT NULL,
  interest_bps INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE shareholder_loan_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id INTEGER NOT NULL REFERENCES shareholder_loans(id) ON DELETE CASCADE,
  moved_on TEXT NOT NULL,
  kind TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  journal_entry_id INTEGER REFERENCES journal_entries(id)
);

CREATE INDEX shareholder_loans_company_idx ON shareholder_loans(company_id, opened_on);
CREATE INDEX shareholder_loan_movements_loan_idx ON shareholder_loan_movements(loan_id, moved_on);

-- Interest on a shareholder loan is a financing expense, not salary.
INSERT OR IGNORE INTO accounts (code, name, type, pnl, system)
VALUES ('7300', 'Zinsaufwendungen', 'expense', 'expense', 1);