import { NextResponse } from "next/server";
import { ClipError, createPageClip } from "@/lib/clip";

export const runtime = "nodejs";

/**
 * Clipping is public — readers do it — so it is rate limited. Each clip is a
 * decode, a crop and a write; without a limit this is a cheap way to make the
 * server do expensive work.
 */
const LIMIT = 20;
const WINDOW_MS = 60_000;
const hits = new Map<string, { n: number; resetAt: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || rec.resetAt <= now) {
    hits.set(ip, { n: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.n += 1;
  return rec.n > LIMIT;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) {
    return NextResponse.json({ error: "Too many clips. Try again shortly." }, { status: 429 });
  }

  let body: { pageId?: number; x?: number; y?: number; w?: number; h?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { pageId, x, y, w, h } = body;
  if (
    typeof pageId !== "number" ||
    [x, y, w, h].some((v) => typeof v !== "number" || !Number.isFinite(v))
  ) {
    return NextResponse.json({ error: "Invalid selection." }, { status: 400 });
  }

  try {
    const clip = await createPageClip(pageId, { x: x!, y: y!, w: w!, h: h! });
    return NextResponse.json(clip);
  } catch (err) {
    if (err instanceof ClipError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not create the clip." }, { status: 500 });
  }
}
