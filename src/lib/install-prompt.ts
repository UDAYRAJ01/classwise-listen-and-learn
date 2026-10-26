// "App install karo": keeps the browser's install offer so the Profile screen can show it later.
import { useSyncExternalStore } from "react";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState =
  | { kind: "installed" }
  | { kind: "ready" }
  | { kind: "ios" }
  | { kind: "manual" };

let offer: InstallEvent | null = null;
let installed = false;
let started = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Call once at app start: the offer arrives only once, often before Profile is opened. */
export function startInstallCapture() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    offer = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    offer = null;
    emit();
  });
}

function standalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function read(): InstallState {
  if (installed || standalone()) return { kind: "installed" };
  if (offer) return { kind: "ready" };
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return { kind: "ios" };
  return { kind: "manual" };
}

let cached: InstallState = { kind: "manual" };
function snapshot(): InstallState {
  const next = read();
  if (next.kind !== cached.kind) cached = next;
  return cached;
}

const SERVER: InstallState = { kind: "manual" };

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot,
    () => SERVER,
  );
}

/** Shows the browser's install dialog. Returns true when the student accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!offer) return false;
  const e = offer;
  await e.prompt();
  const { outcome } = await e.userChoice;
  offer = null;
  if (outcome === "accepted") installed = true;
  emit();
  return outcome === "accepted";
}
