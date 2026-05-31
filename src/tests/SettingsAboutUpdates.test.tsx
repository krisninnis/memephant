import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SettingsAbout from '../components/Settings/SettingsAbout';
import { PWAUpdatePrompt } from '../components/PWAUpdatePrompt';
import { usePWA } from '../hooks/usePWA';
import {
  checkForUpdate,
  getInstalledVersion,
} from '../services/updater';

jest.mock('../hooks/usePWA', () => ({
  usePWA: jest.fn(),
}));

jest.mock('../services/updater', () => ({
  DESKTOP_DOWNLOAD_URL: 'https://memephant.com/download/',
  DESKTOP_RELEASES_URL: 'https://github.com/krisninnis/memephant/releases/latest',
  DesktopUpdateError: class DesktopUpdateError extends Error {},
  checkForUpdate: jest.fn(),
  downloadAndInstall: jest.fn(),
  getInstalledVersion: jest.fn(),
  relaunch: jest.fn(),
}));

const mockUsePWA = usePWA as jest.MockedFunction<typeof usePWA>;
const mockCheckForUpdate = checkForUpdate as jest.MockedFunction<typeof checkForUpdate>;
const mockGetInstalledVersion = getInstalledVersion as jest.MockedFunction<typeof getInstalledVersion>;

function setTauri(enabled: boolean): void {
  if (enabled) {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      value: {},
      configurable: true,
    });
    return;
  }

  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

function mockPwaState(overrides = {}) {
  mockUsePWA.mockReturnValue({
    isInstallable: false,
    isInstalled: false,
    updateAvailable: false,
    updateReady: false,
    isChecking: false,
    isApplyingUpdate: false,
    lastChecked: null,
    updateMessage: null,
    install: jest.fn(),
    checkForUpdates: jest.fn(async () => false),
    applyUpdate: jest.fn(async () => undefined),
    dismissUpdate: jest.fn(),
    ...overrides,
  });
}

describe('SettingsAbout desktop update flow', () => {
  beforeEach(() => {
    setTauri(true);
    mockPwaState();
    mockGetInstalledVersion.mockResolvedValue('0.2.23');
    mockCheckForUpdate.mockResolvedValue(null);
  });

  afterEach(() => {
    setTauri(false);
  });

  it('renders the current desktop version from the Tauri app version', async () => {
    render(<SettingsAbout />);

    expect(await screen.findByText('v0.2.23')).toBeInTheDocument();
    expect(screen.getByText('Current desktop app version')).toBeInTheDocument();
    expect(screen.getByText('Desktop Updates')).toBeInTheDocument();
  });

  it('Check for updates shows the checking state', async () => {
    let resolveCheck: (value: null) => void = () => undefined;
    mockCheckForUpdate.mockReturnValue(new Promise((resolve) => {
      resolveCheck = resolve;
    }));

    render(<SettingsAbout />);

    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));

    expect(screen.getByRole('button', { name: 'Checking...' })).toBeDisabled();
    expect(screen.getByText('Checking signed desktop release metadata...')).toBeInTheDocument();

    resolveCheck(null);
    await waitFor(() => expect(screen.getByText('No newer desktop release found.')).toBeInTheDocument());
  });

  it('shows an up-to-date result when no newer desktop release is found', async () => {
    render(<SettingsAbout />);

    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));

    expect(await screen.findByText("You're already on the latest version.")).toBeInTheDocument();
    expect(screen.getByText('No newer desktop release found.')).toBeInTheDocument();
  });

  it('shows a clear unavailable/not-configured error and manual download path', async () => {
    mockCheckForUpdate.mockRejectedValue(
      new Error('Desktop updater release metadata is missing or not configured correctly.'),
    );

    render(<SettingsAbout />);

    fireEvent.click(screen.getByRole('button', { name: 'Check for updates' }));

    expect(
      await screen.findByText('Desktop updater release metadata is missing or not configured correctly.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download latest version' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GitHub releases' })).toBeInTheDocument();
  });
});

describe('Web/PWA update flow remains separate', () => {
  beforeEach(() => {
    setTauri(false);
    mockPwaState();
  });

  it('About renders web/PWA update language outside Tauri', () => {
    render(<SettingsAbout />);

    expect(screen.getByText('Current web/PWA version')).toBeInTheDocument();
    expect(screen.getByText('Web/PWA Updates')).toBeInTheDocument();
    expect(screen.queryByText('Desktop Updates')).not.toBeInTheDocument();
  });

  it('PWA update prompt shows reload only when the update is ready', () => {
    mockPwaState({ updateAvailable: true, updateReady: true });

    render(<PWAUpdatePrompt />);

    expect(
      screen.getByText('A newer web/PWA build of Memephant is ready. This does not update the installed desktop app.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload now' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update now' })).not.toBeInTheDocument();
  });

  it('PWA update prompt hides reload action when no update is ready', () => {
    mockPwaState({
      updateAvailable: false,
      updateReady: false,
      updateMessage: 'The web update is not ready to reload yet. You can keep working and try again later.',
    });

    render(<PWAUpdatePrompt />);

    expect(screen.getByText('Update notice')).toBeInTheDocument();
    expect(screen.getByText('Memephant checked for a web/PWA update. You can keep working.')).toBeInTheDocument();
    expect(screen.getByText('The web update is not ready to reload yet. You can keep working and try again later.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reload now' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update now' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('PWA update prompt lets users dismiss ready updates for later', () => {
    const dismissUpdate = jest.fn();
    mockPwaState({ updateAvailable: true, updateReady: true, dismissUpdate });

    render(<PWAUpdatePrompt />);

    fireEvent.click(screen.getByRole('button', { name: 'Later' }));

    expect(dismissUpdate).toHaveBeenCalled();
  });
});
