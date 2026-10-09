import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createWorker, type Worker } from "tesseract.js";
import sharp from "sharp";
import { normalizeOcrText } from "@/lib/gurmukhi";

/**
 * Reading the words off a page image.
 *
 * Needed because the newsroom's PDFs carry a text layer written in legacy
 * ASCII-mapped fonts — Satluj and Nanak for Gurmukhi, Chanakya for Devanagari.
 * The page looks like Punjabi but the stored text is meaningless: "ਚੜ੍ਹਦੀਕਲਾ"
 * extracts as "⁄Û∑Á∆’Ò≈", and measured across four real editions the text
 * layer is 0% Gurmukhi.
 *
 * Reverse-engineering those font tables was the alternative. OCR won because
 * it does not care which font was used, keeps working if the newsroom changes
 * one, and handles a scanned page too. It is slower and imperfect, which for
 * search is an acceptable trade: a reader needs enough matching words to find
 * the page, not a faithful transcript.
 */

export type OcrLang = "pan" | "hin" | "eng";

/** Tesseract's language code for a publication's language. */
export function ocrLanguage(language: string): OcrLang {
  if (language === "hi") return "hin";
  if (language === "en") return "eng";
  return "pan";
}

/**
 * One worker per language, kept alive across pages.
 *
 * Starting a worker costs a couple of seconds and downloads the trained data,
 * so creating one per page would dominate the run for a sixteen page edition.
 */
const workers = new Map<string, Promise<Worker>>();

/**
 * Where the trained data lives.
 *
 * Without this tesseract.js writes its models into the process's working
 * directory, which meant eight megabytes of .traineddata landing in the
 * project root. Worse in production: a fresh container would fetch them from
 * a CDN on the first upload of the day, so indexing would silently depend on
 * an outside service being up. Pointing it beside the database puts them on
 * the volume that is already persisted and backed up.
 */
function cacheDir(): string {
  const dir = resolve(
    process.cwd(),
    dirname(process.env.DATABASE_PATH ?? "data/epaper.db"),
    "tessdata",
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function getWorker(lang: OcrLang): Promise<Worker> {
  let existing = workers.get(lang);
  if (!existing) {
    // Punjabi pages carry English too — mastheads, datelines, numbers — so the
    // Latin model is loaded alongside rather than forcing those into Gurmukhi.
    existing = createWorker(lang === "eng" ? "eng" : `${lang}+eng`, undefined, {
      cachePath: cacheDir(),
    });
    workers.set(lang, existing);
  }
  return existing;
}

/** Release the workers. Called when a batch finishes so idle memory is returned. */
export async function shutdownOcr(): Promise<void> {
  const all = [...workers.values()];
  workers.clear();
  await Promise.all(
    all.map(async (p) => {
      try {
        await (await p).terminate();
      } catch {
        /* already gone */
      }
    }),
  );
}

export interface OcrResult {
  text: string;
  confidence: number;
}

/**
 * Read one page image.
 *
 * Greyscale and normalised first: newsprint scans have a warm cast and uneven
 * ink, and flattening that measurably lifts confidence. The image is fed at a
 * generous width because Tesseract's accuracy falls off sharply on small
 * Gurmukhi, where the matras are only a few pixels tall.
 */
export async function ocrPage(
  image: Buffer,
  lang: OcrLang,
): Promise<OcrResult> {
  const prepared = await sharp(image)
    .resize({ width: 2200, withoutEnlargement: true })
    .greyscale()
    .normalise()
    .png()
    .toBuffer();

  const worker = await getWorker(lang);
  const { data } = await worker.recognize(prepared);

  return {
    // Folded, but not repaired. OCR output is already in logical order with
    // real word spacing; the PDF repairs would weld its words together.
    text: normalizeOcrText(data.text ?? ""),
    confidence: data.confidence ?? 0,
  };
}
