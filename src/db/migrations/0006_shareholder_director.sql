ALTER TABLE employees ADD COLUMN shareholder_id INTEGER REFERENCES shareholders(id);
ALTER TABLE resolutions ADD COLUMN employee_id INTEGER REFERENCES employees(id);

-- Shareholder payouts are cleared through their own liability account, not the bank or wages payable.
INSERT OR IGNORE INTO accounts (code, name, type, pnl, system)
VALUES ('1700', 'Verbindlichkeiten gegenüber Gesellschaftern', 'liability', 'none', 1);