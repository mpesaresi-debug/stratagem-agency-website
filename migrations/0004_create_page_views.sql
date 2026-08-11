-- Cookieless first-touch attribution.
--
-- The contact form records the referrer of the page the form was sent from,
-- which is last-touch: someone who clicks a ChatGPT citation into a blog post
-- and *then* navigates to /contact arrives with an internal referrer, and the
-- AI origin is lost. Carrying first touch across a navigation normally needs a
-- cookie or sessionStorage, which would cost us the consent-banner exemption.
--
-- Instead the Worker logs each entry-page request server-side and stamps it
-- with the same daily-rotating visitor_hash the submission gets, so a lead can
-- be joined back to the view that brought the visitor in. Nothing is stored on
-- or read from the device.
--
-- visitor_hash is a truncated SHA-256 of (ip + user agent + date + salt) — the
-- pattern already used by evolve_page_views. One-way, rotates daily, and no IP
-- is ever written down.

CREATE TABLE IF NOT EXISTS page_views (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  viewed_at    TEXT NOT NULL,
  path         TEXT,
  referrer     TEXT,
  referrer_host TEXT,
  source_label TEXT,
  source_kind  TEXT,
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  country      TEXT,
  visitor_hash TEXT
);

-- The join that answers "where did this lead originally come from".
CREATE INDEX IF NOT EXISTS idx_page_views_visitor_hash ON page_views (visitor_hash);
CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at    ON page_views (viewed_at);
CREATE INDEX IF NOT EXISTS idx_page_views_source_kind  ON page_views (source_kind);

-- Same stamp on the lead, so the two tables can be joined.
ALTER TABLE contact_submissions ADD COLUMN visitor_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_contact_submissions_visitor_hash
  ON contact_submissions (visitor_hash);
