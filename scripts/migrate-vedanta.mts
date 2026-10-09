/**
 * Pull the surviving archive off the old Vedanta epaper site.
 *
 *   npx tsx scripts/migrate-vedanta.mts --dry-run
 *   npx tsx scripts/migrate-vedanta.mts --from 9072 --to 9699
 *
 * Their site exposes every edition at /view/{id}/{slug} with a public PDF
 * link, and the ids are sequential, so the whole archive can be walked without
 * a login. Measured on 2026-10-09: ids below 9072 are gone, which is the 5 to
 * 6 GB cap deleting old editions. About 79 days survive and nothing older can
 * be recovered from this source.
 *
 * Resumable by design. It skips any edition already present, so an
 * interrupted run is restarted by running it again, and it never re-downloads
 * what it already has.
 */
import { ingestEdition } from "../src/lib/ingest/index";
import { getIssue, listPublications } from "../src/lib/db/queries";
import { matchPublication } from "../src/lib/filename";

const BASE = "https://epaper.charhdikala.com";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const DRY = process.argv.includes("--dry-run");
const FROM = Number(arg("from", "9072"));
const TO = Number(arg("to", "9999"));
const LIMIT = Number(arg("limit", "100000"));
/** Their server is a live production site; this is not a crawl to rush. */
const DELAY_MS = Number(arg("delay", "700"));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** "charhdikala haryana 9-10-2026 - Page 1 - Charhdikala Epaper" */
function parseTitle(html: string): { label: string; date: string } | null {
  const m = /<title>([^<]*)<\/title>/.exec(html);
  if (!m) return null;
  const title = m[1].split(" - Page")[0].trim();
  const d = /(\d{1,2})-(\d{1,2})-(20\d{2})/.exec(title);
  if (!d) return null;
  const [, dd, mm, yyyy] = d;
  const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  return { label: title.replace(d[0], "").trim(), date: iso };
}

async function main() {
  const publications = listPublications();
  console.log(`${publications.length} publications known locally`);
  console.log(`walking ids ${FROM}..${TO}${DRY ? " (dry run)" : ""}\n`);

  let seen = 0, skipped = 0, done = 0, failed = 0, unmatched = 0;

  for (let id = FROM; id <= TO && done + skipped < LIMIT; id += 1) {
    let html: string;
    try {
      const res = await fetch(`${BASE}/view/${id}/x`, {
        redirect: "follow",
        headers: { "user-agent": "charhdikala-epaper-migration" },
      });
      if (res.status === 404) continue;
      if (!res.ok) { console.log(`  ${id}: HTTP ${res.status}`); continue; }
      html = await res.text();
    } catch (err) {
      console.log(`  ${id}: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    const parsed = parseTitle(html);
    if (!parsed) continue;
    seen += 1;

    // Reuses the uploader's matcher, so the old site's spellings resolve the
    // same way a dropped file does.
    const { slug, confidence } = matchPublication(parsed.label, publications);
    if (!slug || confidence < 0.5) {
      unmatched += 1;
      console.log(`  ${id}: no publication for "${parsed.label}" (${confidence.toFixed(2)})`);
      continue;
    }

    if (getIssue(slug, parsed.date)) { skipped += 1; continue; }

    const pdf = /https:\/\/epaper\.charhdikala\.com\/media\/[^"']+\.pdf/.exec(html)?.[0];
    if (!pdf) { console.log(`  ${id}: no PDF link`); failed += 1; continue; }

    if (DRY) {
      console.log(`  ${id}: would import ${slug} ${parsed.date}`);
      done += 1;
      await sleep(DELAY_MS);
      continue;
    }

    try {
      const res = await fetch(pdf, { headers: { "user-agent": "charhdikala-epaper-migration" } });
      if (!res.ok) throw new Error(`PDF HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const out = await ingestEdition({
        publicationSlug: slug,
        publishDate: parsed.date,
        pdf: bytes,
      });
      done += 1;
      console.log(
        `  ${id}: ${slug} ${parsed.date} — ${out.pageCount} pages, ` +
          `${(out.bytesStored / 1024 / 1024).toFixed(0)} MB, ${(out.durationMs / 1000).toFixed(1)}s`,
      );
    } catch (err) {
      failed += 1;
      console.log(`  ${id}: FAILED ${err instanceof Error ? err.message : err}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(
    `\n${seen} editions found · ${done} imported · ${skipped} already here · ` +
      `${unmatched} unmatched · ${failed} failed`,
  );
  // Indexing runs in the background and would keep the process alive.
  process.exit(0);
}

await main();
