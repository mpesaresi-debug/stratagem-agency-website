CREATE TABLE IF NOT EXISTS contact_submissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name   TEXT    NOT NULL,
  last_name    TEXT,
  email        TEXT    NOT NULL,
  company      TEXT,
  goal         TEXT,
  message      TEXT,
  locale       TEXT    NOT NULL DEFAULT 'en',
  submitted_at TEXT    NOT NULL
);
