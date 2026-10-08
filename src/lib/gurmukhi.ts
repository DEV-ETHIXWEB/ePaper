/**
 * Repairing Gurmukhi text pulled out of a PDF.
 *
 * A PDF stores text in the order glyphs are painted, not the order they are
 * typed. For Gurmukhi that breaks extraction in three ways, all of which show
 * up in a page of ordinary newsprint:
 *
 *   1. The sihari (ਿ) is a pre-base vowel: it is drawn to the LEFT of the
 *      consonant it belongs to, so "ਪਟਿਆਲਾ" extracts as "ਪ ਿਟ ਆ ਲਾ".
 *   2. Each glyph cluster is emitted as its own run, so a word arrives split
 *      by single spaces while real word gaps are wider.
 *   3. Glyphs with no ToUnicode entry come back as NUL. Addak and bindi are
 *      the usual casualties.
 *
 * So indexed text is repaired, and the query is folded the same lossy way, so
 * that both sides have lost the same information and still meet.
 *
 * How much of this is needed depends entirely on who produced the PDF. A file
 * with a complete ToUnicode CMap needs only the reordering; one from a legacy
 * ASCII-mapped font (AnmolLipi and friends) cannot be recovered here at all,
 * which is why ingest reports `textLooksGarbled` rather than pretending.
 */

const GURMUKHI = "[\\u0A00-\\u0A7F]";
const SIHARI = "\\u0A3F";

/**
 * Marks dropped from both the text and the query.
 *
 * These are the vertically stacked signs: the above and below base vowels
 * (ੁ ੂ ੇ ੈ ੋ ੌ), addak, bindi, tippi, adak bindi, virama and nukta. They are
 * the ones a thin ToUnicode map loses, measured on a real file: "ਮੁੱਖ ਮੰਤਰੀ"
 * extracted as "ਮਖ ਮਤਰੀ".
 *
 * Folding them on BOTH sides is what makes search survive that. A PDF that
 * maps everything and one that drops these marks then normalise to the same
 * string, so the same query finds both. The side effect is a looser match —
 * ਮਖ also reaches ਮੁਖ — which for a newspaper search is the right way to be
 * wrong: a reader would rather see one extra page than miss the story.
 *
 * The horizontal signs (ਾ ਿ ੀ) are kept. They sit on the baseline, come
 * through reliably, and carry too much meaning to discard.
 */
const FOLDABLE_MARKS =
  /[\u0A41\u0A42\u0A47\u0A48\u0A4B\u0A4C\u0A71\u0A02\u0A70\u0A01\u0A4D\u0A3C]/gu;

const SPLIT_CLUSTER = new RegExp(`(${GURMUKHI}) (?=${GURMUKHI})`, "gu");
const PRE_BASE_VOWEL = new RegExp(`${SIHARI}(${GURMUKHI})`, "gu");

/**
 * Decompose, then drop the foldable marks.
 *
 * NFD first because six Gurmukhi letters have two spellings: ਫ਼ is either the
 * single character U+0A5E or ਫ followed by a nukta, and the two are different
 * strings. Extraction emitted the precomposed form while a reader types the
 * decomposed one, so "ਗ੍ਰਿਫ਼ਤਾਰ" found nothing until both were decomposed.
 */
function fold(text: string): string {
  return text.normalize("NFD").replace(FOLDABLE_MARKS, "");
}

/** Repair a page's extracted text so it can be indexed and read back. */
export function normalizeExtractedText(text: string): string {
  return fold(
    text
      // Glyphs the font could not map back to Unicode.
      .replace(/\u0000/g, "")
      // A single space inside a run of Gurmukhi is a split cluster, not a word
      // gap; genuine gaps come through wider and survive this.
      .replace(SPLIT_CLUSTER, "$1")
      // Put the pre-base vowel back after its consonant.
      .replace(PRE_BASE_VOWEL, "$1\u0A3F"),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/**
 * Fold a reader's query the same way.
 *
 * No reordering here: what someone types is already in logical order, and
 * applying the pre-base rule to it would move a vowel that is already in the
 * right place.
 */
export function normalizeQuery(query: string): string {
  return fold(query).replace(/\s+/g, " ").trim();
}
