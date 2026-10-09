/**
 * Working out which edition a dropped PDF is, from its filename.
 *
 * The newsroom exports files like "charhdikala-haryana-9-10-2026.pdf" and
 * "bharat-desh-hamara-punjab-9-10-2026.pdf", so publication and date are
 * already there. Reading them means someone dropping eight files in the
 * morning does not have to set two fields eight times.
 *
 * It is a guess, always shown and always editable. The cost of being wrong is
 * an edition filed under the wrong masthead, so nothing here is applied
 * silently.
 */

export interface PubLike {
  slug: string;
  name: string;
  name_local?: string | null;
  region?: string | null;
}

export interface FilenameGuess {
  date: string | null;
  slug: string | null;
  /** 0 to 1. Below ~0.5 the caller should treat the publication as unknown. */
  confidence: number;
}

/** Letters and digits only, lowercased: "Bharat-Desh_Hamara" and "bharatdeshhamara" compare equal. */
function squash(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Levenshtein distance, abandoned once it exceeds `max`.
 *
 * Needed because the newsroom's spelling and ours differ by a letter in
 * places: their "educator" against our "educater", their "charhdikala"
 * against our "chardikala". Without this, "educator-delhi" scored exactly the
 * same as "chardikala-delhi" (both matched only on the region) and the wrong
 * one won on list order.
 */
function withinDistance(a: string, b: string, max: number): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      best = Math.min(best, row[j]);
    }
    if (best > max) return false;
    prev = row;
  }
  return prev[b.length] <= max;
}

/** Two words are the same word if they match, nest, or are a typo apart. */
function similar(a: string, b: string): boolean {
  if (a === b || a.includes(b) || b.includes(a)) return true;
  // One edit per five characters, so short words still have to match closely.
  const budget = Math.min(2, Math.floor(Math.min(a.length, b.length) / 5));
  return budget > 0 && withinDistance(a, b, budget);
}

function tokens(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);
}

/**
 * Pull a date out of a filename.
 *
 * Day-first, because that is what the newsroom's own exports use
 * ("9-10-2026" is 9 October). An ISO-looking "2026-10-09" is also accepted
 * since it is unambiguous.
 */
export function parseDate(filename: string): string | null {
  const iso = /(20\d{2})[-_.](\d{1,2})[-_.](\d{1,2})/.exec(filename);
  if (iso) {
    const [, y, m, d] = iso;
    return valid(y, m, d);
  }
  const dmy = /(?<![0-9])(\d{1,2})[-_.](\d{1,2})[-_.](20\d{2})/.exec(filename);
  if (dmy) {
    const [, d, m, y] = dmy;
    return valid(y, m, d);
  }
  return null;
}

function valid(y: string, m: string, d: string): string | null {
  const mm = Number(m);
  const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const iso = `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  // Round-trip through Date to reject the 31st of a 30-day month.
  const parsed = new Date(`${iso}T00:00:00Z`);
  return parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

/**
 * Score a filename against one publication.
 *
 * Region carries the most weight, because the titles differ only by region:
 * "charhdikala haryana" and "charhdikala delhi" share every other word, and
 * getting the region wrong files a whole edition under the wrong masthead.
 */
function score(stem: string, pub: PubLike): number {
  const flat = squash(stem);
  const words = tokens(stem);
  let points = 0;
  let possible = 0;

  const nameWords = tokens(pub.name);
  possible += nameWords.length;
  for (const w of nameWords) {
    if (words.some((x) => similar(x, w))) points += 1;
  }

  // The slug often survives almost intact in the filename.
  if (flat.includes(squash(pub.slug))) points += nameWords.length;
  possible += nameWords.length;

  if (pub.region) {
    const region = squash(pub.region);
    possible += 3;
    if (flat.includes(region)) points += 3;
    // A filename naming a different region is positively wrong, not merely
    // unmatched, so it is pushed below the acceptance threshold.
    else if (OTHER_REGIONS.some((r) => r !== region && flat.includes(r))) points -= 3;
  }

  return possible === 0 ? 0 : Math.max(0, points / possible);
}

const OTHER_REGIONS = ["punjab", "haryana", "delhi", "chandigarh"];

export function matchPublication(
  filename: string,
  publications: PubLike[],
): { slug: string | null; confidence: number } {
  // Drop the extension and the date, so neither skews the word matching.
  const stem = filename
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/(?<![0-9])\d{1,2}[-_.]\d{1,2}[-_.]20\d{2}/, " ")
    .replace(/20\d{2}[-_.]\d{1,2}[-_.]\d{1,2}/, " ");

  let best: { slug: string | null; confidence: number } = { slug: null, confidence: 0 };
  for (const pub of publications) {
    const s = score(stem, pub);
    if (s > best.confidence) best = { slug: pub.slug, confidence: s };
  }
  return best;
}

export function guessFromFilename(
  filename: string,
  publications: PubLike[],
): FilenameGuess {
  const { slug, confidence } = matchPublication(filename, publications);
  return {
    date: parseDate(filename),
    slug: confidence >= 0.5 ? slug : null,
    confidence,
  };
}
