import {
  getPublicationBySlug,
  insertPages,
  markIssueFailed,
  markIssueReady,
  upsertIssue,
} from "@/lib/db/queries";
import { pagePrefix, sourceKey, storage, issuePrefix } from "@/lib/storage";
import { VARIANTS, renderPdf, type VariantName } from "./render";

export interface IngestResult {
  issueId: number;
  pageCount: number;
  bytesStored: number;
  durationMs: number;
  /** Pages that carried an extractable text layer, so search can find them. */
  pagesWithText: number;
  /**
   * Set when a Punjabi edition yielded text that contains almost no Gurmukhi.
   * That is the signature of a legacy ASCII-mapped font such as AnmolLipi:
   * the PDF looks right but its text layer is unsearchable gibberish.
   */
  textLooksGarbled: boolean;
}

/** Share of characters that are Gurmukhi, ignoring spaces and punctuation. */
function gurmukhiRatio(text: string): number {
  const letters = text.replace(/[^\p{L}\p{M}]/gu, "");
  if (letters.length === 0) return 0;
  const gurmukhi = letters.match(/[\u0A00-\u0A7F]/gu)?.length ?? 0;
  return gurmukhi / letters.length;
}

export class IngestError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "IngestError";
  }
}

/**
 * Take one day's PDF for one publication and make it readable.
 *
 * The order matters. The issue row is claimed first and left in 'processing',
 * so a crash halfway leaves a visible failed edition rather than a silent gap
 * the newsroom only notices when a reader complains. Pages are written to
 * storage before the rows that point at them, so a row never references an
 * object that does not exist.
 */
export async function ingestEdition(input: {
  publicationSlug: string;
  publishDate: string;
  pdf: Uint8Array;
  onProgress?: (done: number, total: number) => void;
}): Promise<IngestResult> {
  const started = Date.now();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.publishDate)) {
    throw new IngestError(`Invalid date: ${input.publishDate}`);
  }
  const publication = getPublicationBySlug(input.publicationSlug);
  if (!publication) {
    throw new IngestError(`No such publication: ${input.publicationSlug}`);
  }
  if (input.pdf.byteLength === 0) {
    throw new IngestError("PDF is empty");
  }

  const issue = upsertIssue(publication.id, input.publishDate);
  const store = storage();

  try {
    // Replacing a day wipes the old objects first, so a shorter re-upload
    // cannot leave orphaned pages from the longer original behind.
    await store.delete(issuePrefix(publication.slug, input.publishDate));

    const pages = await renderPdf(input.pdf, {
      onPage: (n, total) => input.onProgress?.(n, total),
    });
    if (pages.length === 0) {
      throw new IngestError("PDF contained no pages");
    }

    let bytesStored = 0;
    const rows: Array<{
      page_number: number;
      width: number;
      height: number;
      storage_prefix: string;
      text: string;
    }> = [];

    for (const page of pages) {
      const prefix = pagePrefix(
        publication.slug,
        input.publishDate,
        page.pageNumber,
      );
      for (const name of Object.keys(VARIANTS) as VariantName[]) {
        const body = page.variants[name];
        await store.put(`${prefix}/${name}.webp`, body, "image/webp");
        bytesStored += body.byteLength;
      }
      rows.push({
        page_number: page.pageNumber,
        width: page.width,
        height: page.height,
        storage_prefix: prefix,
        text: page.text,
      });
    }

    // Keep the original. Without it a better renderer later means re-scanning
    // paper; with it, the whole archive can be re-rendered from source.
    const src = sourceKey(publication.slug, input.publishDate);
    await store.put(src, Buffer.from(input.pdf), "application/pdf");
    bytesStored += input.pdf.byteLength;

    insertPages(issue.id, rows);
    markIssueReady(issue.id, rows.length, src);

    const withText = rows.filter((r) => r.text.trim().length > 0);
    const combined = withText.map((r) => r.text).join(" ");

    return {
      issueId: issue.id,
      pageCount: rows.length,
      bytesStored,
      durationMs: Date.now() - started,
      pagesWithText: withText.length,
      textLooksGarbled:
        publication.language === "pa" &&
        combined.length > 200 &&
        gurmukhiRatio(combined) < 0.2,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    markIssueFailed(issue.id, message);
    throw new IngestError(`Ingest failed for ${input.publicationSlug} ${input.publishDate}: ${message}`, err);
  }
}
