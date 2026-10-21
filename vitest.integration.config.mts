import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Integration suite: talks to the Firestore emulator.
 *
 * Kept in a separate config because it needs a different environment (node, not
 * jsdom) and the emulator. Splitting it means `npm test` stays fast and never
 * fails merely because Java or the Firebase CLI is unavailable — the emulator
 * suite is opt-in via `npm run test:integration`, which starts the emulator with
 * `firebase emulators:exec`.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"],
    // Tests share one emulator project; running files in parallel would let them
    // clear each other's fixtures mid-run.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      // The DAL modules import `server-only`, which throws outside a bundler.
      // Aliasing it to a no-op lets the real DAL run under plain Node.
      "server-only": fileURLToPath(
        new URL("./tests/integration/stubs/server-only.ts", import.meta.url),
      ),
      // Mirrors the `@/*` -> `src/*` mapping in tsconfig.json.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
