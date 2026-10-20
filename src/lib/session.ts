import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getAuthSecret, getSessionMaxAge, isSecureCookies } from "./env";

/**
 * Stateless session handling.
 *
 * The cookie holds an HS256-signed JWT whose payload is deliberately minimal —
 * only an opaque session id and the user id. No email, name or role is trusted
 * from the token: authorization always re-reads the user row, so a role change
 * or deactivation takes effect immediately rather than at token expiry.
 */

export const SESSION_COOKIE_NAME = "uas_session";

export interface SessionPayload {
  /** Session identifier, for correlation in server logs. */
  sid: string;
  sub: string;
}

function getEncodedKey(): Uint8Array {
  return new TextEncoder().encode(getAuthSecret());
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  const maxAge = getSessionMaxAge();
  return new SignJWT({ sid: payload.sid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer("universal-attendance")
    .setAudience("universal-attendance-web")
    .setExpirationTime(`${maxAge}s`)
    .sign(getEncodedKey());
}

/** Returns null for any malformed, expired or wrongly-signed token. */
export async function decryptSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getEncodedKey(), {
      algorithms: ["HS256"],
      issuer: "universal-attendance",
      audience: "universal-attendance-web",
    });
    if (!payload.sub || typeof payload.sid !== "string") return null;
    return { sub: payload.sub, sid: payload.sid };
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<void> {
  const maxAge = getSessionMaxAge();
  const sid = crypto.randomUUID();
  const token = await encryptSession({ sid, sub: userId });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function readSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}