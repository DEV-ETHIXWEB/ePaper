/**
 * Report how well a PDF's text layer survives extraction.
 *
 * Run this against a real edition before trusting search:
 *
 *   npx tsx scripts/check-pdf-text.mts path/to/edition.pdf
 *
 * Punjabi is the hard case. A PDF stores glyphs in painting order with a
 * ToUnicode map back to characters, and how complete that map is decides
 * everything. Three outcomes, which this tells apart:
 *
 *   good     — text extracts cleanly, search works as built
 *   lossy    — characters come back as NUL, so some words can never be found
 *   garbled  — a legacy ASCII-mapped font (AnmolLipi and the like); the page
 *              looks like Punjabi but the text layer is meaningless, and OCR
 *              is the only route to a searchable archive
 */
import { readFileSync } from "node:fs";
import { normalizeExtractedText } from "../src/lib/gurmukhi";

const file = process.argv[2];
if (!file) {
  console.error("usage: tsx scripts/check-pdf-text.ts <file.pdf>");
  process.exit(2);
}

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const bytes = readFileSync(file);
const data = new Uint8Array(bytes.byteLength);
data.set(bytes);

const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

let rawTotal = 0;
let nulls = 0;
let gurmukhi = 0;
let letters = 0;
let pagesWithText = 0;
const samples: string[] = [];

for (let n = 1; n <= doc.numPages; n += 1) {
  const page = await doc.getPage(n);
  const content = await page.getTextContent();
  const raw = content.items
    .map((i) => (i as { str?: string }).str ?? "")
    .join(" ");
  rawTotal += raw.length;
  nulls += (raw.match(/\u0000/g) ?? []).length;
  if (raw.trim()) pagesWithText += 1;

  const clean = normalizeExtractedText(raw);
  const l = clean.replace(/[^\p{L}\p{M}]/gu, "");
  letters += l.length;
  gurmukhi += (l.match(/[਀-੿]/gu) ?? []).length;
  if (samples.length < 3 && clean.length > 40) samples.push(clean.slice(0, 110));
  page.cleanup();
}

const ratio = letters ? gurmukhi / letters : 0;
const nulRate = rawTotal ? nulls / rawTotal : 0;

console.log(`file            ${file}`);
console.log(`pages           ${doc.numPages} (${pagesWithText} with text)`);
console.log(`extracted chars ${rawTotal}`);
console.log(`unmapped glyphs ${nulls} (${(nulRate * 100).toFixed(1)}%)`);
console.log(`gurmukhi share  ${(ratio * 100).toFixed(1)}% of letters`);
console.log();
for (const s of samples) console.log("  " + JSON.stringify(s));
console.log();

if (pagesWithText === 0) {
  console.log("VERDICT: no text layer at all — scanned or outlined. OCR required.");
} else if (ratio < 0.2) {
  console.log("VERDICT: garbled — almost no Gurmukhi despite a Punjabi page.");
  console.log("         Legacy ASCII-mapped font. OCR required for search.");
} else if (nulRate > 0.02) {
  console.log("VERDICT: lossy — an incomplete ToUnicode map drops characters.");
  console.log("         Search will work but will miss some words.");
} else {
  console.log("VERDICT: good — text extracts cleanly, search will work as built.");
}
