-- Charhdikala ePaper schema.
--
-- SQLite, deliberately. The write load is a few dozen rows a day from one
-- newsroom; the read load is served from cache and a CDN. A managed Postgres
-- would add a network hop, a monthly bill and a second thing to back up, for
-- no gain at this size. The file is backed up alongside the page images.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- A masthead in one region: "Chardikala Punjab", "Bharat Desh Hamara Delhi".
CREATE TABLE IF NOT EXISTS publications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  name_local  TEXT,                      -- Gurmukhi or Devanagari title
  language    TEXT    NOT NULL DEFAULT 'pa' CHECK (language IN ('pa','hi','en')),
  region      TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- One day's edition of one publication.
CREATE TABLE IF NOT EXISTS issues (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  publication_id INTEGER NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  publish_date   TEXT    NOT NULL,       -- YYYY-MM-DD
  status         TEXT    NOT NULL DEFAULT 'processing'
                   CHECK (status IN ('processing','ready','failed')),
  page_count     INTEGER NOT NULL DEFAULT 0,
  source_key     TEXT,                   -- original PDF in object storage
  error          TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  published_at   TEXT,
  -- One edition per publication per day. The database enforces it so a double
  -- upload cannot quietly create a duplicate the newsroom only finds later.
  UNIQUE (publication_id, publish_date)
);

CREATE INDEX IF NOT EXISTS idx_issues_date    ON issues (publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_issues_pub_date ON issues (publication_id, publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_issues_status  ON issues (status);

-- A single printed page.
CREATE TABLE IF NOT EXISTS pages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id     INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  page_number  INTEGER NOT NULL CHECK (page_number > 0),
  width        INTEGER NOT NULL,
  height       INTEGER NOT NULL,
  -- Variants live at {storage_prefix}/full.webp, /read.webp, /thumb.webp.
  -- Storing the prefix rather than three keys keeps the row honest if we ever
  -- add a size.
  storage_prefix TEXT  NOT NULL,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (issue_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_pages_issue ON pages (issue_id, page_number);

-- A reader-cropped region, kept so a shared link keeps working.
CREATE TABLE IF NOT EXISTS clips (
  id          TEXT    PRIMARY KEY,       -- short public id used in the URL
  page_id     INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  x           REAL    NOT NULL,          -- fractions of page width/height, so
  y           REAL    NOT NULL,          -- the clip survives a re-render at a
  w           REAL    NOT NULL,          -- different resolution
  h           REAL    NOT NULL,
  storage_key TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (x >= 0 AND y >= 0 AND w > 0 AND h > 0 AND x + w <= 1.0001 AND y + h <= 1.0001)
);

CREATE INDEX IF NOT EXISTS idx_clips_page ON clips (page_id);

-- Applied migrations, so schema changes are additive and auditable.
/*
 * Full-text search over the text layer of each page.
 *
 * tokenize='trigram', not the usual 'unicode61'. unicode61 treats Gurmukhi
 * matras as word separators, so "ਪਟਿਆਲਾ" indexes as ਪਟ / ਆ / ਆਲ and Punjabi
 * search returns fragments and false positives. trigram is script-agnostic,
 * keeps matras and subjoined characters intact, matches mid-word, and still
 * handles Latin case-insensitively. The index is larger, which is the price.
 *
 * Virtual tables take no foreign keys, so rows here are cleaned up explicitly
 * whenever the pages they describe are deleted.
 */
CREATE VIRTUAL TABLE IF NOT EXISTS page_text USING fts5(
  body,
  page_id UNINDEXED,
  tokenize = 'trigram'
);

CREATE TABLE IF NOT EXISTS migrations (
  name       TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
