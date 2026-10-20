"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * PWA install prompt.
 *
 * `beforeinstallprompt` is Chromium-only and is deliberately not the sole
 * mechanism: iOS Safari never fires it, so iOS gets explicit instructions
 * instead. The banner hides itself once the app is already installed.
 *
 * Both the install event and the display mode are external browser signals, so
 * they are read through `useSyncExternalStore` rather than mirrored into state
 * inside an effect.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "uas.install-dismissed";
const STANDALONE_QUERY = "(display-mode: standalone)";

/**
 * Chromium only fires `beforeinstallprompt` once, so the event has to be kept in
 * a module-level slot: it is not React state and never triggers a re-render on
 * its own, only the snapshot read does.
 */
let installPromptEvent: BeforeInstallPromptEvent | null = null;

function subscribeInstallPrompt(onStoreChange: () => void) {
  const onPrompt = (event: Event) => {
    event.preventDefault();
    installPromptEvent = event as BeforeInstallPromptEvent;
    onStoreChange();
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  return () => window.removeEventListener("beforeinstallprompt", onPrompt);
}

function getInstallPromptEvent() {
  return installPromptEvent;
}

function getServerInstallPromptEvent() {
  return null;
}

function clearInstallPromptEvent() {
  installPromptEvent = null;
}

function subscribeDisplayMode(onStoreChange: () => void) {
  const query = window.matchMedia(STANDALONE_QUERY);
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function isStandalone() {
  return (
    window.matchMedia(STANDALONE_QUERY).matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isServer() {
  return false;
}

/** No-op subscription: the value is fixed for the lifetime of the document. */
function subscribeNothing() {
  return () => {};
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

function readDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    // Private browsing can throw on localStorage access.
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, "true");
  } catch {
    // Non-fatal: the banner simply reappears next session.
  }
}

export function InstallPrompt() {
  const event = useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPromptEvent,
    getServerInstallPromptEvent,
  );
  const standalone = useSyncExternalStore(subscribeDisplayMode, isStandalone, isServer);
  const ios = useSyncExternalStore(subscribeNothing, isIOS, isServer);
  const [dismissed, setDismissed] = useState(readDismissed);

  const dismiss = useCallback(() => {
    writeDismissed();
    setDismissed(true);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    clearInstallPromptEvent();
    dismiss();
  }, [event, dismiss]);

  // Suppress the banner entirely on iOS, where there is nothing to install
  // without manual home-screen steps, to avoid nagging users pointlessly.
  if (standalone || dismissed || ios || !event) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-sm rounded-xl border border-border bg-card p-4 surface-elevated lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-primary">
          <Download className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold">Pasang aplikasi ini</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
            Akses absensi lebih cepat langsung dari layar utama.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleInstall}>
              Pasang
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Nanti
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Tutup"
          className="-m-1 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}