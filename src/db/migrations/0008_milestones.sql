-- Milestones are overarching goals. They are deliberately not owned by one company:
-- the page shows them across the whole desk. The link table records which companies
-- contribute; a milestone without a row is a goal for the group as a whole.
CREATE TABLE milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'planned',
  target_date TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX milestones_target_idx ON milestones(target_date);
CREATE INDEX milestones_status_idx ON milestones(status);

CREATE TABLE milestone_companies (
  milestone_id INTEGER NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  PRIMARY KEY (milestone_id, company_id)
);

CREATE INDEX milestone_companies_company_idx ON milestone_companies(company_id);