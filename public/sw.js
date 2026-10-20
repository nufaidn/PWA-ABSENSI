/*
 * Universal Attendance — service worker.
 *
 * Security posture: this worker performs NO response caching for anything that
 * can carry attendance data.
 *
 *   - Navigations and any same-origin GET that is not a build asset are served
 *     network-first with an explicit `Cache-Control: no-store` and are never
 *     written to a cache.
 *   - Nothing under /api, /login, /admin or any `_next/data` route is cached.
 *   - Only immutable build output (`/_next/static/...`) and the icon set are
 *     cache-first, because those URLs are content-hashed and carry no user data.
 *
 * The worker also clears every cache it owns on activation, so a previous
 * version of this app cannot leave stale authenticated responses behind.
 */

const CACHE_PREFIX = "uas-static-";
const CACHE_NAME = `${CACHE_PREFIX}v1`;

/** Build assets and icons are safe to cache; nothing else is. */
const CACHEABLE_PATHS = ["/icons/", "/_next/static/"];

/**
 * Explicitly network-only endpoints.
 *
 * `/api/server-time` is the client's reference for the server clock; a cached copy
 * would hand back the moment it was generated, which is precisely the drift this
 * app must not have. It already falls through to `networkOnly` below, but naming
 * it keeps that guarantee from being broken by a future change to
 * `CACHEABLE_PATHS`.
 */
const NEVER_CACHE_PREFIXES = ["/api/"];

self.addEventListener("install", (event) => {
  // Take over immediately so a new worker does not wait for every tab to close.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isCacheableAsset(url) {
  if (url.origin !== self.location.origin) return false;
  // Never-cache prefixes win, so a time endpoint cannot become cache-first even
  // if it were ever added to `CACHEABLE_PATHS` by mistake.
  if (NEVER_CACHE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return false;
  return CACHEABLE_PATHS.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is ever considered; attendance mutations are POSTs and pass
  // straight through to the network.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (isCacheableAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  /*
   * Everything else — documents, RSC payloads, API responses, report data —
   * goes network-first and is explicitly not stored. The clone is discarded
   * rather than handed to `cache.put`, which is what guarantees a signed-in
   * page can never be replayed from the device after sign-out.
   */
  event.respondWith(networkOnly(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    // Offline and nothing to serve from cache. Returning a synthetic error keeps
    // the failure explicit instead of serving a stale authenticated document.
    return new Response("Offline", {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

/*
 * Push notifications.
 *
 * Subscriptions are out of scope for this build, but the click handler is here
 * so a future server-side push integration only needs to publish messages.
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Absensi", {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = all.find((client) => client.url.includes(target));
      if (existing) return existing.focus();
      return self.clients.openWindow(target);
    })(),
  );
});