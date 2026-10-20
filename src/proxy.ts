import { NextResponse, type NextRequest } from "next/server";
import { decryptSession } from "@/lib/session";

/**
 * Session-based navigation guard.
 *
 * This is deliberately an *optimistic* check: it redirects signed-out visitors
 * away from private screens so they never see an empty shell. It is NOT the
 * authorization boundary — `proxy.ts` is skipped for Server Function POSTs, and
 * a token could be revoked between this check and the render. Every DAL
 * function re-verifies the session against the database.
 */

/**
 * Paths reachable without a session.
 *
 * Matched **exactly**. A prefix match would be wrong here in both directions:
 * treating `/admin` as a prefix would expose `/admin/employees`, `/admin/reports`
 * and every other admin screen to signed-out visitors, since they share the
 * prefix. Only the sign-in page itself is public.
 */
const PUBLIC_PATHS = new Set(["/login", "/admin"]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("uas_session")?.value;
  const session = await decryptSession(token);
  const isSignedIn = Boolean(session);

  if (!isSignedIn && !isPublicPath(pathname)) {
    // Admins land on the admin sign-in, everyone else on the employee one, so a
    // bookmarked `/admin/employees` does not drop an administrator on a form
    // that would reject them.
    const signInPath = pathname.startsWith("/admin") ? "/admin" : "/login";
    const loginUrl = new URL(signInPath, request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isSignedIn && isPublicPath(pathname)) {
    // `/` resolves per role — the admin dashboard for an admin, the employee one
    // otherwise — so both sign-in pages hand off there.
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Skip Next.js internals, the API routes (they do their own authorization)
     * and every static asset. Matchers must be statically analysable, so the
     * patterns are literals rather than composed strings.
     */
    "/((?!api|_next/static|_next/image|sw.js|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff2?)$).*)",
  ],
};