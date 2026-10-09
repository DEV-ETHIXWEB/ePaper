import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { indexingStats, requeueIndexing } from "@/lib/db/queries";
import { startIndexing, isIndexing } from "@/lib/ingest/indexer";

export const runtime = "nodejs";

/**
 * Put editions back in the text queue and start draining it.
 *
 * Two reasons this exists. Recovery, when an edition failed indexing and would
 * otherwise sit unsearchable forever with nothing in the interface to say so.
 * And reprocessing, for when the extraction pipeline improves and the whole
 * archive should be read again.
 */
export async function POST(request: Request) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";

  const requeued = requeueIndexing({ all });
  startIndexing();

  return NextResponse.json({ ok: true, requeued, running: isIndexing() });
}

export async function GET(request: Request) {
  if (!(await requireSession(request))) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  return NextResponse.json({ running: isIndexing(), stats: indexingStats() });
}
