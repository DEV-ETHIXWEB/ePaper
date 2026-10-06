import { storage } from "@/lib/storage";
import { env } from "@/lib/env";

/**
 * Serves stored objects in development, where the local driver writes to disk.
 *
 * In production the bucket sits behind a CDN and these URLs point straight at
 * it, so this route is never hit. It exists so the same `/media/...` URL shape
 * works in both places and nothing has to change at deploy time.
 */
export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  pdf: "application/pdf",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (env.STORAGE_DRIVER !== "local") {
    return new Response("Not found", { status: 404 });
  }

  const { key } = await params;
  const path = key.join("/");

  // Reject traversal before it reaches the driver. The driver checks too, but
  // a public route should not rely on a downstream guard.
  if (path.includes("..")) {
    return new Response("Bad request", { status: 400 });
  }

  try {
    const body = await storage().get(path);
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
