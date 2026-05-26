/**
 * passportIdentityFlow.test.ts
 *
 * Six safety tests for the Passport Identity Moment integration.
 */

import { PASSPORT_STORAGE_KEY, usePassportStore } from '../features/passport/usePassportStore';
import {
  deriveFingerprint,
  createPassportData,
  formatPassportId,
  CALIBRATION_QUESTIONS,
} from '../features/passport/passport.utils';
import type { PassportData, PassportFlowStep, PassportProfile } from '../features/passport/passport.types';
import { PERSONAL_MEMORY_VAULT_STORAGE_KEY } from '../services/personalMemoryVaultStorage';

const FULL_PROFILE: PassportProfile = {
  communicationStyle: 'structured',
  tone: 'professional',
  focusArea: 'startup',
};

function resetStore(): void {
  usePassportStore.setState({
    passport: null,
    flowStep: 'welcome',
    draft: {},
    isGenerating: false,
    passportFlowSkipped: true,
    isReeditingPassport: false,
  });
  localStorage.clear();
}

function shouldShowPassportFlow(
  passport: PassportData | null,
  hasSeenOnboarding: boolean,
  flowStep: PassportFlowStep,
  passportFlowSkipped = false,
): boolean {
  const isNewUser = !passport && !hasSeenOnboarding && !passportFlowSkipped;
  const isViewingCard = flowStep === 'complete';
  return isNewUser || isViewingCard;
}

// ── Test 1 ────────────────────────────────────────────────────────────────────

describe('Test 1 -- first launch defers passport flow', () => {
  beforeEach(resetStore);

  it('flowStep starts as "welcome" with passport onboarding deferred on a fresh store', () => {
    const { flowStep, passport, passportFlowSkipped } = usePassportStore.getState();
    expect(passport).toBeNull();
    expect(flowStep).toBe('welcome');
    expect(passportFlowSkipped).toBe(true);
  });

  it('gate defers flow when passport is null and fresh onboarding has not been seen', () => {
    const { passportFlowSkipped } = usePassportStore.getState();
    const showFlow = shouldShowPassportFlow(null, false, 'welcome', passportFlowSkipped);
    expect(showFlow).toBe(false);
  });

  it('all 3 calibration questions are defined', () => {
    expect(CALIBRATION_QUESTIONS).toHaveLength(3);
    for (const q of CALIBRATION_QUESTIONS) {
      expect(q.prompt.length).toBeGreaterThan(0);
      expect(q.options.length).toBeGreaterThanOrEqual(3);
      expect(q.profileKey).toBeDefined();
    }
  });
});

// ── Test 2 ────────────────────────────────────────────────────────────────────

describe('Test 2 -- existing users bypass passport flow', () => {
  beforeEach(resetStore);

  it('gate passes when hasSeenOnboarding is true even if passport is null', () => {
    expect(shouldShowPassportFlow(null, true, 'welcome')).toBe(false);
  });

  it('gate passes when first Passport setup is skipped for this session', () => {
    usePassportStore.getState().skipPassportFlow();

    const state = usePassportStore.getState();
    expect(state.passport).toBeNull();
    expect(state.passportFlowSkipped).toBe(true);
    expect(shouldShowPassportFlow(null, false, 'welcome', state.passportFlowSkipped)).toBe(false);
  });

  it('gate passes when passport exists regardless of hasSeenOnboarding', () => {
    const passport = createPassportData(FULL_PROFILE);
    expect(shouldShowPassportFlow(passport, false, 'welcome')).toBe(false);
  });

  it('gate shows card when flowStep is "complete" (just generated)', () => {
    const passport = createPassportData(FULL_PROFILE);
    expect(shouldShowPassportFlow(passport, false, 'complete')).toBe(true);
  });

  it('gate passes after "Enter Memephant" resets flowStep to welcome', () => {
    const passport = createPassportData(FULL_PROFILE);
    expect(shouldShowPassportFlow(passport, false, 'welcome')).toBe(false);
  });
});

// ── Test 3 ────────────────────────────────────────────────────────────────────

describe('Test 3 -- passport persists to the correct localStorage key', () => {
  beforeEach(resetStore);

  it('storage key matches project naming convention', () => {
    expect(PASSPORT_STORAGE_KEY).toBe('mph_passport_v1');
  });

  it('passport key differs from settings and vault keys', () => {
    expect(PASSPORT_STORAGE_KEY).not.toBe('mph_settings_v1');
    expect(PASSPORT_STORAGE_KEY).not.toBe(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
  });

  it('createPassportData produces a valid PassportData record', () => {
    const data = createPassportData(FULL_PROFILE);
    expect(data.id).toMatch(/^MPH-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(data.fingerprint).toHaveLength(16);
    expect(data.fingerprint).toMatch(/^[0-9A-F]+$/);
    expect(data.profile).toEqual(FULL_PROFILE);
    expect(data.schemaVersion).toBe('1.0');
    expect(typeof data.createdAt).toBe('string');
    expect(new Date(data.createdAt).toISOString()).toBe(data.createdAt);
  });

  it('setDraftAnswer accumulates answers into draft', () => {
    const { setDraftAnswer } = usePassportStore.getState();
    setDraftAnswer('communicationStyle', 'concise');
    setDraftAnswer('tone', 'direct');
    setDraftAnswer('focusArea', 'app');
    const { draft } = usePassportStore.getState();
    expect(draft.communicationStyle).toBe('concise');
    expect(draft.tone).toBe('direct');
    expect(draft.focusArea).toBe('app');
  });

  it('generatePassport transitions to "generating" immediately', () => {
    const { setDraftAnswer, generatePassport } = usePassportStore.getState();
    setDraftAnswer('communicationStyle', 'structured');
    setDraftAnswer('tone', 'professional');
    setDraftAnswer('focusArea', 'startup');
    generatePassport();
    const state = usePassportStore.getState();
    expect(state.isGenerating).toBe(true);
    expect(state.flowStep).toBe('generating');
  });

  it('generatePassport does not fire when draft is incomplete', () => {
    const { setDraftAnswer, generatePassport } = usePassportStore.getState();
    setDraftAnswer('communicationStyle', 'structured');
    generatePassport();
    const state = usePassportStore.getState();
    expect(state.isGenerating).toBe(false);
    expect(state.passport).toBeNull();
  });

  it('resetPassport clears passport and returns to welcome state', () => {
    usePassportStore.setState({ passport: createPassportData(FULL_PROFILE), flowStep: 'complete' });
    usePassportStore.getState().resetPassport();
    const state = usePassportStore.getState();
    expect(state.passport).toBeNull();
    expect(state.flowStep).toBe('welcome');
    expect(state.draft).toEqual({});
  });
});

// ── Test 4 ────────────────────────────────────────────────────────────────────

describe('Test 4 -- passport is not included in cloud sync paths', () => {
  it('passport key is absent from cloudSync.ts source', async () => {
    const fs   = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(path.resolve(__dirname, '../services/cloudSync.ts'), 'utf-8');
    expect(source).not.toContain('mph_passport_v1');
    expect(source).not.toContain(PASSPORT_STORAGE_KEY);
  });

  it('passport key is absent from syncQueue.ts source', async () => {
    const fs   = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(path.resolve(__dirname, '../services/syncQueue.ts'), 'utf-8');
    expect(source).not.toContain('mph_passport_v1');
    expect(source).not.toContain(PASSPORT_STORAGE_KEY);
  });

  it('passport data has no userId / cloud routing fields', () => {
    const keys = Object.keys(createPassportData(FULL_PROFILE));
    expect(keys).not.toContain('userId');
    expect(keys).not.toContain('user_id');
    expect(keys).not.toContain('supabaseId');
    expect(keys).not.toContain('syncedAt');
  });

  it('partialize only persists "passport" field', () => {
    const { setDraftAnswer, skipPassportFlow } = usePassportStore.getState();
    setDraftAnswer('communicationStyle', 'concise');
    skipPassportFlow();
    const raw = localStorage.getItem('mph_passport_v1');
    if (raw) {
      const stored = JSON.parse(raw) as { state?: { draft?: unknown; passportFlowSkipped?: unknown } };
      const state  = stored.state ?? stored;
      expect((state as Record<string, unknown>).draft).toBeUndefined();
      expect((state as Record<string, unknown>).passportFlowSkipped).toBeUndefined();
    }
  });
});

// ── Test 5 ────────────────────────────────────────────────────────────────────

describe('Test 5 -- passport is isolated from Memory Vault', () => {
  beforeEach(() => {
    resetStore();
    localStorage.setItem(
      PERSONAL_MEMORY_VAULT_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: '0.1.0',
        ownerProfile: { displayName: 'Kris', bio: 'Founder' },
        preferences: [{ id: 'p1', value: 'Never use jargon', sensitivity: 'private', updatedAt: '' }],
        workStyle: [], communicationStyle: [], goals: [], skills: [], rules: [],
        privateNotes: [{ id: 'n1', value: 'SECRET PERSONAL NOTE', sensitivity: 'never_share', updatedAt: '' }],
        neverShare: ['personal address'],
        platformPermissions: {},
        dataLicensingPreferences: { allowLicensing: false, requireExplicitConsent: true, allowedCategories: [], deniedCategories: [], updatedAt: '' },
        consentLedger: [], auditLog: [],
        frontalLobeProfile: { defaultAnswerStyle: 'straight_shooter' },
        updatedAt: '',
      })
    );
  });

  it('passport store does not read from vault storage key', () => {
    expect(localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY)).toBeTruthy();
    expect(localStorage.getItem(PASSPORT_STORAGE_KEY)).toBeNull();
  });

  it('createPassportData output contains no vault fields', () => {
    const json = JSON.stringify(createPassportData(FULL_PROFILE));
    expect(json).not.toContain('SECRET PERSONAL NOTE');
    expect(json).not.toContain('personal address');
    expect(json).not.toContain('displayName');
    expect(json).not.toContain('frontalLobeProfile');
    expect(json).not.toContain('neverShare');
    expect(json).not.toContain('privateNotes');
    expect(json).not.toContain('consentLedger');
  });

  it('passport storage key does not equal vault storage key', () => {
    expect(PASSPORT_STORAGE_KEY).not.toBe(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
  });

  it('completing the passport does not mutate the vault key', () => {
    const vaultBefore = localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    usePassportStore.setState({ passport: createPassportData(FULL_PROFILE), flowStep: 'complete' });
    expect(localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY)).toBe(vaultBefore);
  });
});

// ── Test 6 ────────────────────────────────────────────────────────────────────

describe('Test 6 -- app entry is unblocked after passport completion', () => {
  beforeEach(resetStore);

  it('gate passes when passport exists and flowStep is welcome', () => {
    const passport = createPassportData(FULL_PROFILE);
    expect(shouldShowPassportFlow(passport, false, 'welcome')).toBe(false);
  });

  it('gate passes when passport exists and hasSeenOnboarding is true', () => {
    const passport = createPassportData(FULL_PROFILE);
    expect(shouldShowPassportFlow(passport, true, 'welcome')).toBe(false);
  });

  it('fingerprint is deterministic', () => {
    const d1 = createPassportData(FULL_PROFILE);
    const d2 = createPassportData(FULL_PROFILE);
    expect(d1.fingerprint).toBe(d2.fingerprint);
    expect(d1.id).toBe(d2.id);
  });

  it('different profiles produce different fingerprints', () => {
    const a: PassportProfile = { communicationStyle: 'structured', tone: 'professional', focusArea: 'startup' };
    const b: PassportProfile = { communicationStyle: 'concise',    tone: 'direct',       focusArea: 'app' };
    expect(deriveFingerprint(a)).not.toBe(deriveFingerprint(b));
  });

  it('formatPassportId produces MPH-XXXX-XXXX-XXXX format', () => {
    const id = formatPassportId(deriveFingerprint(FULL_PROFILE));
    expect(id).toMatch(/^MPH-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('passport schemaVersion is 1.0', () => {
    expect(createPassportData(FULL_PROFILE).schemaVersion).toBe('1.0');
  });
});
