import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/auth";

/**
 * Guards the newsroom area.
 *
 * `proxy.ts`, not `middleware.ts`: the middleware convention is deprecated in
 * Next 16 and renamed, with the same behaviour.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await readSession(
    request.cookies.get(SESSION_COOKIE)?.value,
    process.env.AUTH_SECRET,
  );

  // Signing in and out must stay reachable without a session, or the only way
  // to get one is blocked by the guard that needs it.
  const isAuthEndpoint =
    pathname.startsWith("/api/admin/login") || pathname.startsWith("/api/admin/logout");
  if (isAuthEndpoint) return NextResponse.next();

  if (pathname.startsWith("/admin/login")) {
    return session
      ? NextResponse.redirect(new URL("/admin/", request.url))
      : NextResponse.next();
  }

  if (session) return NextResponse.next();

  // API callers get a status, not a login page they cannot render.
  if (pathname.startsWith("/api/admin/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const login = new URL("/admin/login/", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  /**
   * The upload endpoint is deliberately absent.
   *
   * When a route is behind the proxy, Next clones and buffers the whole
   * request body in memory so it can be read twice, capped by
   * experimental.proxyClientMaxBodySize, which defaults to 10MB. Their largest
   * daily edition is a 20MB PDF, so every upload of it was silently truncated
   * and then rejected as "not a file upload". Raising the cap would work but
   * would hold a whole newspaper in memory on every upload.
   *
   * So that route authenticates itself, with requireSession(), and streams
   * its body instead.
   */
  matcher: [
    "/admin/:path*",
    "/api/admin/login",
    "/api/admin/logout",
  ],
};
