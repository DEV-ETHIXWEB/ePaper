import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { env } from "@/lib/env";

/**
 * One connection for the process, opened lazily.
 *
 * better-sqlite3 is synchronous, which suits this workload: queries are
 * sub-millisecond against an indexed local file, so the async ceremony would
 * buy nothing and cost clarity.
 */
let instance: Database.Database | null = null;

export function db(): Database.Database {
  if (instance) return instance;

  const path = resolve(process.cwd(), env.DATABASE_PATH);
  mkdirSync(dirname(path), { recursive: true });

  const conn = new Database(path);
  // WAL lets readers continue while an edition is being written.
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  // Wait rather than throw if a write is briefly in flight.
  conn.pragma("busy_timeout = 5000");

  migrate(conn);
  instance = conn;
  return conn;
}

function migrate(conn: Database.Database): void {
  const sql = readFileSync(
    resolve(process.cwd(), "src/lib/db/schema.sql"),
    "utf8",
  );
  // The schema is written to be idempotent (CREATE TABLE IF NOT EXISTS), so
  // applying it on every boot is safe and keeps a fresh checkout working with
  // no separate migrate step.
  conn.exec(sql);

  // Columns added after the first release. CREATE TABLE IF NOT EXISTS cannot
  // add them to a database that already exists, and ALTER TABLE has no
  // IF NOT EXISTS, so each one is checked first. Keeps a fresh checkout and an
  // upgraded install on the same schema with no separate migrate step.
  addColumn(conn, "issues", "text_status", "TEXT NOT NULL DEFAULT 'pending'");
  addColumn(conn, "issues", "text_source", "TEXT");
  addColumn(conn, "issues", "ocr_confidence", "REAL");
}

function addColumn(
  conn: Database.Database,
  table: string,
  column: string,
  definition: string,
): void {
  const existing = conn
    .prepare(`PRAGMA table_info(${table})`)
    .all() as { name: string }[];
  if (existing.some((c) => c.name === column)) return;
  conn.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/** Run several statements as one unit; rolls back if any of them throws. */
export function transaction<T>(fn: () => T): T {
  return db().transaction(fn)();
}

export function closeDb(): void {
  instance?.close();
  instance = null;
}
