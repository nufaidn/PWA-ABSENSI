"use client";

import { useEffect } from "react";

/**
 * Registers the service worker after the page has settled.
 *
 * Registration is skipped in development because a cached worker would serve
 * stale modules and make hot reload appear broken. It also waits for the
 * `load` event so worker setup never competes with the first meaningful paint
 * on a slow mobile connection.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // A failed registration must never break the app; it only means the
        // install prompt and offline shell are unavailable.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}