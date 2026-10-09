import { NextResponse } from "next/server";
import { IngestError, ingestEdition } from "@/lib/ingest";
import { getPublicationBySlug } from "@/lib/db/queries";
import { requireSession } from "@/lib/auth";

export const runtime = "nodejs";
/** A thirty-page edition takes a while to render; do not cut it off. */
export const maxDuration = 300;

/** Newspaper PDFs are large but not unlimited; refuse obvious mistakes early. */
const MAX_BYTES = 300 * 1024 * 1024;

export async function POST(request: Request) {
  // This route is outside the proxy matcher so its body is not buffered, which
  // means the session check that the proxy would have done happens here.
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }

  const slug = String(form.get("publication") ?? "");
  const date = String(form.get("date") ?? "");
  const file = form.get("file");

  if (!slug || !getPublicationBySlug(slug)) {
    return NextResponse.json({ error: "Choose a publication." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Choose a valid date." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a PDF." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That file is ${(file.size / 1024 / 1024).toFixed(0)} MB. The limit is 300 MB.` },
      { status: 413 },
    );
  }
  // Check the magic bytes, not the filename: a renamed .doc would otherwise
  // reach the renderer and fail with something unhelpful.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  if (!header.startsWith("%PDF")) {
    return NextResponse.json({ error: "That does not look like a PDF." }, { status: 400 });
  }

  try {
    const result = await ingestEdition({
      publicationSlug: slug,
      publishDate: date,
      pdf: bytes,
    });
    return NextResponse.json({
      ok: true,
      pageCount: result.pageCount,
      megabytes: Number((result.bytesStored / 1024 / 1024).toFixed(2)),
      seconds: Number((result.durationMs / 1000).toFixed(1)),
    });
  } catch (err) {
    const message =
      err instanceof IngestError ? err.message : "Could not process that PDF.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
