import { NextResponse, type NextRequest } from "next/server";
import { readSessionToken } from "@/lib/session";
import { decryptSession } from "@/lib/session";

/**
 * Debug endpoint — diagnose session/cookie issues on mobile.
 *
 * Usage:
 * - Desktop: curl https://domain/api/debug/session
 * - Mobile: navigate to https://domain/api/debug/session
 *
 * Remove this endpoint after debugging is complete.
 */
export async function GET(request: NextRequest) {
  const token = await readSessionToken();
  const sessionPayload = token ? await decryptSession(token) : null;

  // Don't leak user IDs, but show cookie presence + basic decode status
  const debugInfo = {
    timestamp: new Date().toISOString(),
    protocol: request.nextUrl.protocol,
    origin: request.nextUrl.origin,
    userAgent: request.headers.get("user-agent"),
    // Cookie diagnostics
    hasCookie: !!token,
    cookieLength: token?.length ?? 0,
    tokenIsValid: !!sessionPayload,
    // Environment info
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    isSecureCookiesEnabled: process.env.NODE_ENV === "production",
  };

  return NextResponse.json(debugInfo);
}
