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
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
