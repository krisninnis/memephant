/**
 * Desktop auto-updater service -- wraps tauri-plugin-updater.
 * Only runs inside the Tauri desktop app; no-ops in browser.
 *
 * Flow (mirrors iOS/Android):
 *  1. checkForUpdate()  → returns UpdateInfo if a newer version is on GitHub, else null
 *  2. downloadAndInstall(onProgress)  → downloads, shows 0–100%, installs silently
 *  3. After install: caller sets 'ready' state and shows "Restart to finish" prompt
 *  4. relaunch()  → closes and reopens the app with the new binary
 */

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export const DESKTOP_RELEASES_URL = 'https://github.com/krisninnis/memephant/releases/latest';
export const DESKTOP_DOWNLOAD_URL = 'https://memephant.com/download/';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpdateInfo {
  version: string;
  body: string | null;  // release notes from GitHub
  date: string | null;  // ISO publish date
}

export type UpdateErrorCode =
  | 'not-desktop'
  | 'updater-unavailable'
  | 'release-metadata'
  | 'network'
  | 'unknown';

export class DesktopUpdateError extends Error {
  code: UpdateErrorCode;

  constructor(code: UpdateErrorCode, message: string) {
    super(message);
    this.name = 'DesktopUpdateError';
    this.code = code;
  }
}

export type UpdateStatus =
  | { type: 'idle' }
  | { type: 'checking' }
  | { type: 'available'; info: UpdateInfo }
  | { type: 'up-to-date' }
  | { type: 'downloading'; percent: number }
  | { type: 'ready' }            // downloaded + installed, waiting for restart
  | { type: 'error'; message: string };

// ─── Version helpers ──────────────────────────────────────────────────────────

/**
 * Returns the version string from tauri.conf.json (e.g. "0.2.0").
 * Falls back to "—" if running in browser.
 */
export async function getInstalledVersion(): Promise<string> {
  if (!isTauri()) return '—';
  try {
    // @tauri-apps/api/app is part of @tauri-apps/api core — always available
    const { getVersion } = await import(/* @vite-ignore */ '@tauri-apps/api/app');
    return await getVersion();
  } catch {
    return '—';
  }
}

// ─── Update check ─────────────────────────────────────────────────────────────

/**
 * Check GitHub releases for a newer version.
 * Returns UpdateInfo if one is available, null if already up to date.
 * Throws on network / config errors.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) {
    throw new DesktopUpdateError(
      'not-desktop',
      'Desktop updates are only available in the installed Tauri app.',
    );
  }

  try {
    const updaterModule = await import(/* @vite-ignore */ '@tauri-apps/plugin-updater');
    const update = await updaterModule.check();

    if (!update?.available) return null;

    return {
      version: (update.version as string) ?? 'unknown',
      body: (update.body as string | null | undefined) ?? null,
      date: (update.date as string | null | undefined) ?? null,
    };
  } catch (error) {
    throw normaliseUpdateError(error);
  }
}

// ─── Download + install ───────────────────────────────────────────────────────

/**
 * Download and silently install the available update.
 * Calls onProgress with 0–100 so the UI can show a progress bar.
 * Does NOT restart automatically — caller should show a "Restart" prompt
 * and call relaunch() when the user is ready.
 */
export async function downloadAndInstall(
  onProgress?: (percent: number) => void,
): Promise<void> {
  if (!isTauri()) {
    throw new DesktopUpdateError(
      'not-desktop',
      'Desktop updates are only available in the installed Tauri app.',
    );
  }

  type UpdaterProgressEvent =
    | { event: 'Started'; data: { contentLength?: number } }
    | { event: 'Progress'; data: { chunkLength?: number } }
    | { event: 'Finished' };

  try {
    const updaterModule = await import(/* @vite-ignore */ '@tauri-apps/plugin-updater');
    const update = await updaterModule.check();
    if (!update?.available) return;

    let downloaded = 0;
    let total = 0;

    await update.downloadAndInstall((event: UpdaterProgressEvent) => {
      switch (event.event) {
        case 'Started':
          total = event.data.contentLength ?? 0;
          onProgress?.(0);
          break;
        case 'Progress':
          downloaded += event.data.chunkLength ?? 0;
          if (total > 0 && onProgress) {
            onProgress(Math.min(99, Math.round((downloaded / total) * 100)));
          }
          break;
        case 'Finished':
          onProgress?.(100);
          break;
      }
    });
  } catch (error) {
    throw normaliseUpdateError(error);
  }
}

// ─── Relaunch ─────────────────────────────────────────────────────────────────

/**
 * Close and reopen the app so the newly installed version takes effect.
 * Equivalent to pressing "Restart Now" on an iOS or Android update prompt.
 */
export async function relaunch(): Promise<void> {
  if (!isTauri()) return;
  try {
    // @tauri-apps/plugin-process provides relaunch()
    const processModule = await import(/* @vite-ignore */ '@tauri-apps/plugin-process');
    await processModule.relaunch();
  } catch {
    // Plugin might not be registered — fall back to a hard reload
    window.location.reload();
  }
}

function normaliseUpdateError(error: unknown): DesktopUpdateError {
  if (error instanceof DesktopUpdateError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes('endpoint') ||
    lower.includes('configure') ||
    lower.includes('pubkey') ||
    lower.includes('public key')
  ) {
    return new DesktopUpdateError(
      'release-metadata',
      'Desktop updater release metadata is missing or not configured correctly.',
    );
  }

  if (
    lower.includes('import') ||
    lower.includes('module') ||
    lower.includes('plugin') ||
    lower.includes('permission')
  ) {
    return new DesktopUpdateError(
      'updater-unavailable',
      'The desktop updater plugin is not available in this build.',
    );
  }

  if (
    lower.includes('fetch') ||
    lower.includes('network') ||
    lower.includes('dns') ||
    lower.includes('timed out') ||
    lower.includes('status')
  ) {
    return new DesktopUpdateError(
      'network',
      'Could not reach the desktop release server. Check your internet connection and try again.',
    );
  }

  return new DesktopUpdateError(
    'unknown',
    message || 'Desktop update check failed.',
  );
}
