import { isTauri } from '@tauri-apps/api/core';
import {
  canScanFolders,
  getFolderActionLabel,
  getUnavailableFeatureMessage,
  normalizeOldProject,
} from '../services/tauriActions';
import { isDesktopApp } from '../utils/runtime';

jest.mock('../services/cloudSync', () => ({
  deleteCloudProject: jest.fn(async () => ({ status: 'saved_local' })),
  pushProject: jest.fn(async () => ({ status: 'saved_local' })),
}));

jest.mock('../services/syncQueue', () => ({
  dequeue: jest.fn(async () => undefined),
}));

jest.mock('../lib/analytics', () => ({
  track: jest.fn(),
}));

const mockedIsTauri = isTauri as jest.MockedFunction<typeof isTauri>;

describe('isDesktopApp', () => {
  afterEach(() => {
    mockedIsTauri.mockReset();
    mockedIsTauri.mockReturnValue(false);
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it('returns true when the supported Tauri runtime flag is present', () => {
    mockedIsTauri.mockReturnValue(true);

    expect(isDesktopApp()).toBe(true);
  });

  it('falls back to the legacy internal global for older desktop builds', () => {
    mockedIsTauri.mockReturnValue(false);
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};

    expect(isDesktopApp()).toBe(true);
  });

  it('returns false in plain browser mode', () => {
    mockedIsTauri.mockReturnValue(false);

    expect(isDesktopApp()).toBe(false);
  });
});

describe('folder-first runtime helpers', () => {
  afterEach(() => {
    mockedIsTauri.mockReset();
    mockedIsTauri.mockReturnValue(false);
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it('labels desktop folder selection as Open Folder', () => {
    mockedIsTauri.mockReturnValue(true);

    expect(getFolderActionLabel()).toBe('Open Folder');
  });

  it('labels browser folder selection as Select Folder and keeps folder scanning available', () => {
    mockedIsTauri.mockReturnValue(false);

    expect(getFolderActionLabel()).toBe('Select Folder');
    expect(canScanFolders()).toBe(true);
  });

  it('uses a browser-specific fallback message when folder selection is unavailable', () => {
    expect(getUnavailableFeatureMessage('folderScan')).toContain('Folder selection is not supported by this browser yet');
    expect(getUnavailableFeatureMessage('folderScan')).toContain('Import Memephant Project');
  });
});

describe('tauriActions normalizeOldProject linked folder metadata', () => {
  it('keeps safe linked folder scan metadata when the local path is absent', () => {
    const project = normalizeOldProject({
      id: 'pathless-linked-folder',
      name: 'Pathless Linked Folder',
      summary: 'Loaded from cloud-safe local data.',
      goals: [],
      rules: [],
      decisions: [],
      currentState: 'Ready.',
      nextSteps: [],
      openQuestions: [],
      importantAssets: ['README.md'],
      changelog: [],
      checkpoints: [],
      platformState: {},
      linkedFolder: {
        scanHash: 'scan-pathless',
        lastScannedAt: '2026-06-05T14:27:00.000Z',
      },
    });

    expect(project.linkedFolder).toEqual({
      path: undefined,
      scanHash: 'scan-pathless',
      lastScannedAt: '2026-06-05T14:27:00.000Z',
    });
  });
});
