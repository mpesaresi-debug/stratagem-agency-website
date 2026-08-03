-- Badge-scan tracking for the PartnerBoost EVOLVE 2026 landing page (/evolve).
-- One row per page view, written by src/pages/api/evolve-view.ts.
--
-- visitor_hash is a truncated SHA-256 of (ip + user agent + date + salt). It is
-- deliberately one-way and rotates daily, so it supports a rough unique-visitor
-- count without storing an IP address.

CREATE TABLE IF NOT EXISTS evolve_page_views (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  viewed_at    TEXT NOT NULL,
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  utm_content  TEXT,
  utm_term     TEXT,
  referrer     TEXT,
  path         TEXT,
  user_agent   TEXT,
  country      TEXT,
  language     TEXT,
  visitor_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_evolve_page_views_viewed_at ON evolve_page_views (viewed_at);
CREATE INDEX IF NOT EXISTS idx_evolve_page_views_utm_source ON evolve_page_views (utm_source);
