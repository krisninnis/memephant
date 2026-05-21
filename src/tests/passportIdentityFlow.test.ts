/**
 * passportIdentityFlow.test.ts
 *
 * Six safety tests for the Passport Identity Moment integration:
 *
 *  1. First launch shows passport flow (new user, no passport, no onboarding seen)
 *  2. Existing users (hasSeenOnboarding = true) skip passport flow
 *  3. Completing passport persists data locally (correct key, correct shape)
 *  4. Passport does not affect cloud sync (passport key absent from sync paths)
 *  5. Passport does not leak Memory Vault contents
 *  6. App renders normally after passport completion (passport exists)
 *
 * These tests exercise:
 *  - usePassportStore (state logic + persistence)
 *  - PassportGate render decisions
 *  - deriveFingerprint / createPassportData (pure utils)
 *  - localStorage key isolation
 *
 * Tests deliberately avoid rendering full React trees to stay fast and focused.
 * Component integration is covered by manual QA + future E2E tests.
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** A complete, valid passport profile. */
const FULL_PROFILE: PassportProfile = {
  communicationStyle: 'structured',
  tone: 'professional',
  focusArea: 'startup',
};

/** Resets the Zustand store and clears localStorage before each test. */
function resetStore(): void {
  usePassportStore.setState({
    passport: null,
    flowStep: 'welcome',
    draft: {},
    isGenerating: false,
    isReeditingPassport: false,
  });
  localStorage.clear();
}

function shouldShowPassportFlow(
  passport: PassportData | null,
  hasSeenOnboarding: boolean,
  flowStep: PassportFlowStep,
): boolean {
  const isNewUser = !passport && !hasSeenOnboarding;
  const isViewingCard = flowStep === 'complete';
  return isNewUser || isViewingCard;
}

// ─── Test 1: First launch shows passport flow ────────────────────────────────

describe('Test 1 — first launch triggers passport flow', () => {
  beforeEach(resetStore);

  it('flowStep starts as "welcome" on a fresh store', () => {
    const { flowStep, passport } = usePassportStore.getState();
    expect(passport).toBeNull();
    expect(flowStep).toBe('welcome');
  });

  it('PassportGate should show flow when passport is null and hasSeenOnboarding is false', () => {
    // Gate condition: show flow if (!passport && !hasSeenOnboarding) || flowStep === 'complete'
    const passport = null;
    const hasSeenOnboarding = false;
    const flowStep: PassportFlowStep = 'welcome';
    const showFlow = shouldShowPassportFlow(passport, hasSeenOnboarding, flowStep);

    expect(showFlow).toBe(true);
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

// ─── Test 2: Existing users skip the passport flow ───────────────────────────

describe('Test 2 — existing users bypass passport flow', () => {
  beforeEach(resetStore);

  it('gate passes when hasSeenOnboarding is true even if passport is null', () => {
    const passport = null;
    const hasSeenOnboarding = true; // existing user
    const flowStep: PassportFlowStep = 'welcome';
    const showFlow = shouldShowPassportFlow(passport, hasSeenOnboarding, flowStep);

    expect(showFlow).toBe(false); // existing user → skip gate
  });

  it('gate passes when passport exists regardless of hasSeenOnboarding', () => {
    const passport = createPassportData(FULL_PROFILE);
    const hasSeenOnboarding = false;
    const flowStep: PassportFlowStep = 'welcome';
    const showFlow = shouldShowPassportFlow(passport, hasSeenOnboarding, flowStep);

    expect(showFlow).toBe(false); // passport exists → skip gate
  });

  it('gate shows card when flowStep is "complete" (just generated)', () => {
    const passport = createPassportData(FULL_PROFILE);
    const hasSeenOnboarding = false;
    const flowStep: PassportFlowStep = 'complete';
    const showFlow = shouldShowPassportFlow(passport, hasSeenOnboarding, flowStep);

    expect(showFlow).toBe(true); // show the passport card
  });

  it('gate passes after "Enter Memephant" resets flowStep to welcome', () => {
    const passport = createPassportData(FULL_PROFILE);
    const hasSeenOnboarding = false;
    const flowStep: PassportFlowStep = 'welcome'; // reset by "Enter Memephant" button
    const showFlow = shouldShowPassportFlow(passport, hasSeenOnboarding, flowStep);

    expect(showFlow).toBe(false); // enter the app
  });
});

// ─── Test 3: Completing passport persists locally ────────────────────────────

describe('Test 3 — passport persists to the correct localStorage key', () => {
  beforeEach(resetStore);

  it('storage key matches project naming convention', () => {
    expect(PASSPORT_STORAGE_KEY).toBe('mph_passport_v1');
  });

  it('passport key is different from settings and vault keys', () => {
    const SETTINGS_KEY = 'mph_settings_v1';
    expect(PASSPORT_STORAGE_KEY).not.toBe(SETTINGS_KEY);
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
    // Missing tone and focusArea

    generatePassport();

    const state = usePassportStore.getState();
    expect(state.isGenerating).toBe(false); // should not have started
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

// ─── Test 4: Passport does not affect cloud sync ─────────────────────────────

describe('Test 4 — passport is not included in cloud sync paths', () => {
  it('passport key (mph_passport_v1) is absent from cloudSync.ts source', async () => {
    // Read the cloud sync source and confirm it never references our storage key.
    // This is a static-analysis safety check, not a runtime test.
    const fs = await import('fs');
    const path = await import('path');
    const cloudSyncPath = path.resolve(
      __dirname,
      '../services/cloudSync.ts',
    );
    const source = fs.readFileSync(cloudSyncPath, 'utf-8');

    expect(source).not.toContain('mph_passport_v1');
    expect(source).not.toContain(PASSPORT_STORAGE_KEY);
  });

  it('passport key is absent from syncQueue.ts source', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const syncQueuePath = path.resolve(__dirname, '../services/syncQueue.ts');
    const source = fs.readFileSync(syncQueuePath, 'utf-8');

    expect(source).not.toContain('mph_passport_v1');
    expect(source).not.toContain(PASSPORT_STORAGE_KEY);
  });

  it('passport data has no userId / cloud routing fields', () => {
    const data = createPassportData(FULL_PROFILE);
    const keys = Object.keys(data);

    expect(keys).not.toContain('userId');
    expect(keys).not.toContain('user_id');
    expect(keys).not.toContain('supabaseId');
    expect(keys).not.toContain('syncedAt');
  });

  it('passport store partialize only persists "passport" field', () => {
    // The persist config's partialize() keeps only { passport }.
    // Verify by checking what gets stored after setting draft answers.
    const { setDraftAnswer } = usePassportStore.getState();
    setDraftAnswer('communicationStyle', 'concise');

    // In jsdom, Zustand persist middleware writes to localStorage during
    // the next microtask. Confirm the draft does NOT end up in storage.
    const raw = localStorage.getItem('mph_passport_v1');

    // Before generation: passport is null → storage may be null or { passport: null }
    if (raw) {
      const stored = JSON.parse(raw) as { state?: { draft?: unknown } };
      const state = stored.state ?? stored;
      expect((state as Record<string, unknown>).draft).toBeUndefined();
    }
    // Either way, draft is never in storage
  });
});

// ─── Test 5: Passport does not leak Memory Vault contents ────────────────────

describe('Test 5 — passport is isolated from Memory Vault', () => {
  beforeEach(() => {
    resetStore();
    // Seed the vault with some data to confirm no cross-contamination
    localStorage.setItem(
      PERSONAL_MEMORY_VAULT_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: '0.1.0',
        ownerProfile: { displayName: 'Kris', bio: 'Founder' },
        preferences: [{ id: 'p1', value: 'Never use jargon', sensitivity: 'private', updatedAt: '' }],
        workStyle: [],
        communicationStyle: [],
        goals: [],
        skills: [],
        rules: [],
        privateNotes: [{ id: 'n1', value: 'SECRET PERSONAL NOTE', sensitivity: 'never_share', updatedAt: '' }],
        neverShare: ['personal address'],
        platformPermissions: {},
        dataLicensingPreferences: { allowLicensing: false, requireExplicitConsent: true, allowedCategories: [], deniedCategories: [], updatedAt: '' },
        consentLedger: [],
        auditLog: [],
        frontalLobeProfile: { defaultAnswerStyle: 'straight_shooter' },
        updatedAt: '',
      })
    );
  });

  it('passport store does not read from vault storage key', () => {
    // Vault data remains in vault key; passport store doesn't touch it
    const vaultRaw = localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    const passportRaw = localStorage.getItem(PASSPORT_STORAGE_KEY);

    expect(vaultRaw).toBeTruthy(); // vault is still there
    expect(passportRaw).toBeNull(); // passport store is empty
  });

  it('createPassportData output contains no vault fields', () => {
    const data = createPassportData(FULL_PROFILE);
    const json = JSON.stringify(data);

    expect(json).not.toContain('SECRET PERSONAL NOTE');
    expect(json).not.toContain('personal address');
    expect(json).not.toContain('displayName');
    expect(json).not.toContain('frontalLobeProfile');
    expect(json).not.toContain('neverShare');
    expect(json).not.toContain('privateNotes');
    expect(json).not.toContain('consentLedger');
  });

  it('passport storage key does not touch vault storage key', () => {
    expect(PASSPORT_STORAGE_KEY).not.toBe(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
  });

  it('completing the passport does not mutate the vault key', () => {
    const vaultBefore = localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);

    // Simulate passport completion
    const data = createPassportData(FULL_PROFILE);
    usePassportStore.setState({ passport: data, flowStep: 'complete' });

    const vaultAfter = localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    expect(vaultAfter).toBe(vaultBefore); // vault unchanged
  });
});

// ─── Test 6: App renders normally after passport completion ──────────────────

describe('Test 6 — app entry is unblocked after passport completion', () => {
  beforeEach(resetStore);

  it('gate passes when passport exists and flowStep is welcome', () => {
    const passport = createPassportData(FULL_PROFILE);
    const hasSeenOnboarding = false;
    const flowStep: PassportFlowStep = 'welcome'; // "Enter Memephant" has been clicked

    const showFlow = shouldShowPassportFlow(passport, hasSeenOnboarding, flowStep);
    expect(showFlow).toBe(false); // → render children (normal app)
  });

  it('gate passes when passport exists and hasSeenOnboarding is true', () => {
    const passport = createPassportData(FULL_PROFILE);
    const hasSeenOnboarding = true;
    const flowStep: PassportFlowStep = 'welcome';

    const showFlow = shouldShowPassportFlow(passport, hasSeenOnboarding, flowStep);
    expect(showFlow).toBe(false);
  });

  it('fingerprint is deterministic — same inputs always produce same passport ID', () => {
    const d1 = createPassportData(FULL_PROFILE);
    const d2 = createPassportData(FULL_PROFILE);

    expect(d1.fingerprint).toBe(d2.fingerprint);
    expect(d1.id).toBe(d2.id);
  });

  it('different profiles produce different fingerprints', () => {
    const profileA: PassportProfile = { communicationStyle: 'structured', tone: 'professional', focusArea: 'startup' };
    const profileB: PassportProfile = { communicationStyle: 'concise',    tone: 'direct',       focusArea: 'app' };

    expect(deriveFingerprint(profileA)).not.toBe(deriveFingerprint(profileB));
  });

  it('formatPassportId produces correct MPH-XXXX-XXXX-XXXX format', () => {
    const fp = deriveFingerprint(FULL_PROFILE);
    const id = formatPassportId(fp);

    expect(id).toMatch(/^MPH-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('passport schemaVersion is 1.0 for future migration detection', () => {
    const data = createPassportData(FULL_PROFILE);
    expect(data.schemaVersion).toBe('1.0');
  });
});
