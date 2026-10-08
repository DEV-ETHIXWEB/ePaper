import { NextResponse } from "next/server";
import { SESSION_COOKIE, adminConfigured, createSession, safeEqual } from "@/lib/auth";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/** Attempts per IP per minute. Enough for a newsroom, hopeless for a script. */
const LIMIT = 10;
const WINDOW_MS = 60_000;
const attempts = new Map<string, { n: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt <= now) {
    attempts.set(ip, { n: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.n += 1;
  return rec.n > LIMIT;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Wait a minute." }, { status: 429 });
  }

  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Admin sign-in is not configured on this deployment." },
      { status: 500 },
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Both comparisons always run, so a wrong username takes the same time as a
  // wrong password and cannot be told apart.
  const userOk = safeEqual(body.username ?? "", env.ADMIN_USERNAME!);
  const passOk = safeEqual(body.password ?? "", env.ADMIN_PASSWORD!);
  if (!userOk || !passOk) {
    return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
  }

  const token = await createSession(env.ADMIN_USERNAME!, env.AUTH_SECRET!);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
