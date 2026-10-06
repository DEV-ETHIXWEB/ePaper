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
