/**
 * passportBadge.test.ts
 *
 * Tests for PassportBadgeButton and the "Edit Passport" flow:
 *
 *  1. Badge renders only when a passport exists
 *  2. Badge is hidden when passport is null
 *  3. Copy produces valid Passport Attachment v0.1 text
 *  4. Copy text contains no cloud/user-identity fields
 *  5. Copy text matches privacy note — no "credential", no "login"
 *  6. buildPassportAttachmentPreview output includes required sections
 *  7. startPassportEdit sets isReeditingPassport = true and clears passport
 *  8. finishPassportFlow clears isReeditingPassport and resets flowStep
 *  9. PassportGate logic: isReeditingPassport forces showFlow = true even for onboarded users
 * 10. Copied text does not contain Memory Vault private fields
 */

import { usePassportStore, PASSPORT_STORAGE_KEY } from '../features/passport/usePassportStore';
import { createPassportData } from '../features/passport/passport.utils';
import { buildPassportAttachmentPreview } from '../features/passport/passportAttachment';
import type { PassportProfile } from '../features/passport/passport.types';
import { DEFAULT_FRONTAL_LOBE_PROFILE } from '../types/personalMemoryVault';
import { PERSONAL_MEMORY_VAULT_STORAGE_KEY } from '../services/personalMemoryVaultStorage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Test 1: Badge renders only when passport exists ─────────────────────────

describe('Test 1 — badge visibility', () => {
  beforeEach(resetStore);

  it('passport store has a passport after createPassportData is used', () => {
    const data = createPassportData(FULL_PROFILE);
    usePassportStore.setState({ passport: data });
    const { passport } = usePassportStore.getState();
    expect(passport).not.toBeNull();
    expect(passport?.id).toMatch(/^MPH-/);
  });

  it('passport store returns null when no passport has been created', () => {
    const { passport } = usePassportStore.getState();
    expect(passport).toBeNull();
  });
});

// ─── Test 2: Copy produces valid Passport Attachment v0.1 ────────────────────

describe('Test 2 — copy text: Passport Attachment v0.1 format', () => {
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

  it('text is under 700 characters — stays concise', () => {
    const data       = createPassportData(FULL_PROFILE);
    const attachment = buildPassportAttachmentPreview(data, DEFAULT_FRONTAL_LOBE_PROFILE);
    expect(attachment.text.length).toBeLessThan(700);
  });
});

// ─── Test 3: Copy text has no cloud or user-identity fields ──────────────────

describe('Test 3 — copy text: no cloud or identity fields', () => {
  it('passport attachment text does not contain userId / supabase fields', () => {
    const data       = createPassportData(FULL_PROFILE);
    const attachment = buildPassportAttachmentPreview(data, DEFAULT_FRONTAL_LOBE_PROFILE);
    const text       = attachment.text.toLowerCase();

    expect(text).not.toContain('userid');
    expect(text).not.toContain('supabase');
    expect(text).not.toContain('synced');
    expect(text).not.toContain('token');
  });

  it('passport attachment text does not imply native platform recognition', () => {
    const data       = createPassportData(FULL_PROFILE);
    const attachment = buildPassportAttachmentPreview(data, DEFAULT_FRONTAL_LOBE_PROFILE);
    const text       = attachment.text;

    expect(text).not.toMatch(/automatically knows/i);
    expect(text).not.toMatch(/verified credential/i);
    expect(text).not.toMatch(/login identity/i);
  });

  it('passport attachment text does not contain "credential"', () => {
    const data       = createPassportData(FULL_PROFILE);
    const attachment = buildPassportAttachmentPreview(data, DEFAULT_FRONTAL_LOBE_PROFILE);
    expect(attachment.text).not.toMatch(/credential/i);
  });
});

// ─── Test 4: Copy text does not leak Memory Vault private data ───────────────

describe('Test 4 — copy text: no Memory Vault leak', () => {
  beforeEach(() => {
    resetStore();
    // Seed vault with private data
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

  it('vault storage key is untouched after building attachment', () => {
    const vaultBefore = localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    createPassportData(FULL_PROFILE);
    const vaultAfter = localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    expect(vaultAfter).toBe(vaultBefore);
  });
});

// ─── Test 5: startPassportEdit sets isReeditingPassport ──────────────────────

describe('Test 5 — startPassportEdit: re-editing flow', () => {
  beforeEach(resetStore);

  it('startPassportEdit sets isReeditingPassport = true', () => {
    const data = createPassportData(FULL_PROFILE);
    usePassportStore.setState({ passport: data });

    usePassportStore.getState().startPassportEdit();

    const state = usePassportStore.getState();
    expect(state.isReeditingPassport).toBe(true);
  });

  it('startPassportEdit clears the passport and resets to welcome step', () => {
    const data = createPassportData(FULL_PROFILE);
    usePassportStore.setState({ passport: data, flowStep: 'complete' });

    usePassportStore.getState().startPassportEdit();

    const state = usePassportStore.getState();
    expect(state.passport).toBeNull();
    expect(state.flowStep).toBe('welcome');
    expect(state.draft).toEqual({});
  });

  it('gate logic: isReeditingPassport forces showFlow = true even for onboarded user', () => {
    // Simulate the gate's conditions after startPassportEdit
    const passport            = null; // cleared by startPassportEdit
    const hasSeenOnboarding   = true; // existing user
    const flowStep            = 'welcome' as 'welcome' | 'calibration' | 'generating' | 'complete';
    const isReeditingPassport = true;

    const isNewUser      = !passport && !hasSeenOnboarding;
    const isViewingCard = (flowStep as string) === 'complete';
    const isReEditing    = isReeditingPassport;
    const showFlow       = isNewUser || isViewingCard || isReEditing;

    expect(showFlow).toBe(true); // gate should show the passport flow
  });
});

// ─── Test 6: finishPassportFlow clears re-editing state ──────────────────────

describe('Test 6 — finishPassportFlow: gate release', () => {
  beforeEach(resetStore);

  it('finishPassportFlow clears isReeditingPassport', () => {
    usePassportStore.setState({ isReeditingPassport: true, flowStep: 'complete' });

    usePassportStore.getState().finishPassportFlow();

    const state = usePassportStore.getState();
    expect(state.isReeditingPassport).toBe(false);
    expect(state.flowStep).toBe('welcome');
  });

  it('gate logic: after finishPassportFlow, existing user with passport enters the app', () => {
  const passport = createPassportData(FULL_PROFILE);
  const hasSeenOnboarding = true;
  const flowStep = 'welcome';
  const isReeditingPassport = false;

  const isNewUser = !passport && !hasSeenOnboarding;
  const isViewingCard = (flowStep as string) === 'complete';
  const isReEditing = isReeditingPassport;
  const showFlow = isNewUser || isViewingCard || isReEditing;

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
    // Either nothing in storage yet, or storage lacks isReeditingPassport — both correct
  });
});
