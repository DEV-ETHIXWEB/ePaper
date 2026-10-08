import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";
import { normalizeExtractedText } from "@/lib/gurmukhi";

/**
 * Three sizes per page, because a newspaper page is read three ways: picked
 * from a strip of thumbnails, read at screen width, then zoomed into. Serving
 * the zoom render for all three is what makes most epaper sites feel heavy —
 * their current one ships a 1.6 MB JPEG for every page view.
 */
export const VARIANTS = {
  full: { width: 2400, quality: 82 },
  read: { width: 1200, quality: 78 },
  thumb: { width: 320, quality: 70 },
} as const;

export type VariantName = keyof typeof VARIANTS;

export interface RenderedPage {
  pageNumber: number;
  width: number;
  height: number;
  variants: Record<VariantName, Buffer>;
  /** The page's text layer, empty when the PDF carries no extractable text. */
  text: string;
}

/**
 * Pull the text layer out of an already-open page.
 *
 * Nearly free here because the page object is loaded for rendering anyway.
 * Comes back empty for a scanned or outlined PDF, which is a real possibility
 * for newsprint and is treated as "no text", not as a failure.
 */
async function extractText(page: {
  getTextContent: () => Promise<{ items: unknown[] }>;
}): Promise<string> {
  try {
    const content = await page.getTextContent();
    const out: string[] = [];
    for (const raw of content.items) {
      const item = raw as { str?: string; hasEOL?: boolean };
      if (typeof item.str !== "string") continue;
      out.push(item.str);
      // Newspaper columns arrive as many short runs; without the EOL hint the
      // whole page collapses into one unbroken line.
      if (item.hasEOL) out.push("\n");
    }
    return normalizeExtractedText(
      out
        .join(" ")
        // Control characters are stripped because search highlighting uses two
        // of them as markers; text carrying its own would open a stray tag.
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    );
  } catch {
    return "";
  }
}

/**
 * Render each page of a PDF.
 *
 * pdfjs rather than a poppler subprocess: the same code runs on a developer's
 * machine and the Linux host with no system packages to keep in step, and
 * there is no shell to quote filenames into.
 *
 * `onPage` is called as each page finishes so a long edition can report
 * progress instead of going quiet for a minute.
 */
export async function renderPdf(
  data: Uint8Array,
  opts: { scale?: number; onPage?: (n: number, total: number) => void } = {},
): Promise<RenderedPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // pdfjs takes ownership of the buffer it is given and detaches it, leaving
  // the caller holding a zero-length array. That turns any retry of the same
  // upload into a misleading "PDF is empty". Hand it a copy so the caller's
  // data stays intact and an ingest can safely be run again.
  const owned = new Uint8Array(data.byteLength);
  owned.set(data);

  const loadingTask = pdfjs.getDocument({
    data: owned,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;

  try {
    const pages: RenderedPage[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: opts.scale ?? 2.0 });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      const ctx = canvas.getContext("2d");
      // Newsprint PDFs often have no background; without this, transparent
      // areas come out black once flattened into WebP.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // pdfjs types its canvas against the DOM; @napi-rs/canvas implements the
      // same drawing surface in Node but is not an HTMLCanvasElement. The cast
      // is confined to this call rather than loosening the module's types.
      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
        canvas: canvas as unknown as HTMLCanvasElement,
      }).promise;
      const png = canvas.toBuffer("image/png");

      const variants = {} as Record<VariantName, Buffer>;
      for (const [name, v] of Object.entries(VARIANTS) as [
        VariantName,
        (typeof VARIANTS)[VariantName],
      ][]) {
        variants[name] = await sharp(png)
          .resize({ width: v.width, withoutEnlargement: true })
          .webp({ quality: v.quality })
          .toBuffer();
      }

      pages.push({
        pageNumber: n,
        width: canvas.width,
        height: canvas.height,
        variants,
        text: await extractText(page),
      });
      page.cleanup();
      opts.onPage?.(n, doc.numPages);
    }
    return pages;
  } finally {
    // pdfjs 6 exposes teardown on the loading task, not the document.
    await loadingTask.destroy();
  }
}
