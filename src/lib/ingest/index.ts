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
      });
    }

    // Keep the original. Without it a better renderer later means re-scanning
    // paper; with it, the whole archive can be re-rendered from source.
    const src = sourceKey(publication.slug, input.publishDate);
    await store.put(src, Buffer.from(input.pdf), "application/pdf");
    bytesStored += input.pdf.byteLength;

    insertPages(issue.id, rows);
    markIssueReady(issue.id, rows.length, src);

    return {
      issueId: issue.id,
      pageCount: rows.length,
      bytesStored,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    markIssueFailed(issue.id, message);
    throw new IngestError(`Ingest failed for ${input.publicationSlug} ${input.publishDate}: ${message}`, err);
  }
}
