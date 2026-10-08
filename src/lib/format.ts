const MONTHS_PA = ["ਜਨਵਰੀ","ਫ਼ਰਵਰੀ","ਮਾਰਚ","ਅਪ੍ਰੈਲ","ਮਈ","ਜੂਨ","ਜੁਲਾਈ","ਅਗਸਤ","ਸਤੰਬਰ","ਅਕਤੂਬਰ","ਨਵੰਬਰ","ਦਸੰਬਰ"];
const MONTHS_HI = ["जनवरी","फ़रवरी","मार्च","अप्रैल","मई","जून","जुलाई","अगस्त","सितंबर","अक्तूबर","नवंबर","दिसंबर"];
const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

/**
 * Dates are formatted from explicit month names, not Intl.
 *
 * Chromium ships without `pa` locale data and renders "6 ਅਕਤੂਬਰ" as "M10 6".
 * Node has the data, so a server-rendered date looks right while anything
 * rendered in the browser breaks — and this audience is largely on Android,
 * where trimmed ICU builds are common.
 */
export function formatDate(iso: string, lang: "pa" | "hi" | "en" = "pa"): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, y, mm, dd] = m;
  const months = lang === "hi" ? MONTHS_HI : lang === "en" ? MONTHS_EN : MONTHS_PA;
  return `${Number(dd)} ${months[Number(mm) - 1]} ${y}`;
}

export function todayISO(): string {
  // The newsroom and its readers are in IST; the server may not be.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const WEEKDAYS_PA = ["ਐਤ", "ਸੋਮ", "ਮੰਗਲ", "ਬੁੱਧ", "ਵੀਰ", "ਸ਼ੁੱਕਰ", "ਸ਼ਨੀ"];
const WEEKDAYS_HI = ["रवि", "सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type Lang = "pa" | "hi" | "en";

/** Short weekday names, Sunday first, for the archive calendar. */
export function weekdayNames(lang: Lang = "pa"): string[] {
  return lang === "hi" ? WEEKDAYS_HI : lang === "en" ? WEEKDAYS_EN : WEEKDAYS_PA;
}

/** "2026-10" to "ਅਕਤੂਬਰ 2026". Same reason as formatDate: no Intl. */
export function formatMonth(month: string, lang: Lang = "pa"): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  const [, y, mm] = m;
  const months = lang === "hi" ? MONTHS_HI : lang === "en" ? MONTHS_EN : MONTHS_PA;
  return `${months[Number(mm) - 1]} ${y}`;
}

/** The month an ISO date falls in. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * Month arithmetic in UTC.
 *
 * A local-time Date rolls into the wrong month for anyone west of UTC on the
 * first of the month, which would quietly skip a month in the calendar nav.
 */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Day cells for a month grid: leading blanks, then every day, Sunday first. */
export function monthGrid(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array(first.getUTCDay()).fill(null);
  for (let d = 1; d <= days; d += 1) {
    cells.push(`${month}-${String(d).padStart(2, "0")}`);
  }
  return cells;
}
