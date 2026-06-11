/**
 * Microsoft Clarity — loaded only on the Vercel-served web app.
 *
 * Never runs inside the Tauri desktop app, on localhost, or during SSR/build.
 * Mirrors the gating used by the PostHog integration in ./analytics.ts.
 */
const CLARITY_PROJECT_ID = "x5g5rsfxeq";

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[][] };

interface ClarityWindow extends Window {
  clarity?: ClarityFn;
  __TAURI_INTERNALS__?: unknown;
}

let injected = false;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function isTauri(win: ClarityWindow): boolean {
  return "__TAURI_INTERNALS__" in win;
}

function isVercelWebHost(win: ClarityWindow): boolean {
  const host = win.location.hostname.toLowerCase();
  return host === "memephant.com" || host.endsWith(".vercel.app");
}

export function initClarity(): void {
  if (injected || !isBrowser()) return;

  const win = window as ClarityWindow;

  // Web-only: skip the Tauri desktop app, localhost/dev, and any non-Vercel host.
  if (isTauri(win) || !isVercelWebHost(win) || win.clarity) return;

  injected = true;

  const clarity: ClarityFn = (...args: unknown[]) => {
    (clarity.q = clarity.q ?? []).push(args);
  };
  win.clarity = clarity;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;

  const firstScript = document.getElementsByTagName("script")[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }
}
