/**
 * Stub for the `server-only` package.
 *
 * The real module throws on import unless the bundler has replaced it, which is
 * exactly what it is designed to do. The DAL modules under test import it, so
 * Vitest is pointed here instead — nothing else changes about how they run.
 */
export {};