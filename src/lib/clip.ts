import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { createClip, findClipByRect, getClip, getPageById } from "@/lib/db/queries";
import { storage } from "@/lib/storage";

/** Short, URL-safe, unguessable id for a shared clip. */
export function clipId(): string {
  return randomBytes(6).toString("base64url");
}

export interface ClipRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class ClipError extends Error {}

/** Four decimals is sub-pixel on a 1700px page, and makes the dedup lookup an
 *  exact match rather than a range scan. */
const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * Crop a region of a page and store it as a shareable image.
 *
 * The rectangle arrives as fractions of the page, not pixels. A reader selects
 * on whatever size their screen loaded, and storing pixels would make the clip
 * wrong the moment a page is re-rendered at a different resolution. Fractions
 * survive that.
 */
export async function createPageClip(
  pageId: number,
  rect: ClipRect,
): Promise<{ id: string; url: string }> {
  const page = getPageById(pageId);
  if (!page) throw new ClipError("No such page");

  // Round first, then validate. Rounding can only move an edge outwards by
  // 0.00005, and validating the raw rectangle would let a selection at the far
  // right round past the bound the clips table enforces.
  const r = {
    x: round4(rect.x),
    y: round4(rect.y),
    w: round4(rect.w),
    h: round4(rect.h),
  };

  const within =
    r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 &&
    r.x + r.w <= 1.0001 && r.y + r.h <= 1.0001;
  if (!within) throw new ClipError("Selection is outside the page");

  // A sliver is almost always a mis-drag rather than a real selection.
  if (r.w < 0.02 || r.h < 0.01) {
    throw new ClipError("Selection is too small to share");
  }

  const store = storage();

  const existing = findClipByRect(pageId, r);
  if (existing?.storage_key) {
    return { id: existing.id, url: store.url(existing.storage_key) };
  }

  const source = await store.get(`${page.storage_prefix}/full.webp`);
  const meta = await sharp(source).metadata();
  const sw = meta.width ?? page.width;
  const sh = meta.height ?? page.height;

  // Round inwards so rounding can never ask for a pixel past the edge, which
  // sharp rejects outright.
  const left = Math.max(0, Math.round(r.x * sw));
  const top = Math.max(0, Math.round(r.y * sh));
  const width = Math.max(1, Math.min(Math.round(r.w * sw), sw - left));
  const height = Math.max(1, Math.min(Math.round(r.h * sh), sh - top));

  const id = clipId();
  const key = `clips/${id}.webp`;

  // JPEG-quality WebP on a white background: clips are shared into WhatsApp,
  // which re-compresses anything it receives, so starting clean matters.
  const body = await sharp(source)
    .extract({ left, top, width, height })
    .flatten({ background: "#ffffff" })
    .webp({ quality: 88 })
    .toBuffer();

  await store.put(key, body, "image/webp");
  createClip({ id, page_id: pageId, ...r, storage_key: key });

  return { id, url: store.url(key) };
}

export function clipUrl(id: string): string | null {
  const clip = getClip(id);
  if (!clip?.storage_key) return null;
  return storage().url(clip.storage_key);
}
