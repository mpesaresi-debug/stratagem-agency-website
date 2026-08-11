-- Lead-source capture for the contact form.
--
-- Until now a submission recorded who got in touch but nothing about how they
-- found us, so an AI-referred lead was only identifiable if the person happened
-- to mention it. These columns record the referring page and any campaign
-- parameters present on the contact page at submit time.
--
-- Deliberately NOT stored: IP address and user agent. Neither helps attribute a
-- lead, and leaving them out keeps the submission record to data the visitor
-- effectively volunteered by sending the form.
--
-- Nothing here is read from or written to the visitor's device — no cookie, no
-- localStorage, no sessionStorage — so the site still needs no consent banner
-- and the "we set no cookies" claim on /privacy stays accurate.

ALTER TABLE contact_submissions ADD COLUMN referrer      TEXT;
ALTER TABLE contact_submissions ADD COLUMN referrer_host TEXT;
ALTER TABLE contact_submissions ADD COLUMN source_label  TEXT;
ALTER TABLE contact_submissions ADD COLUMN source_kind   TEXT;
ALTER TABLE contact_submissions ADD COLUMN landing_path  TEXT;
ALTER TABLE contact_submissions ADD COLUMN utm_source    TEXT;
ALTER TABLE contact_submissions ADD COLUMN utm_medium    TEXT;
ALTER TABLE contact_submissions ADD COLUMN utm_campaign  TEXT;
ALTER TABLE contact_submissions ADD COLUMN utm_content   TEXT;
ALTER TABLE contact_submissions ADD COLUMN utm_term      TEXT;
ALTER TABLE contact_submissions ADD COLUMN country       TEXT;

-- The whole point of the exercise: "how many leads came from AI assistants?"
CREATE INDEX IF NOT EXISTS idx_contact_submissions_source_kind
  ON contact_submissions (source_kind);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_submitted_at
  ON contact_submissions (submitted_at);
