import { useEffect, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import packageJson from '../../../package.json';
import { PWAInstallButton } from '../PWAInstallButton';
import { usePWA } from '../../hooks/usePWA';
import {
  DESKTOP_DOWNLOAD_URL,
  DESKTOP_RELEASES_URL,
  DesktopUpdateError,
  checkForUpdate,
  downloadAndInstall,
  getInstalledVersion,
  relaunch,
} from '../../services/updater';
import type { UpdateInfo } from '../../services/updater';


function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

const PRIVACY_SUMMARY = `Memephant stores your project memory on your device first.
Cloud backup is optional. There is no tracking or analytics.

When you click "Copy for [Platform]", text goes to your clipboard only.
Memephant does not connect to ChatGPT, Claude, or any AI service directly.

Source available under BSL 1.1 - inspect the code on GitHub.`;

type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'downloading'
  | 'ready'
  | 'error';

function formatLastChecked(date: Date | null): string | null {
  if (!date) return null;

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 15_000) return 'Checked just now';
  if (diffMs < 60_000) return `Checked ${Math.max(1, Math.floor(diffMs / 1000))} seconds ago`;
  if (diffMs < 3_600_000) return `Checked ${Math.max(1, Math.floor(diffMs / 60_000))} minutes ago`;

  return `Checked ${date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })} at ${date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

function statusDescription(
  phase: UpdatePhase,
  info: UpdateInfo | null,
  progress: number,
  errorMessage: string | null,
): string {
  switch (phase) {
    case 'idle':
      return 'Desktop updates use signed Tauri releases, not Vercel web deploys.';
    case 'checking':
      return 'Checking signed desktop release metadata...';
    case 'available':
      return `Desktop version ${info?.version} is available.`;
    case 'up-to-date':
      return 'No newer desktop release was found for this installed app.';
    case 'downloading':
      return `Downloading update... ${progress}%`;
    case 'ready':
      return 'Update installed - restart to finish';
    case 'error':
      return errorMessage ?? 'Desktop update check failed.';
    default:
      return '';
  }
}

function getDesktopUpdateErrorMessage(error: unknown): string {
  if (error instanceof DesktopUpdateError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Desktop update check failed. Download the latest version manually if this continues.';
}

function statusIcon(phase: UpdatePhase): string {
  switch (phase) {
    case 'up-to-date':
      return 'OK';
    case 'available':
      return 'NEW';
    case 'downloading':
      return '...';
    case 'ready':
      return 'READY';
    case 'error':
      return 'ERR';
    default:
      return '';
  }
}

export function SettingsAbout() {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [installedVersion, setInstalledVersion] = useState<string>('...');
  const [desktopLastChecked, setDesktopLastChecked] = useState<Date | null>(null);
  const [desktopLastResult, setDesktopLastResult] = useState<string | null>(null);
  const [desktopError, setDesktopError] = useState<string | null>(null);

  const { isChecking, updateAvailable, checkForUpdates, applyUpdate, lastChecked } = usePWA();

  useEffect(() => {
    if (isTauri()) {
      void getInstalledVersion().then(setInstalledVersion);
      return;
    }

    setInstalledVersion(packageJson.version);
  }, []);

  useEffect(() => {
    if (!isTauri() || phase !== 'idle') return undefined;

    const timer = window.setTimeout(() => {
      void silentCheck();
    }, 800);

    return () => window.clearTimeout(timer);
  }, [phase]);

  const silentCheck = async () => {
    try {
      const info = await checkForUpdate();
      const checkedAt = new Date();
      setDesktopLastChecked(checkedAt);
      setDesktopError(null);
      if (info) {
        setUpdateInfo(info);
        setDesktopLastResult(`Desktop update available: ${info.version}`);
        setPhase('available');
      } else {
        setUpdateInfo(null);
        setDesktopLastResult('No newer desktop release found.');
        setPhase('idle');
      }
    } catch (error) {
      setDesktopLastChecked(new Date());
      setDesktopLastResult(null);
      setDesktopError(getDesktopUpdateErrorMessage(error));
    }
  };

  const handleCheckForUpdates = async () => {
    if (!isTauri()) return;

    setPhase('checking');
    setDesktopError(null);
    setDesktopLastResult(null);
    try {
      const info = await checkForUpdate();
      setDesktopLastChecked(new Date());
      if (info) {
        setUpdateInfo(info);
        setDesktopLastResult(`Desktop update available: ${info.version}`);
        setPhase('available');
      } else {
        setUpdateInfo(null);
        setDesktopLastResult('No newer desktop release found.');
        setPhase('up-to-date');
      }
    } catch (error) {
      setUpdateInfo(null);
      setDesktopLastChecked(new Date());
      setDesktopError(getDesktopUpdateErrorMessage(error));
      setPhase('error');
    }
  };

  const handleInstallUpdate = async () => {
    setPhase('downloading');
    setDownloadProgress(0);

    try {
      await downloadAndInstall((pct) => setDownloadProgress(pct));
      setPhase('ready');
      setDesktopError(null);
      setDesktopLastResult('Desktop update installed. Restart to finish.');
    } catch (error) {
      setDesktopError(getDesktopUpdateErrorMessage(error));
      setPhase('error');
    }
  };

  const handleRelaunch = () => {
    void relaunch();
  };

  const openLink = (url: string) => {
    if (isTauri()) {
      void openUrl(url);
      return;
    }

    window.open(url, '_blank');
  };

  const webUpdateLabel = isChecking
    ? 'Checking web/PWA updates'
    : updateAvailable
      ? 'Web/PWA update available'
      : 'Check web/PWA updates';

  const webUpdateDescription = isChecking
    ? 'Checking for the latest web/PWA build of Memephant...'
    : updateAvailable
      ? 'A newer web/PWA build is ready. This does not update the installed desktop app.'
      : 'Web/PWA updates are separate from installed desktop releases.';

  const webUpdateButtonText = isChecking
    ? 'Checking...'
    : updateAvailable
      ? 'Install update'
      : 'Check for updates';

  return (
    <div>
      <div className="about-header">
        <div className="about-header__icon">🐘</div>
        <h2 className="settings-section-title about-header__title">Memephant</h2>
        <p className="about-header__subtitle">Keep your project context ready for any AI.</p>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">Details</div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">
              {isTauri() ? 'Current desktop app version' : 'Current web/PWA version'}
            </div>
          </div>
          <span className="setting-badge">v{installedVersion}</span>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">Made by</div>
          </div>
          <span style={{ color: '#888', fontSize: 14 }}>Kris Ninnis</span>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">License</div>
            <div className="setting-description">BSL 1.1 — free for personal use</div>
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">Source code</div>
            <div className="setting-description">View, inspect, or contribute on GitHub</div>
          </div>
          <button
            className="setting-btn"
            onClick={() => openLink('https://github.com/krisninnis/memephant')}
          >
            View on GitHub
          </button>
        </div>

      </div>

      {!isTauri() && (
        <div className="settings-group">
          <div className="settings-group-title">Web/PWA Updates</div>

          <div className="setting-row setting-row--update">
            <div className="setting-info setting-info--grow">
              <div className="setting-label">{webUpdateLabel}</div>
              <div className="setting-description">{webUpdateDescription}</div>
              {formatLastChecked(lastChecked) && (
                <div className="about-update-timestamp">{formatLastChecked(lastChecked)}</div>
              )}
            </div>

            <div className="about-update-actions">
              <button
                className="setting-btn"
                onClick={() => void checkForUpdates()}
                disabled={isChecking}
              >
                {webUpdateButtonText}
              </button>

              {updateAvailable && (
                <button
                  className="setting-btn setting-btn--primary"
                  onClick={() => void applyUpdate()}
                >
                  Install update
                </button>
              )}
            </div>
          </div>

          {!isChecking && !updateAvailable && lastChecked && (
            <div className="settings-trust-box" style={{ marginTop: 12 }}>
              You're already on the latest version.
            </div>
          )}

          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-label">Install App</div>
              <div className="setting-description">
                Install Memephant for quick access from your device.
              </div>
            </div>
            <PWAInstallButton variant="settings" />
          </div>
        </div>
      )}

      {isTauri() && (
        <div className="settings-group">
          <div className="settings-group-title">Desktop Updates</div>

          <div className="setting-row setting-row--update">
            <div className="setting-info setting-info--grow">
              <div className="setting-label about-update-label">
                {statusIcon(phase) && <span style={{ fontSize: 12 }}>{statusIcon(phase)}</span>}
                {phase === 'available' && updateInfo
                  ? `Memephant ${updateInfo.version} is available`
                  : phase === 'ready'
                    ? 'Update ready'
                    : 'Check for updates'}
              </div>
              <div className="setting-description">
                {statusDescription(phase, updateInfo, downloadProgress, desktopError)}
              </div>
              <div className="about-update-timestamp">
                {formatLastChecked(desktopLastChecked) ?? 'Not checked yet'}
              </div>
              {desktopLastResult && (
                <div className="about-update-timestamp">{desktopLastResult}</div>
              )}
            </div>

            <div className="about-update-actions">
              {phase === 'ready' ? (
                <button className="setting-btn setting-btn--primary" onClick={handleRelaunch}>
                  Restart now
                </button>
              ) : phase === 'available' ? (
                <button
                  className="setting-btn setting-btn--primary"
                  onClick={() => void handleInstallUpdate()}
                >
                  Install update
                </button>
              ) : (
                <button
                  className="setting-btn"
                  onClick={() => void handleCheckForUpdates()}
                  disabled={phase === 'checking' || phase === 'downloading'}
                >
                  {phase === 'checking' ? 'Checking...' : 'Check for updates'}
                </button>
              )}
            </div>
          </div>

          {phase === 'up-to-date' && (
            <div className="settings-trust-box" style={{ marginTop: 12 }}>
              You're already on the latest version.
            </div>
          )}

          {phase === 'downloading' && (
            <div className="about-update-progress">
              <div className="about-update-progress__track">
                <div
                  className="about-update-progress__fill"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <span className="about-update-progress__label">{downloadProgress}%</span>
            </div>
          )}

          {phase === 'available' && updateInfo?.body && (
            <div className="about-release-notes">
              <div className="about-release-notes__title">What's new</div>
              <div className="about-release-notes__body">{updateInfo.body.slice(0, 600)}</div>
            </div>
          )}

          {phase === 'ready' && (
            <div className="about-update-ready">
              Memephant has been updated. Click <strong>Restart now</strong> to reopen with the
              latest version. Your projects stay safe during the update.
            </div>
          )}

          {phase === 'error' && (
            <div className="about-update-error">
              Update check failed. Make sure you're connected to the internet, then try again.{` `}
              <button
                className="about-update-error-retry"
                onClick={() => {
                  setPhase('idle');
                  void handleCheckForUpdates();
                }}
              >
                Retry
              </button>
            </div>
          )}

          <div className="settings-trust-box" style={{ marginTop: 12 }}>
            Desktop updates are delivered through signed Tauri releases from GitHub. Vercel deploys
            update only the website/PWA and will not update this installed desktop app.
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <div className="setting-label">Manual desktop download</div>
              <div className="setting-description">
                Use this if update checking fails or release metadata has not been published yet.
              </div>
            </div>
            <div className="about-update-actions">
              <button
                className="setting-btn"
                onClick={() => openLink(DESKTOP_DOWNLOAD_URL)}
              >
                Download latest version
              </button>
              <button
                className="setting-btn"
                onClick={() => openLink(DESKTOP_RELEASES_URL)}
              >
                GitHub releases
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="settings-group">
        <div className="settings-group-title">Privacy</div>

        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">Privacy policy</div>
            <div className="setting-description">
              What data is stored locally, what cloud backup does, and what never leaves your device
            </div>
          </div>
          <button className="setting-btn" onClick={() => setShowPrivacy((v) => !v)}>
            {showPrivacy ? 'Hide' : 'Read'}
          </button>
        </div>

        {showPrivacy && <div className="about-privacy-body">{PRIVACY_SUMMARY}</div>}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">Help improve Memephant</div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <button
            className="setting-btn"
            onClick={() => openLink('https://tally.so/r/RGZzL4')}
          >
            ✉ Send feedback
          </button>

          <button
            className="setting-btn"
            onClick={() => openLink('https://github.com/krisninnis/memephant/issues/new')}
          >
            🐛 Report a bug
          </button>
        </div>
      </div>

      <div className="settings-trust-box" style={{ marginTop: 8 }}>
        Your project memory stays local first. Cloud backup is optional, and AI exports only happen
        when you explicitly copy them.
      </div>

      <div className="about-footer-note">
        Memephant is not affiliated with OpenAI, Anthropic, xAI, Perplexity, or Google.
      </div>
    </div>
  );
}

export default SettingsAbout;
