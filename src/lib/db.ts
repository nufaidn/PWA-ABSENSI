import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 requires an explicit driver adapter; the client no longer bundles
 * its own Rust-based connection layer.
 *
 * A single instance is cached on `globalThis` so Next.js hot reloads in
 * development do not exhaust the PostgreSQL connection pool.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Supabase's session pooler allows only 15 clients for the whole project, while
 * `pg` defaults to 10 per pool. On Vercel every warm function instance owns its
 * own pool, so two instances are enough to hit that ceiling — the
 * `EMAXCONNSESSION` failure this setting prevents. Production therefore keeps
 * one connection per instance; development can afford a few more because there
 * is only a single server process.
 *
 * Override with `DATABASE_POOL_MAX` when moving to a transaction pooler or a
 * database with a larger connection budget.
 */
function resolvePoolMax(): number {
  const configured = Number(process.env.DATABASE_POOL_MAX);
  if (Number.isFinite(configured) && configured >= 1) return Math.floor(configured);
  return process.env.NODE_ENV === "production" ? 1 : 3;
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure the database.",
    );
  }
  const adapter = new PrismaPg({
    connectionString,
    max: resolvePoolMax(),
    // Fail with a clear pool timeout instead of hanging forever when every
    // server-side connection is in use.
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export type { PrismaClient } from "@/generated/prisma/client";