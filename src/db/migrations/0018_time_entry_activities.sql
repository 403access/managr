-- A time entry has separate activities and one internal note. The activities
-- are the lines that later belong to the time item on a customer invoice; the
-- note on time_entries.memo stays internal.
CREATE TABLE time_entry_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  time_entry_id INTEGER NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  description TEXT NOT NULL
);

CREATE INDEX time_entry_activities_entry_idx ON time_entry_activities(time_entry_id);