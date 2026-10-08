import { db, transaction } from "./index";
import { normalizeQuery } from "@/lib/gurmukhi";
import type {
  Clip,
  Issue,
  IssueStatus,
  IssueWithPublication,
  Page,
  Publication,
} from "./types";

/* ---------------------------------------------------------------- *
 * Publications
 * ---------------------------------------------------------------- */

export function listPublications(includeInactive = false): Publication[] {
  return db()
    .prepare(
      `SELECT * FROM publications
       ${includeInactive ? "" : "WHERE is_active = 1"}
       ORDER BY sort_order, name`,
    )
    .all() as Publication[];
}

export function getPublicationBySlug(slug: string): Publication | null {
  return (
    (db()
      .prepare("SELECT * FROM publications WHERE slug = ?")
      .get(slug) as Publication | undefined) ?? null
  );
}

export function createPublication(input: {
  slug: string;
  name: string;
  name_local?: string | null;
  language?: Publication["language"];
  region?: string | null;
  sort_order?: number;
}): Publication {
  const info = db()
    .prepare(
      `INSERT INTO publications (slug, name, name_local, language, region, sort_order)
       VALUES (@slug, @name, @name_local, @language, @region, @sort_order)`,
    )
    .run({
      slug: input.slug,
      name: input.name,
      name_local: input.name_local ?? null,
      language: input.language ?? "pa",
      region: input.region ?? null,
      sort_order: input.sort_order ?? 0,
    });
  return db()
    .prepare("SELECT * FROM publications WHERE id = ?")
    .get(info.lastInsertRowid) as Publication;
}

/* ---------------------------------------------------------------- *
 * Issues
 * ---------------------------------------------------------------- */

const ISSUE_WITH_PUB = `
  SELECT i.*,
         p.slug        AS publication_slug,
         p.name        AS publication_name,
         p.name_local  AS publication_name_local,
         p.language    AS publication_language
  FROM issues i
  JOIN publications p ON p.id = i.publication_id
`;

/**
 * Claim a slot for an edition before any work starts.
 *
 * The UNIQUE (publication_id, publish_date) constraint means a second upload
 * for the same day cannot create a duplicate. Re-uploading the same day is a
 * normal correction, so that case resets the existing row rather than failing.
 */
export function upsertIssue(publicationId: number, publishDate: string): Issue {
  return transaction(() => {
    const existing = db()
      .prepare(
        "SELECT * FROM issues WHERE publication_id = ? AND publish_date = ?",
      )
      .get(publicationId, publishDate) as Issue | undefined;

    if (existing) {
      // Replacing a day's edition: drop the old pages, reset the row.
      // page_text is a virtual table and takes no foreign key, so its rows
      // have to go first or they outlive the pages and pollute search.
      db()
        .prepare(
          "DELETE FROM page_text WHERE page_id IN (SELECT id FROM pages WHERE issue_id = ?)",
        )
        .run(existing.id);
      db().prepare("DELETE FROM pages WHERE issue_id = ?").run(existing.id);
      db()
        .prepare(
          `UPDATE issues
           SET status = 'processing', page_count = 0, error = NULL,
               published_at = NULL, created_at = datetime('now')
           WHERE id = ?`,
        )
        .run(existing.id);
      return db()
        .prepare("SELECT * FROM issues WHERE id = ?")
        .get(existing.id) as Issue;
    }

    const info = db()
      .prepare(
        `INSERT INTO issues (publication_id, publish_date, status)
         VALUES (?, ?, 'processing')`,
      )
      .run(publicationId, publishDate);
    return db()
      .prepare("SELECT * FROM issues WHERE id = ?")
      .get(info.lastInsertRowid) as Issue;
  });
}

export function markIssueReady(
  issueId: number,
  pageCount: number,
  sourceKey: string | null,
): void {
  db()
    .prepare(
      `UPDATE issues
       SET status = 'ready', page_count = ?, source_key = ?,
           error = NULL, published_at = datetime('now')
       WHERE id = ?`,
    )
    .run(pageCount, sourceKey, issueId);
}

export function markIssueFailed(issueId: number, message: string): void {
  db()
    .prepare("UPDATE issues SET status = 'failed', error = ? WHERE id = ?")
    .run(message.slice(0, 500), issueId);
}

export function getIssue(
  publicationSlug: string,
  publishDate: string,
): IssueWithPublication | null {
  return (
    (db()
      .prepare(`${ISSUE_WITH_PUB} WHERE p.slug = ? AND i.publish_date = ?`)
      .get(publicationSlug, publishDate) as IssueWithPublication | undefined) ??
    null
  );
}

export function getIssueById(id: number): IssueWithPublication | null {
  return (
    (db()
      .prepare(`${ISSUE_WITH_PUB} WHERE i.id = ?`)
      .get(id) as IssueWithPublication | undefined) ?? null
  );
}

/** The most recent ready edition for a publication, for "open today's paper". */
export function getLatestIssue(
  publicationSlug: string,
): IssueWithPublication | null {
  return (
    (db()
      .prepare(
        `${ISSUE_WITH_PUB}
         WHERE p.slug = ? AND i.status = 'ready'
         ORDER BY i.publish_date DESC LIMIT 1`,
      )
      .get(publicationSlug) as IssueWithPublication | undefined) ?? null
  );
}

export function listIssues(opts: {
  publicationSlug?: string;
  from?: string;
  to?: string;
  status?: IssueStatus;
  limit?: number;
  offset?: number;
}): { items: IssueWithPublication[]; total: number } {
  const where: string[] = [];
  const params: Record<string, unknown> = {};

  if (opts.publicationSlug) {
    where.push("p.slug = @slug");
    params.slug = opts.publicationSlug;
  }
  if (opts.from) {
    where.push("i.publish_date >= @from");
    params.from = opts.from;
  }
  if (opts.to) {
    where.push("i.publish_date <= @to");
    params.to = opts.to;
  }
  if (opts.status) {
    where.push("i.status = @status");
    params.status = opts.status;
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const total = (
    db()
      .prepare(
        `SELECT COUNT(*) AS n FROM issues i
         JOIN publications p ON p.id = i.publication_id ${clause}`,
      )
      .get(params) as { n: number }
  ).n;

  const items = db()
    .prepare(
      `${ISSUE_WITH_PUB} ${clause}
       ORDER BY i.publish_date DESC, p.sort_order
       LIMIT @limit OFFSET @offset`,
    )
    .all({ ...params, limit, offset }) as IssueWithPublication[];

  return { items, total };
}

/** Dates that have at least one ready edition, for the calendar picker. */
export function listAvailableDates(
  publicationSlug: string,
  month: string,
): string[] {
  const rows = db()
    .prepare(
      `SELECT DISTINCT i.publish_date AS d
       FROM issues i JOIN publications p ON p.id = i.publication_id
       WHERE p.slug = ? AND i.status = 'ready' AND i.publish_date LIKE ?
       ORDER BY d`,
    )
    .all(publicationSlug, `${month}-%`) as { d: string }[];
  return rows.map((r) => r.d);
}

/**
 * The span the archive covers, so the calendar's month arrows stop at the ends
 * instead of letting readers walk into empty years.
 */
export function issueDateRange(
  publicationSlug: string,
): { first: string; last: string } | null {
  const row = db()
    .prepare(
      `SELECT MIN(i.publish_date) AS first, MAX(i.publish_date) AS last
       FROM issues i JOIN publications p ON p.id = i.publication_id
       WHERE p.slug = ? AND i.status = 'ready'`,
    )
    .get(publicationSlug) as { first: string | null; last: string | null };
  return row?.first && row.last ? { first: row.first, last: row.last } : null;
}

/* ---------------------------------------------------------------- *
 * Pages
 * ---------------------------------------------------------------- */

export function insertPages(
  issueId: number,
  pages: Array<{
    page_number: number;
    width: number;
    height: number;
    storage_prefix: string;
    text?: string;
  }>,
): void {
  const insertPage = db().prepare(
    `INSERT INTO pages (issue_id, page_number, width, height, storage_prefix)
     VALUES (@issue_id, @page_number, @width, @height, @storage_prefix)`,
  );
  const insertText = db().prepare(
    "INSERT INTO page_text (page_id, body) VALUES (?, ?)",
  );
  transaction(() => {
    for (const p of pages) {
      const { text, ...row } = p;
      const info = insertPage.run({ issue_id: issueId, ...row });
      // A page with no text layer is indexed as nothing rather than as an
      // empty string, so it cannot surface as a zero-relevance hit.
      if (text && text.trim()) {
        insertText.run(info.lastInsertRowid as number, text);
      }
    }
  });
}

export function listPages(issueId: number): Page[] {
  return db()
    .prepare("SELECT * FROM pages WHERE issue_id = ? ORDER BY page_number")
    .all(issueId) as Page[];
}

export function getPage(issueId: number, pageNumber: number): Page | null {
  return (
    (db()
      .prepare("SELECT * FROM pages WHERE issue_id = ? AND page_number = ?")
      .get(issueId, pageNumber) as Page | undefined) ?? null
  );
}

export function getPageById(id: number): Page | null {
  return (
    (db().prepare("SELECT * FROM pages WHERE id = ?").get(id) as
      | Page
      | undefined) ?? null
  );
}

/* ---------------------------------------------------------------- *
 * Search
 * ---------------------------------------------------------------- */

export interface SearchHit {
  page_id: number;
  page_number: number;
  publish_date: string;
  publication_slug: string;
  publication_name: string;
  publication_name_local: string | null;
  thumb_prefix: string;
  snippet: string;
}

/** Shortest query the trigram index can answer. */
export const MIN_QUERY_LENGTH = 3;

/**
 * Markers FTS5 wraps matched terms in.
 *
 * Control characters rather than <mark>, because snippet() does not escape the
 * indexed text and that text comes out of a PDF we did not write. Emitting its
 * HTML directly would let a crafted PDF inject script into the results page.
 * The caller escapes first, then swaps these for real tags.
 */
export const HIT_OPEN = "\u0002";
export const HIT_CLOSE = "\u0003";

/**
 * Turn whatever the reader typed into a safe FTS5 query.
 *
 * FTS5 has its own expression syntax, so a bare query containing a quote, a
 * colon or a bare AND/OR is either a syntax error or means something the
 * reader did not intend. Every word is quoted and the words are ANDed, which
 * is what a search box is expected to do.
 */
export function toMatchExpression(raw: string): string | null {
  // Folded the same way the indexed text was, so both sides lost the same marks.
  const words = normalizeQuery(raw)
    .replace(/"/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
  if (words.length === 0) return null;
  // Trigram cannot match a term shorter than three characters at all.
  const usable = words.filter((w) => w.length >= MIN_QUERY_LENGTH);
  if (usable.length === 0) return null;
  return usable.map((w) => `"${w}"`).join(" AND ");
}

export function searchPages(
  raw: string,
  opts: { publicationSlug?: string; limit?: number; offset?: number } = {},
): { items: SearchHit[]; total: number } {
  const match = toMatchExpression(raw);
  if (!match) return { items: [], total: 0 };

  const params: Record<string, unknown> = { match };
  let pubClause = "";
  if (opts.publicationSlug) {
    pubClause = "AND p.slug = @slug";
    params.slug = opts.publicationSlug;
  }

  const from = `
    FROM page_text t
    JOIN pages pg   ON pg.id = t.page_id
    JOIN issues i   ON i.id = pg.issue_id
    JOIN publications p ON p.id = i.publication_id
    WHERE t.body MATCH @match AND i.status = 'ready' ${pubClause}`;

  const total = (
    db().prepare(`SELECT COUNT(*) AS n ${from}`).get(params) as { n: number }
  ).n;

  const items = db()
    .prepare(
      `SELECT pg.id AS page_id, pg.page_number, pg.storage_prefix AS thumb_prefix,
              i.publish_date,
              p.slug AS publication_slug, p.name AS publication_name,
              p.name_local AS publication_name_local,
              snippet(page_text, 0, char(2), char(3), '…', 24) AS snippet
       ${from}
       ORDER BY rank, i.publish_date DESC
       LIMIT @limit OFFSET @offset`,
    )
    .all({
      ...params,
      limit: Math.min(opts.limit ?? 20, 100),
      offset: Math.max(opts.offset ?? 0, 0),
    }) as SearchHit[];

  return { items, total };
}

/* ---------------------------------------------------------------- *
 * Clips
 * ---------------------------------------------------------------- */

export function createClip(clip: Omit<Clip, "created_at" | "storage_key"> & {
  storage_key?: string | null;
}): Clip {
  db()
    .prepare(
      `INSERT INTO clips (id, page_id, x, y, w, h, storage_key)
       VALUES (@id, @page_id, @x, @y, @w, @h, @storage_key)`,
    )
    .run({ ...clip, storage_key: clip.storage_key ?? null });
  return db().prepare("SELECT * FROM clips WHERE id = ?").get(clip.id) as Clip;
}

/**
 * An identical selection on the same page, if one was already made.
 *
 * Two readers clipping the same story — or one reader clipping twice — should
 * not each cost a decode, a crop and a stored file. Rectangles are rounded to
 * four decimals before they are stored, which on a 1700px page is sub-pixel,
 * so an exact match here is a genuine match.
 */
export function findClipByRect(
  pageId: number,
  rect: { x: number; y: number; w: number; h: number },
): Clip | null {
  return (
    (db()
      .prepare(
        `SELECT * FROM clips
          WHERE page_id = @page_id
            AND x = @x AND y = @y AND w = @w AND h = @h
            AND storage_key IS NOT NULL
          ORDER BY created_at LIMIT 1`,
      )
      .get({ page_id: pageId, ...rect }) as Clip | undefined) ?? null
  );
}

export function getClip(id: string): Clip | null {
  return (
    (db().prepare("SELECT * FROM clips WHERE id = ?").get(id) as
      | Clip
      | undefined) ?? null
  );
}
