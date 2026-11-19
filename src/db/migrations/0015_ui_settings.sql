CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  detail_sidebar_mode TEXT NOT NULL DEFAULT 'inline',
  detail_sidebar_overrides TEXT NOT NULL DEFAULT '{}'
);

INSERT INTO app_settings (id) VALUES (1);