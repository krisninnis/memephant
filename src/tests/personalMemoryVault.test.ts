import {
  createDefaultPersonalMemoryVault,
  createPersonalMemoryEntry,
  isPersonalMemoryVault,
  PERSONAL_MEMORY_VAULT_SCHEMA_VERSION,
} from '../types/personalMemoryVault';
import { generateContextPassport } from '../utils/passportGenerator';
import { buildMemoryBridgeBlock } from '../utils/memoryBridge';
import { formatForPlatform } from '../utils/exportFormatters';
import type { ProjectMemory } from '../types/memphant-types';
import { SCHEMA_VERSION } from '../types/memphant-types';
import {
  clearPersonalMemoryVault,
  loadPersonalMemoryVault,
  PERSONAL_MEMORY_VAULT_STORAGE_KEY,
  savePersonalMemoryVault,
} from '../services/personalMemoryVaultStorage';

function makeProject(): ProjectMemory {
  return {
    schema_version: SCHEMA_VERSION,
    id: 'personal-vault-export-guard',
    name: 'Project Export Guard',
    summary: 'Project-only context for export safety tests.',
    currentState: 'Testing that project exports stay project-scoped.',
    goals: ['Keep project exports separate from personal memory'],
    rules: ['Do not include personal vault data without explicit opt-in'],
    decisions: [],
    importantAssets: ['src/types/personalMemoryVault.ts'],
    openQuestions: [],
    nextSteps: ['Keep personal vault wiring separate'],
    changelog: [],
    checkpoints: [],
    platformState: {},
  };
}

function makeVaultWithSentinels() {
  const vault = createDefaultPersonalMemoryVault('2026-05-07T12:00:00.000Z');
  vault.ownerProfile = {
    displayName: 'PersonalVaultSentinelName',
    bio: 'PersonalVaultSentinelBio',
  };
  vault.preferences = [
    createPersonalMemoryEntry('PersonalVaultSentinelPreference', {
      id: 'pref-1',
      updatedAt: vault.updatedAt,
    }),
  ];
  vault.workStyle = [
    createPersonalMemoryEntry('PersonalVaultSentinelWorkStyle', {
      id: 'work-1',
      updatedAt: vault.updatedAt,
    }),
  ];
  vault.neverShare = [
    'PersonalVaultNeverShareSentinel',
    'C:\\Users\\example\\private\\personal-vault',
  ];

  return vault;
}

function expectNoPersonalVaultSentinels(output: string): void {
  expect(output).not.toContain('PersonalVaultSentinelName');
  expect(output).not.toContain('PersonalVaultSentinelBio');
  expect(output).not.toContain('PersonalVaultSentinelPreference');
  expect(output).not.toContain('PersonalVaultSentinelWorkStyle');
  expect(output).not.toContain('PersonalVaultNeverShareSentinel');
  expect(output).not.toContain('C:\\Users\\example\\private\\personal-vault');
}

describe('Personal Memory Vault foundation', () => {
  it('creates an empty local-first vault with licensing disabled by default', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-07T12:00:00.000Z');

    expect(vault.schemaVersion).toBe(PERSONAL_MEMORY_VAULT_SCHEMA_VERSION);
    expect(vault.preferences).toEqual([]);
    expect(vault.privateNotes).toEqual([]);
    expect(vault.platformPermissions).toEqual({});
    expect(vault.dataLicensingPreferences.allowLicensing).toBe(false);
    expect(vault.dataLicensingPreferences.requireExplicitConsent).toBe(true);
    expect(vault.auditLog).toEqual([]);
  });

  it('creates private entries by default', () => {
    const entry = createPersonalMemoryEntry('Use concise answers', {
      id: 'entry-1',
      updatedAt: '2026-05-07T12:00:00.000Z',
    });

    expect(entry).toEqual({
      id: 'entry-1',
      value: 'Use concise answers',
      label: undefined,
      category: undefined,
      sensitivity: 'private',
      updatedAt: '2026-05-07T12:00:00.000Z',
    });
  });

  it('stores entry categories when provided', () => {
    const entry = createPersonalMemoryEntry('Keep responses concise', {
      id: 'entry-2',
      label: 'Response style',
      category: 'preference',
      updatedAt: '2026-05-07T12:00:00.000Z',
    });

    expect(entry.category).toBe('preference');
    expect(entry.sensitivity).toBe('private');
  });

  it('recognizes valid default vault objects', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-07T12:00:00.000Z');

    expect(isPersonalMemoryVault(vault)).toBe(true);
    expect(isPersonalMemoryVault({ schemaVersion: 'wrong' })).toBe(false);
  });
});

describe('Personal Memory Vault export guard', () => {
  it('does not include personal vault data in normal project exports', () => {
    const project = makeProject();
    const vault = makeVaultWithSentinels();
    expect(vault.preferences).toHaveLength(1);

    for (const platform of ['chatgpt', 'claude', 'codex', 'cowork'] as const) {
      const output = formatForPlatform(project, platform);
      expectNoPersonalVaultSentinels(output);
    }
  });

  it('does not include personal vault data in Context Passport exports', () => {
    const project = makeProject();
    const vault = makeVaultWithSentinels();
    expect(vault.neverShare).toContain('PersonalVaultNeverShareSentinel');

    const passport = generateContextPassport(project);
    for (const output of Object.values(passport.formats)) {
      expectNoPersonalVaultSentinels(output);
    }
  });

  it('does not include personal vault data in Memory Bridge exports', () => {
    const project = makeProject();
    const vault = makeVaultWithSentinels();
    expect(vault.ownerProfile.bio).toBe('PersonalVaultSentinelBio');

    const output = buildMemoryBridgeBlock(project, 'chatgpt');
    expectNoPersonalVaultSentinels(output);
  });
});

describe('Personal Memory Vault local storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('loads a default vault when no local vault exists', () => {
    const vault = loadPersonalMemoryVault();

    expect(isPersonalMemoryVault(vault)).toBe(true);
    expect(vault.preferences).toEqual([]);
    expect(vault.dataLicensingPreferences.allowLicensing).toBe(false);
  });

  it('saves and loads the vault locally', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-07T12:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry('PersonalVaultLocalStorageSentinel', {
        id: 'local-pref-1',
        updatedAt: vault.updatedAt,
      }),
    ];

    savePersonalMemoryVault(vault);

    const loaded = loadPersonalMemoryVault();
    expect(loaded.preferences[0]?.value).toBe('PersonalVaultLocalStorageSentinel');
    expect(window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY)).toContain(
      'PersonalVaultLocalStorageSentinel',
    );
  });

  it('falls back to an empty vault when stored data is invalid', () => {
    window.localStorage.setItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY, '{bad json');

    const loaded = loadPersonalMemoryVault();
    expect(isPersonalMemoryVault(loaded)).toBe(true);
    expect(loaded.preferences).toEqual([]);
  });

  it('clears the local vault without touching project exports', () => {
    const vault = makeVaultWithSentinels();
    savePersonalMemoryVault(vault);

    clearPersonalMemoryVault();

    expect(window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY)).toBeNull();
    const output = formatForPlatform(makeProject(), 'chatgpt');
    expectNoPersonalVaultSentinels(output);
  });
});
