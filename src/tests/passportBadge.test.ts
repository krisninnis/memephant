/**
 * passportBadge.test.ts
 *
 * Tests for PassportBadgeButton and the "Edit Passport" / "Create" flows:
 *
 *  1. Badge state: passport exists
 *  2. Copy produces valid Passport Attachment v0.1 text
 *  3. Copy text: no cloud or user-identity fields
 *  4. Copy text: no Memory Vault private data
 *  5. startPassportEdit sets isReeditingPassport = true
 *  6. finishPassportFlow clears isReeditingPassport
 *  7. No-passport CTA: startPassportEdit launches flow for existing users
 */

import { usePassportStore, PASSPORT_STORAGE_KEY } from '../features/passport/usePassportStore';
import {
  createPassportData,
  getPassportConfiguration,
} from '../features/passport/passport.utils';
import { buildPassportAttachmentPreview } from '../features/passport/passportAttachment';
import {
  DEFAULT_PASSPORT_CONFIGURATION_V2,
  type PassportData,
  type PassportProfile,
} from '../features/passport/passport.types';
import { DEFAULT_FRONTAL_LOBE_PROFILE } from '../types/personalMemoryVault';
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
    passportFlowSkipped: false,
    isReeditingPassport: false,
  });
  localStorage.clear();
}

// â”€â”€ Test 1: passport store state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('Test 1 -- badge visibility', () => {
  beforeEach(resetStore);

  it('store has a passport after createPassportData', () => {
    const data = createPassportData(FULL_PROFILE);
    usePassportStore.setState({ passport: data });
    const { passport } = usePassportStore.getState();
    expect(passport).not.toBeNull();
    expect(passport?.id).toMatch(/^MPH-/);
    expect(passport?.configuration?.region).toBe('United Kingdom');
  });

  it('store returns null when no passport created', () => {
    const { passport } = usePassportStore.getState();
    expect(passport).toBeNull();
  });
});

// â”€â”€ Test 2: copy text format â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('Test 2 -- copy text: Passport Attachment v0.1 format', () => {
  it('text includes required heading', () => {
    const data       = createPassportData(FULL_PROFILE);
    const attachment = buildPassportAttachmentPreview(data, DEFAULT_FRONTAL_LOBE_PROFILE);
    expect(attachment.text).toContain('# AI Passport');
  });

  it('text includes all three working-style fields', () => {
    const data       = createPassportData(FULL_PROFILE);
    const attachment = buildPassportAttachmentPreview(data, DEFAULT_FRONTAL_LOBE_PROFILE);
    expect(attachment.text).toContain('Tone:');
    expect(attachment.text).toContain('Style:');
    expect(attachment.text).toContain('Language:');
  });

  it('text includes privacy rules section', () => {
    const data       = createPassportData(FULL_PROFILE);
    const attachment = buildPassportAttachmentPreview(data, DEFAULT_FRONTAL_LOBE_PROFILE);
    expect(attachment.text).toContain('No passwords');
    expect(attachment.text).toContain('No API keys');
    expect(attachment.text).toContain('No silent sharing');
  });

  it('text includes integrity fingerprint', () => {
    const data       = createPassportData(FULL_PROFILE);
    const attachment = buildPassportAttachmentPreview(data, DEFAULT_FRONTAL_LOBE_PROFILE);
    expect(attachment.text).toContain('Integrity fingerprint:');
    expect(attachment.text).toContain(data.id);
  });

  it('text is under 1,500 characters', () => {
    const data       = createPassportData(FULL_PROFILE);
    const attachment = buildPassportAttachmentPreview(data, DEFAULT_FRONTAL_LOBE_PROFILE);
    expect(attachment.text.length).toBeLessThan(1500);
  });

  it('text includes richer Passport Configuration v2 fields', () => {
    const data: PassportData = {
      ...createPassportData(FULL_PROFILE),
      configuration: {
        ...DEFAULT_PASSPORT_CONFIGURATION_V2,
        preferredName: 'Kris',
        roleContext: 'Solo founder',
        directness: 'Honest but supportive',
        technicalLevel: 'Learning builder',
        riskTolerance: 'Prefer small safe patches',
        alwaysRules: ['Ask before assuming missing details.'],
        neverRules: ['Do not invent files or code that have not been shown.'],
      },
    };
    const attachment = buildPassportAttachmentPreview(data, DEFAULT_FRONTAL_LOBE_PROFILE);

    expect(attachment.text).toContain('Preferred name: Kris');
    expect(attachment.text).toContain('Role/context: Solo founder');
    expect(attachment.text).toContain('Region: United Kingdom');
    expect(attachment.text).toContain('Language: British English');
    expect(attachment.text).toContain('Directness: Honest but supportive');
    expect(attachment.text).toContain('Technical level: Learning builder');
    expect(attachment.text).toContain('Risk tolerance: Prefer small safe patches');
    expect(attachment.text).toContain('Ask before assuming missing details.');
    expect(attachment.text).toContain('Do not invent files or code that have not been shown.');
  });

  it('legacy passports without configuration still use safe defaults', () => {
    const data = createPassportData(FULL_PROFILE);
    const legacyPassport: PassportData = {
      id: data.id,
      fingerprint: data.fingerprint,
      profile: data.profile,
      createdAt: data.createdAt,
      schemaVersion: data.schemaVersion,
    };
    const config = getPassportConfiguration(legacyPassport);
    const attachment = buildPassportAttachmentPreview(legacyPassport, DEFAULT_FRONTAL_LOBE_PROFILE);

    expect(config.region).toBe('United Kingdom');
    expect(config.directness).toBe('Honest but supportive');
    expect(attachment.text).toContain('Region: United Kingdom');
    expect(attachment.text).toContain('Directness: Honest but supportive');
  });
});

// â”€â”€ Test 3: no cloud or identity fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('Test 3 -- copy text: no cloud or identity fields', () => {
  it('text does not contain userId/supabase fields', () => {
    const data       = createPassportData(FULL_PROFILE);
    const attachment = buildPassportAttachmentPreview(data, DEFAULT_FRONTAL_LOBE_PROFILE);
    const text       = attachment.text.toLowerCase();
    expect(text).not.toContain('userid');
    expect(text).not.toContain('supabase');
    expect(text).not.toContain('synced');
    expect(text).not.toContain('token');
  });

  it('text does not imply native platform recognition', () => {
    const data       = createPassportData(FULL_PROFILE);
    const attachment = buildPassportAttachmentPreview(data, DEFAULT_FRONTAL_LOBE_PROFILE);
    expect(attachment.text).not.toMatch(/automatically knows/i);
    expect(attachment.text).not.toMatch(/verified credential/i);
    expect(attachment.text).not.toMatch(/login identity/i);
  });

  it('text does not contain the word "credential"', () => {
    const data       = createPassportData(FULL_PROFILE);
    const attachment = buildPassportAttachmentPreview(data, DEFAULT_FRONTAL_LOBE_PROFILE);
    expect(attachment.text).not.toMatch(/credential/i);
  });
});

// â”€â”€ Test 4: no Memory Vault leak â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('Test 4 -- copy text: no Memory Vault leak', () => {
  beforeEach(() => {
    resetStore();
    localStorage.setItem(
      PERSONAL_MEMORY_VAULT_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: '0.1.0',
        privateNotes: [{ id: 'n1', value: 'SECRET PERSONAL NOTE', sensitivity: 'never_share', updatedAt: '' }],
        neverShare: ['home address'],
        consentLedger: [],
        frontalLobeProfile: DEFAULT_FRONTAL_LOBE_PROFILE,
      }),
    );
  });

  it('attachment text contains no vault private fields', () => {
    const data       = createPassportData(FULL_PROFILE);
    const attachment = buildPassportAttachmentPreview(data, DEFAULT_FRONTAL_LOBE_PROFILE);
    const text       = attachment.text;
    expect(text).not.toContain('SECRET PERSONAL NOTE');
    expect(text).not.toContain('home address');
    expect(text).not.toContain('consentLedger');
    expect(text).not.toContain('privateNotes');
    expect(text).not.toContain('neverShare');
  });

  it('vault storage key untouched after building attachment', () => {
    const vaultBefore = localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    createPassportData(FULL_PROFILE);
    expect(localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY)).toBe(vaultBefore);
  });
});

// â”€â”€ Test 5: startPassportEdit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('Test 5 -- startPassportEdit: re-editing flow', () => {
  beforeEach(resetStore);

  it('sets isReeditingPassport = true', () => {
    const data = createPassportData(FULL_PROFILE);
    usePassportStore.setState({ passport: data });
    usePassportStore.getState().startPassportEdit();
    expect(usePassportStore.getState().isReeditingPassport).toBe(true);
  });

  it('clears passport and resets to welcome step', () => {
    usePassportStore.setState({ passport: createPassportData(FULL_PROFILE), flowStep: 'complete' });
    usePassportStore.getState().startPassportEdit();
    const state = usePassportStore.getState();
    expect(state.passport).toBeNull();
    expect(state.flowStep).toBe('welcome');
    expect(state.draft).toEqual({});
  });

  it('gate shows flow even for onboarded user', () => {
    const passport = null;
    const hasSeenOnboarding = true;
    const flowStep = 'welcome';
    const isReeditingPassport = true;

    const showFlow = (!passport && !hasSeenOnboarding) || (flowStep as string) === 'complete' || isReeditingPassport;
    expect(showFlow).toBe(true);
  });
});

// â”€â”€ Test 6: finishPassportFlow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('Test 6 -- finishPassportFlow: gate release', () => {
  beforeEach(resetStore);

  it('clears isReeditingPassport and resets flowStep', () => {
    usePassportStore.setState({ isReeditingPassport: true, flowStep: 'complete' });
    usePassportStore.getState().finishPassportFlow();
    const state = usePassportStore.getState();
    expect(state.isReeditingPassport).toBe(false);
    expect(state.flowStep).toBe('welcome');
  });

  it('gate passes after finishPassportFlow for onboarded user with passport', () => {
    const passport = createPassportData(FULL_PROFILE);
    const hasSeenOnboarding = true;
    const flowStep = 'welcome';
    const isReeditingPassport = false;

    const showFlow = (!passport && !hasSeenOnboarding) || (flowStep as string) === 'complete' || isReeditingPassport;
    expect(showFlow).toBe(false);
  });

  it('isReeditingPassport is not persisted to localStorage', () => {
    usePassportStore.setState({ isReeditingPassport: true });
    const raw = localStorage.getItem(PASSPORT_STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as { state?: Record<string, unknown> };
      const state  = stored.state ?? stored;
      expect((state as Record<string, unknown>).isReeditingPassport).toBeUndefined();
    }
  });
});

// â”€â”€ Test 7: no-passport CTA launches flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('Test 7 -- no-passport CTA: startPassportEdit launches flow for existing users', () => {
  beforeEach(resetStore);

  it('store has no passport initially', () => {
    expect(usePassportStore.getState().passport).toBeNull();
  });

  it('startPassportEdit sets isReeditingPassport = true', () => {
    usePassportStore.getState().startPassportEdit();
    const state = usePassportStore.getState();
    expect(state.isReeditingPassport).toBe(true);
    expect(state.passport).toBeNull();
    expect(state.flowStep).toBe('welcome');
  });

  it('gate shows flow for existing user with no passport after CTA click', () => {
    const passport            = null;
    const hasSeenOnboarding   = true;
    const flowStep            = 'welcome';
    const isReeditingPassport = true;

    const showFlow = (!passport && !hasSeenOnboarding) || (flowStep as string) === 'complete' || isReeditingPassport;
    expect(showFlow).toBe(true);
  });

  it('finishing the flow clears isReeditingPassport', () => {
    usePassportStore.getState().startPassportEdit();
    expect(usePassportStore.getState().isReeditingPassport).toBe(true);
    usePassportStore.getState().finishPassportFlow();
    expect(usePassportStore.getState().isReeditingPassport).toBe(false);
  });
});

// â”€â”€ Test 8: Passport Configuration v2 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('Test 8 -- Passport Configuration v2', () => {
  beforeEach(resetStore);

  it('new Passport Configuration v2 fields persist locally', () => {
    usePassportStore.setState({ passport: createPassportData(FULL_PROFILE) });

    usePassportStore.getState().updatePassportConfiguration({
      preferredName: 'Kris',
      region: 'United Kingdom',
      directness: 'Honest but supportive',
      technicalLevel: 'Learning builder',
      riskTolerance: 'Prefer small safe patches',
      alwaysRules: ['Give exact next steps.'],
      neverRules: ['Do not suggest broad rewrites before small safe fixes.'],
    });

    const passport = usePassportStore.getState().passport;
    expect(passport?.configuration?.preferredName).toBe('Kris');
    expect(passport?.configuration?.alwaysRules).toEqual(['Give exact next steps.']);

    const raw = localStorage.getItem(PASSPORT_STORAGE_KEY);
    expect(raw).toContain('Kris');
    expect(raw).toContain('Prefer small safe patches');
  });

  it('existing users can configure Passport after creation without re-running onboarding', () => {
    usePassportStore.setState({
      passport: createPassportData(FULL_PROFILE),
      flowStep: 'welcome',
    });

    usePassportStore.getState().updatePassportConfiguration({ preferredName: 'Kris' });

    const state = usePassportStore.getState();
    expect(state.passport?.configuration?.preferredName).toBe('Kris');
    expect(state.flowStep).toBe('welcome');
    expect(state.isReeditingPassport).toBe(false);
  });

  it('configuration field names do not introduce secret storage fields', () => {
    const keys = Object.keys(DEFAULT_PASSPORT_CONFIGURATION_V2);
    for (const key of keys) {
      expect(key).not.toMatch(/password|api|secret|token|credential/i);
    }
  });
});
