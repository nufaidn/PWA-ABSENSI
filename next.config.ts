import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    // Geolocation is required for optional GPS attendance validation.
    value: "geolocation=(self), camera=(), microphone=()",
  },
];

/**
 * Authenticated surfaces must never be written to the HTTP cache, otherwise a
 * shared machine or the service worker could replay one employee's attendance.
 */
const noStoreHeaders = [
  { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
  { key: "Pragma", value: "no-cache" },
];

const nextConfig: NextConfig = {
  /**
   * Cache Components is intentionally disabled. Every screen in this app is
   * request-time and scoped to the signed-in employee, so there is nothing to
   * prerender. Disabling it keeps the standard async-request model instead of
   * forcing every `cookies()` call behind a Suspense boundary for no benefit.
   */
  cacheComponents: false,

  // Firebase Admin uses Node-only transports (gRPC/HTTP2); keep it out of the
  // bundler so Next.js does not try to trace or bundle its native dependencies.
  serverExternalPackages: ["firebase-admin"],

  /**
   * Hosts that may load dev-only assets (`/_next/*`, HMR, Server Action
   * responses) while running `next dev`.
   *
   * Next.js 16 blocks cross-origin requests to those endpoints by default. The
   * dev server counts only `localhost` and the hostname it was started with as
   * same-origin, so a phone opening `http://192.168.x.x:3000` had every JS and
   * CSS chunk answered with `403 Unauthorized`: the HTML arrived, the styling
   * and hydration did not, and the app looked broken on the phone while working
   * fine on the laptop.
   *
   * Only the hostname is matched (no scheme, no port), and `*` matches exactly
   * one label. Wildcards keep this working when DHCP hands out a new LAN
   * address or Tailscale changes its 100.x address. These entries are ignored
   * in production.
   */
  allowedDevOrigins: [
    "192.168.*.*", // private LAN (RFC 1918)
    "10.*.*.*", // private LAN (RFC 1918)
    "172.*.*.*", // private LAN (RFC 1918, docker/VPN ranges)
    "100.*.*.*", // Tailscale / CGNAT
    "*.local", // mDNS names, e.g. laptop.local
    "*.ts.net", // Tailscale MagicDNS
  ],

  /**
   * Tailwind v4 is not a plain stylesheet: `@theme`, `@utility` and `@apply`
   * are Tailwind-specific at-rules that Turbopack's built-in CSS pipeline does
   * not understand. Without this loader the raw directives are passed straight
   * through to the browser, which silently discards them — every utility class
   * in the app then resolves to nothing and the UI renders unstyled.
   */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Attendance-bearing routes: never cached, by browser or intermediary.
        source:
          "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|webp|ico|woff2?)$).*)",
        headers: noStoreHeaders,
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;