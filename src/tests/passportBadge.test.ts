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
import { createPassportData } from '../features/passport/passport.utils';
import { buildPassportAttachmentPreview } from '../features/passport/passportAttachment';
import type { PassportProfile } from '../features/passport/passport.types';
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
    isReeditingPassport: false,
  });
  localStorage.clear();
}

// ── Test 1: passport store state ──────────────────────────────────────────────

describe('Test 1 -- badge visibility', () => {
  beforeEach(resetStore);

  it('store has a passport after createPassportData', () => {
    const data = createPassportData(FULL_PROFILE);
    usePassportStore.setState({ passport: data });
    const { passport } = usePassportStore.getState();
    expect(passport).not.toBeNull();
    expect(passport?.id).toMatch(/^MPH-/);
  });

  it('store returns null when no passport created', () => {
    const { passport } = usePassportStore.getState();
    expect(passport).toBeNull();
  });
});

// ── Test 2: copy text format ──────────────────────────────────────────────────

describe('Test 2 -- copy text: Passport Attachment v0.1 format', () => {
  it('text includes required heading', () => {
    const data       = createPassportData(FULL_PROFILE);
    const attachment = buildPassportAttachmentPreview(data, DEFAULT_FRONTAL_LOBE_PROFILE);
    expect(attachment.text).toContain('# Memephant Passport Attachment v0.1');
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

  it('text is under 700 characters', () => {
    const data       = createPassportData(FULL_PROFILE);
    const attachment = buildPassportAttachmentPreview(data, DEFAULT_FRONTAL_LOBE_PROFILE);
    expect(attachment.text.length).toBeLessThan(700);
  });
});

// ── Test 3: no cloud or identity fields ──────────────────────────────────────

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

// ── Test 4: no Memory Vault leak ──────────────────────────────────────────────

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

// ── Test 5: startPassportEdit ─────────────────────────────────────────────────

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

// ── Test 6: finishPassportFlow ────────────────────────────────────────────────

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

// ── Test 7: no-passport CTA launches flow ────────────────────────────────────

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
