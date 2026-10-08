import { env } from "@/lib/env";

/**
 * Signed-cookie sessions, no session store.
 *
 * Web Crypto rather than node:crypto so the same verification runs in
 * proxy.ts, which may execute on the edge.
 */
export const SESSION_COOKIE = "ctv_epaper_admin";
const TTL_SECONDS = 60 * 60 * 12;

function b64url(bytes: Uint8Array<ArrayBufferLike>): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export interface Session {
  user: string;
  exp: number;
}

export async function createSession(user: string, secret: string): Promise<string> {
  const payload: Session = { user, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await key(secret), new TextEncoder().encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export async function readSession(
  token: string | undefined,
  secret: string | undefined,
): Promise<Session | null> {
  if (!token || !secret) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await key(secret),
      fromB64url(sig),
      new TextEncoder().encode(body),
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Session;
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

/** Comparison whose timing does not reveal where two strings diverge. */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export function adminConfigured(): boolean {
  return Boolean(env.AUTH_SECRET && env.ADMIN_USERNAME && env.ADMIN_PASSWORD);
}
