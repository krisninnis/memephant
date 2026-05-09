import {
  appendConsentLedgerEvent,
  createConsentLedgerEvent,
  createDefaultPersonalMemoryVault,
  createPersonalMemoryEntry,
  isPersonalMemoryVault,
  mergeAppendOnlyConsentLedger,
  validateConsentLedgerEvent,
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
  vault.consentLedger = [
    createConsentLedgerEvent({
      id: 'consent-sentinel-1',
      createdAt: vault.updatedAt,
      action: 'consent_granted',
      scope: 'platform_sharing',
      platform: 'PersonalVaultConsentPlatformSentinel',
      target: 'PersonalVaultConsentTargetSentinel',
      notes: 'PersonalVaultConsentNotesSentinel',
    }),
  ];

  return vault;
}

function expectNoPersonalVaultSentinels(output: string): void {
  expect(output).not.toContain('PersonalVaultSentinelName');
  expect(output).not.toContain('PersonalVaultSentinelBio');
  expect(output).not.toContain('PersonalVaultSentinelPreference');
  expect(output).not.toContain('PersonalVaultSentinelWorkStyle');
  expect(output).not.toContain('PersonalVaultNeverShareSentinel');
  expect(output).not.toContain('PersonalVaultConsentPlatformSentinel');
  expect(output).not.toContain('PersonalVaultConsentTargetSentinel');
  expect(output).not.toContain('PersonalVaultConsentNotesSentinel');
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
    expect(vault.consentLedger).toEqual([]);
    expect(vault.auditLog).toEqual([]);
  });

  it('creates consent ledger events with consent defaults off', () => {
    const event = createConsentLedgerEvent({
      id: 'consent-1',
      createdAt: '2026-05-08T12:00:00.000Z',
      action: 'consent_refused',
      scope: 'ai_training',
      commercialUseAllowed: true,
      aiTrainingAllowed: true,
    });

    expect(event.allowed).toBe(false);
    expect(event.commercialUseAllowed).toBe(false);
    expect(event.aiTrainingAllowed).toBe(false);
    expect(event.receiptText).toContain('AI training allowed: no');
    expect(validateConsentLedgerEvent(event)).toBe(true);
  });

  it('records grant flags only for allowed consent events', () => {
    const event = createConsentLedgerEvent({
      id: 'consent-2',
      createdAt: '2026-05-08T12:00:00.000Z',
      action: 'consent_granted',
      scope: 'commercial_licensing',
      commercialUseAllowed: true,
      aiTrainingAllowed: false,
    });

    expect(event.allowed).toBe(true);
    expect(event.commercialUseAllowed).toBe(true);
    expect(event.aiTrainingAllowed).toBe(false);
    expect(event.receiptText).toContain('Commercial use allowed: yes');
  });

  it('appends consent events without mutating the existing vault', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-07T12:00:00.000Z');
    const event = createConsentLedgerEvent({
      id: 'append-consent',
      createdAt: '2026-05-07T12:30:00.000Z',
      action: 'consent_refused',
      scope: 'memory_export',
    });

    const nextVault = appendConsentLedgerEvent(vault, event);

    expect(vault.consentLedger).toEqual([]);
    expect(nextVault.consentLedger).toEqual([event]);
    expect(nextVault.updatedAt).toBe(event.createdAt);
  });

  it('ignores duplicate consent event ids through the append helper', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-07T12:00:00.000Z');
    const original = createConsentLedgerEvent({
      id: 'duplicate-consent',
      createdAt: vault.updatedAt,
      action: 'consent_granted',
      scope: 'platform_sharing',
      platform: 'ChatGPT',
    });
    const attemptedMutation = {
      ...original,
      action: 'consent_revoked' as const,
      allowed: false,
      receiptText: 'MUTATED_EVENT_TEXT',
    };

    const withOriginal = appendConsentLedgerEvent(vault, original);
    const afterDuplicate = appendConsentLedgerEvent(withOriginal, attemptedMutation);

    expect(afterDuplicate.consentLedger).toHaveLength(1);
    expect(afterDuplicate.consentLedger[0]).toEqual(original);
    expect(afterDuplicate.consentLedger[0].receiptText).not.toBe('MUTATED_EVENT_TEXT');
  });

  it('creates corrective consent events that link to the original event', () => {
    const event = createConsentLedgerEvent({
      id: 'corrective-consent',
      createdAt: '2026-05-07T13:00:00.000Z',
      action: 'permission_updated',
      scope: 'ai_training',
      correctsEventId: 'original-consent',
      aiTrainingAllowed: false,
    });

    expect(event.correctsEventId).toBe('original-consent');
    expect(validateConsentLedgerEvent(event)).toBe(true);
  });

  it('merges consent ledgers append-only and preserves original event contents', () => {
    const original = createConsentLedgerEvent({
      id: 'grant-consent',
      createdAt: '2026-05-07T12:00:00.000Z',
      action: 'consent_granted',
      scope: 'platform_sharing',
      platform: 'ChatGPT',
    });
    const attemptedMutation = {
      ...original,
      platform: 'MUTATED_PLATFORM',
      receiptText: 'MUTATED_RECEIPT',
    };
    const revocation = createConsentLedgerEvent({
      id: 'revoke-consent',
      createdAt: '2026-05-07T13:00:00.000Z',
      action: 'consent_revoked',
      scope: 'platform_sharing',
      platform: 'ChatGPT',
      correctsEventId: original.id,
    });

    const merged = mergeAppendOnlyConsentLedger([original], [attemptedMutation, revocation]);

    expect(merged).toEqual([original, revocation]);
    expect(merged[1].correctsEventId).toBe(original.id);
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

  it('loads old vaults without consentLedger safely', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-07T12:00:00.000Z');
    const oldVault = { ...vault };
    delete (oldVault as { consentLedger?: unknown }).consentLedger;

    window.localStorage.setItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY, JSON.stringify(oldVault));

    const loaded = loadPersonalMemoryVault();
    expect(isPersonalMemoryVault(loaded)).toBe(true);
    expect(loaded.consentLedger).toEqual([]);
  });

  it('drops invalid stored consent ledger entries safely', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-07T12:00:00.000Z');
    const validEvent = createConsentLedgerEvent({
      id: 'valid-consent',
      createdAt: vault.updatedAt,
      action: 'consent_revoked',
      scope: 'memory_export',
    });
    const stored = {
      ...vault,
      consentLedger: [
        validEvent,
        { id: 'bad-consent', action: 'consent_granted', scope: 'ai_training' },
      ],
    };

    window.localStorage.setItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY, JSON.stringify(stored));

    const loaded = loadPersonalMemoryVault();
    expect(loaded.consentLedger).toEqual([validEvent]);
  });

  it('keeps revoked and refused consent events append-only', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-07T12:00:00.000Z');
    const granted = createConsentLedgerEvent({
      id: 'consent-grant',
      createdAt: vault.updatedAt,
      action: 'consent_granted',
      scope: 'platform_sharing',
      platform: 'ChatGPT',
    });
    const revoked = createConsentLedgerEvent({
      id: 'consent-revoke',
      createdAt: '2026-05-07T13:00:00.000Z',
      action: 'consent_revoked',
      scope: 'platform_sharing',
      platform: 'ChatGPT',
    });

    savePersonalMemoryVault({ ...vault, consentLedger: [granted, revoked] });

    const loaded = loadPersonalMemoryVault();
    expect(loaded.consentLedger).toHaveLength(2);
    expect(loaded.consentLedger[0].action).toBe('consent_granted');
    expect(loaded.consentLedger[1].action).toBe('consent_revoked');
    expect(loaded.consentLedger[1].allowed).toBe(false);
  });

  it('prevents stored consent events from being edited or deleted by whole-vault saves', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-07T12:00:00.000Z');
    const granted = createConsentLedgerEvent({
      id: 'stored-grant',
      createdAt: vault.updatedAt,
      action: 'consent_granted',
      scope: 'platform_sharing',
      platform: 'ChatGPT',
    });
    savePersonalMemoryVault({ ...vault, consentLedger: [granted] });

    const editedGrant = {
      ...granted,
      platform: 'MUTATED_PLATFORM',
      receiptText: 'MUTATED_RECEIPT_TEXT',
    };
    const correction = createConsentLedgerEvent({
      id: 'stored-correction',
      createdAt: '2026-05-07T13:00:00.000Z',
      action: 'permission_updated',
      scope: 'platform_sharing',
      platform: 'ChatGPT',
      correctsEventId: granted.id,
    });

    savePersonalMemoryVault({
      ...vault,
      consentLedger: [editedGrant, correction],
      updatedAt: correction.createdAt,
    });

    const loaded = loadPersonalMemoryVault();
    expect(loaded.consentLedger).toHaveLength(2);
    expect(loaded.consentLedger[0]).toEqual(granted);
    expect(loaded.consentLedger[0].receiptText).not.toBe('MUTATED_RECEIPT_TEXT');
    expect(loaded.consentLedger[1]).toEqual(correction);

    savePersonalMemoryVault({ ...loaded, consentLedger: [] });

    const afterDeletionAttempt = loadPersonalMemoryVault();
    expect(afterDeletionAttempt.consentLedger).toHaveLength(2);
    expect(afterDeletionAttempt.consentLedger[0]).toEqual(granted);
    expect(afterDeletionAttempt.consentLedger[1]).toEqual(correction);
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
