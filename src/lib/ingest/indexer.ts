import {
  claimNextIndexJob,
  finishIndexJob,
  listPages,
  releaseStaleIndexJobs,
  setPageText,
} from "@/lib/db/queries";
import { storage } from "@/lib/storage";
import { ocrLanguage, ocrPage, shutdownOcr } from "./ocr";

/**
 * Makes editions searchable, after they are already readable.
 *
 * OCR costs seconds per page, and an edition has eight to seventeen of them.
 * Doing it inside the upload request would hold the newsroom's browser open
 * for minutes and risk the request timing out, so an edition is published
 * first and indexed just behind. The archive is readable immediately; search
 * catches up within a few minutes.
 *
 * One job at a time on purpose. OCR is CPU bound, and running several would
 * only make them all slower while competing with the page rendering that the
 * newsroom is actually waiting on.
 */

let running = false;
let recovered = false;

/** How sure Tesseract has to be before the text is worth indexing. */
const MIN_CONFIDENCE = 40;

async function runJob(): Promise<boolean> {
  const job = claimNextIndexJob();
  if (!job) return false;

  const started = Date.now();
  try {
    const store = storage();
    const pages = listPages(job.issue_id);
    const lang = ocrLanguage(job.publication_language);

    let totalConfidence = 0;
    let counted = 0;

    for (const page of pages) {
      // The reading render, not the zoom one. It is the smaller file and at
      // 1200px still carries more detail than Tesseract uses once the image
      // is scaled for recognition.
      const image = await store.get(`${page.storage_prefix}/read.webp`);
      const { text, confidence } = await ocrPage(image, lang);
      if (confidence >= MIN_CONFIDENCE) {
        setPageText(page.id, text);
        totalConfidence += confidence;
        counted += 1;
      } else {
        // Blank or near-blank pages are common: a full-page advert has almost
        // no text and scores low. Indexing that noise would only pollute
        // results, so the page is simply left out.
        setPageText(page.id, "");
      }
    }

    const average = counted > 0 ? totalConfidence / counted : 0;
    finishIndexJob(job.issue_id, counted > 0 ? "indexed" : "skipped", "ocr", average);
    console.log(
      `[indexer] ${job.publication_slug} ${job.publish_date}: ${counted}/${pages.length} pages, ` +
        `confidence ${average.toFixed(0)}, ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
  } catch (err) {
    // Marked failed rather than left claimed, so it is visible in the admin
    // and can be requeued instead of silently never being searchable.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[indexer] ${job.publication_slug} ${job.publish_date} failed:`, message);
    finishIndexJob(job.issue_id, "failed", null, null);
  }
  return true;
}

/**
 * Start draining the queue if it is not already draining.
 *
 * Returns immediately. Callers are request handlers that must not wait for
 * OCR, so this is deliberately fire and forget.
 */
export function startIndexing(): void {
  if (running) return;
  running = true;

  // Once per process: anything still marked as being worked on belongs to a
  // run that no longer exists, since only one indexer runs at a time.
  if (!recovered) {
    recovered = true;
    const released = releaseStaleIndexJobs();
    if (released > 0) {
      console.log(`[indexer] released ${released} job(s) left claimed by a previous run`);
    }
  }

  void (async () => {
    try {
      while (true) {
        const did = await runJob();
        if (!did) break;
      }
    } finally {
      running = false;
      // Hand back the worker's memory once the queue is empty. The next
      // edition pays the couple of seconds to start one again, which is
      // nothing against the minutes an edition takes to index.
      await shutdownOcr().catch(() => {});
    }
  })();
}

export function isIndexing(): boolean {
  return running;
}
