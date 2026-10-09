import { getIssue } from "@/lib/db/queries";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Hand the reader the original PDF.
 *
 * Their existing epaper site offers this on every edition, and people use it:
 * the whole paper in one file to read offline or print. Dropping it would be
 * a step backwards from what they have today.
 *
 * Served through here rather than linking the object directly so the download
 * gets a sensible filename, so the storage layout stays private, and so an
 * edition that is still processing cannot be fetched half-written.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publication: string; date: string }> },
) {
  const { publication, date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("Not found", { status: 404 });
  }

  const issue = getIssue(publication, date);
  if (!issue || issue.status !== "ready" || !issue.source_key) {
    return new Response("Not found", { status: 404 });
  }

  let body: Buffer;
  try {
    body = await storage().get(issue.source_key);
  } catch {
    // The row says there is a source but the object is gone. Worth a 404 to
    // the reader and not a 500: nothing they do will fix it.
    return new Response("Not found", { status: 404 });
  }

  const name = `${publication}-${date}.pdf`;
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(body.byteLength),
      "content-disposition": `attachment; filename="${name}"`,
      // Editions never change once published, so this can be cached hard.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
