import { NextResponse } from "next/server";
import { db } from "@/lib/db/index";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness for the container and for whatever watches it.
 *
 * It touches the database and the object store rather than just returning
 * 200, because the failure that actually happens here is the data volume not
 * being mounted. The process stays up perfectly happily in that state and
 * serves an empty archive, which is worse than being down.
 */
export async function GET() {
  const checks: Record<string, string> = {};
  let ok = true;

  try {
    const row = db().prepare("SELECT COUNT(*) AS n FROM publications").get() as { n: number };
    checks.database = `ok (${row.n} publications)`;
  } catch (err) {
    ok = false;
    checks.database = err instanceof Error ? err.message : "failed";
  }

  try {
    await storage().put("health/.probe", Buffer.from("ok"), "text/plain");
    checks.storage = "ok";
  } catch (err) {
    ok = false;
    checks.storage = err instanceof Error ? err.message : "failed";
  }

  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
