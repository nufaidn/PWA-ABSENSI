import "server-only";

/**
 * Server-side environment access.
 *
 * Only the Data Access Layer and server modules are allowed to read secrets —
 * never a Client Component. Values are validated eagerly so a misconfigured
 * deployment fails loudly at startup instead of at the first login attempt.
 */

const SESSION_MAX_AGE_FALLBACK = 60 * 60 * 24 * 7; // 7 days

/**
 * Raised when a required environment variable is absent.
 *
 * Like `FirebaseConfigurationError`, this exists so the UI can say "the server
 * is not configured, variable X is missing" instead of showing a generic error
 * page that gives the operator nothing to act on.
 */
export class MissingEnvironmentVariableError extends Error {
  readonly variable: string;

  constructor(variable: string) {
    super(
      `Missing required environment variable ${variable}. See .env.example for the expected values.`,
    );
    this.name = "MissingEnvironmentVariableError";
    this.variable = variable;
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new MissingEnvironmentVariableError(name);
  }
  return value;
}

export function getAuthSecret(): string {
  const secret = required("AUTH_SECRET");
  // HS256 needs at least 256 bits of key material.
  if (Buffer.from(secret, "base64").length < 32 && secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be at least 32 characters. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  return secret;
}

export function getSessionMaxAge(): number {
  const raw = process.env.SESSION_MAX_AGE;
  if (!raw) return SESSION_MAX_AGE_FALLBACK;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return SESSION_MAX_AGE_FALLBACK;
  // Cap at 30 days: longer-lived stateless tokens are a needless risk.
  return Math.min(parsed, 60 * 60 * 24 * 30);
}

export function isSecureCookies(): boolean {
  // Use secure cookies in production. However, on Vercel deployments that might
  // have HTTPS issues or redirect loops due to HTTP/HTTPS mismatch, this can be
  // overridden with DISABLE_SECURE_COOKIES=true (development / debugging only).
  if (process.env.DISABLE_SECURE_COOKIES === "true") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}

/**
 * True for hosts that can only be reached over plain HTTP in practice:
 * loopback and the private IPv4 ranges used by office Wi-Fi and Tailscale.
 *
 * A `Secure` cookie is discarded by the browser when it arrives over HTTP, so
 * treating a LAN address as if it were HTTPS signs the user in on the server
 * and then bounces them straight back to the login page on every request.
 */
export function isLocalOrPrivateHost(host: string | null | undefined): boolean {
  const hostname = (host ?? "").trim().toLowerCase().replace(/^\[|\]$/g, "").split(":")[0];
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "::1") return true;

  const octets = hostname.split(".");
  if (octets.length !== 4 || octets.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const [a, b] = octets.map(Number);
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // Tailscale / CGNAT
  return false;
}

export function getSeedDefaultPassword(): string {
  return process.env.SEED_DEFAULT_PASSWORD ?? "Password123!";
}