import "server-only";

/**
 * Server-side environment access.
 *
 * Only the Data Access Layer and server modules are allowed to read secrets —
 * never a Client Component. Values are validated eagerly so a misconfigured
 * deployment fails loudly at startup instead of at the first login attempt.
 */

const SESSION_MAX_AGE_FALLBACK = 60 * 60 * 24 * 7; // 7 days

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example for the expected values.`,
    );
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
  return process.env.NODE_ENV === "production";
}

export function getSeedDefaultPassword(): string {
  return process.env.SEED_DEFAULT_PASSWORD ?? "Password123!";
}