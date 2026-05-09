import {
  createConsentLedgerEvent,
  createDefaultPersonalMemoryVault,
  createPersonalMemoryEntry,
} from '../types/personalMemoryVault';
import {
  RECEIPT_INTEGRITY_HASH_LENGTH,
  RECEIPT_INTEGRITY_HASH_PREFIX,
  computeReceiptIntegrityHash,
  generateConsentReceiptMarkdown,
} from '../utils/consentReceipt';

function splitReceiptBodyAndHashLine(receipt: string): { body: string; hashLine: string } {
  const lastNewline = receipt.lastIndexOf('\n');
  return {
    body: receipt.slice(0, lastNewline),
    hashLine: receipt.slice(lastNewline + 1),
  };
}

function readDisplayedHash(receipt: string): string {
  const { hashLine } = splitReceiptBodyAndHashLine(receipt);
  expect(hashLine.startsWith(RECEIPT_INTEGRITY_HASH_PREFIX)).toBe(true);
  return hashLine.slice(RECEIPT_INTEGRITY_HASH_PREFIX.length);
}

describe('Consent Receipt export', () => {
  it('generates an empty local-only receipt safely', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-09T10:00:00.000Z');
    const receipt = generateConsentReceiptMarkdown(vault, '2026-05-09T11:00:00.000Z');

    expect(receipt).toContain('# Memephant Personal Memory Vault - Consent Receipt');
    expect(receipt).toContain('Generated: 2026-05-09T11:00:00.000Z');
    expect(receipt).toContain('Vault schema: 0.1.0');
    expect(receipt).toContain('No consent events recorded yet.');
    expect(receipt).toContain('stored locally');
    expect(receipt).toContain('not legal advice');
    expect(receipt).toContain('not automatic enforcement');
    expect(receipt).toContain('Platforms are not automatically bound by this receipt');
  });

  it('includes counts and current permission state without memory entry contents', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-09T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry('PrivateMemoryEntryContentSentinel', {
        id: 'private-entry-1',
        updatedAt: vault.updatedAt,
      }),
    ];
    vault.neverShare = ['NeverShareContentSentinel'];
    vault.consentLedger = [
      createConsentLedgerEvent({
        id: 'consent-1',
        createdAt: '2026-05-09T10:30:00.000Z',
        action: 'consent_granted',
        scope: 'ai_training',
        aiTrainingAllowed: true,
      }),
    ];

    const receipt = generateConsentReceiptMarkdown(vault, '2026-05-09T11:00:00.000Z');

    expect(receipt).toContain('- Private entries: 1');
    expect(receipt).toContain('- Never-share items: 1');
    expect(receipt).toContain('- Consent ledger events: 1');
    expect(receipt).toContain('- Preferences: 1');
    expect(receipt).toContain('- Private notes: 0');
    expect(receipt).toContain('- AI training permission: Allowed by latest local ledger event');
    expect(receipt).toContain('This receipt does not include private memory entry contents.');
    expect(receipt).not.toContain('PrivateMemoryEntryContentSentinel');
    expect(receipt).not.toContain('NeverShareContentSentinel');
  });

  it('includes consent event metadata and receipt text', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-09T10:00:00.000Z');
    vault.consentLedger = [
      createConsentLedgerEvent({
        id: 'consent-2',
        createdAt: '2026-05-09T10:45:00.000Z',
        action: 'consent_refused',
        scope: 'commercial_licensing',
        platform: 'Claude',
        target: 'preferences',
        notes: 'ReceiptEventNotesSentinel',
      }),
    ];

    const receipt = generateConsentReceiptMarkdown(vault, '2026-05-09T11:00:00.000Z');

    expect(receipt).toContain('- Timestamp: 2026-05-09T10:45:00.000Z');
    expect(receipt).toContain('- Action: Consent Refused');
    expect(receipt).toContain('- Scope: Commercial Licensing');
    expect(receipt).toContain('- Status: Refused');
    expect(receipt).toContain('- Platform: Claude');
    expect(receipt).toContain('- Target: preferences');
    expect(receipt).toContain('ReceiptEventNotesSentinel');
  });

  it('shows chronological corrective consent history without changing the original event', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-09T10:00:00.000Z');
    const original = createConsentLedgerEvent({
      id: 'original-consent-event',
      createdAt: '2026-05-09T10:15:00.000Z',
      action: 'consent_granted',
      scope: 'platform_sharing',
      platform: 'ChatGPT',
      notes: 'Original ledger note',
    });
    const correction = createConsentLedgerEvent({
      id: 'corrective-consent-event',
      createdAt: '2026-05-09T10:45:00.000Z',
      action: 'consent_revoked',
      scope: 'platform_sharing',
      platform: 'ChatGPT',
      correctsEventId: original.id,
      notes: 'Corrective ledger note',
    });
    vault.consentLedger = [original, correction];

    const receipt = generateConsentReceiptMarkdown(vault, '2026-05-09T11:00:00.000Z');

    expect(receipt.indexOf('Original ledger note')).toBeLessThan(
      receipt.indexOf('Corrective ledger note'),
    );
    expect(receipt).toContain('- Corrects event: original-consent-event');
    expect(receipt).toContain('- Revoked events: 1');
  });

  it('does not expose private entry text when corrective events exist', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-09T10:00:00.000Z');
    vault.privateNotes = [
      createPersonalMemoryEntry('Private corrective receipt memory sentinel', {
        id: 'private-corrective-note',
        updatedAt: vault.updatedAt,
      }),
    ];
    vault.consentLedger = [
      createConsentLedgerEvent({
        id: 'corrective-safe-event',
        createdAt: '2026-05-09T10:45:00.000Z',
        action: 'permission_updated',
        scope: 'memory_export',
        correctsEventId: 'old-safe-event',
      }),
    ];

    const receipt = generateConsentReceiptMarkdown(vault, '2026-05-09T11:00:00.000Z');

    expect(receipt).toContain('- Corrects event: old-safe-event');
    expect(receipt).not.toContain('Private corrective receipt memory sentinel');
  });

  it('redacts secrets and local file paths in ledger event text', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-09T10:00:00.000Z');
    const event = createConsentLedgerEvent({
      id: 'consent-3',
      createdAt: '2026-05-09T10:50:00.000Z',
      action: 'permission_updated',
      scope: 'memory_export',
      notes: 'token=abcdefghijklmnopqrstuvwxyz123456 and C:\\Users\\thoma\\secret\\file.txt',
    });
    vault.consentLedger = [event];

    const receipt = generateConsentReceiptMarkdown(vault, '2026-05-09T11:00:00.000Z');

    expect(receipt).toContain('[REDACTED]');
    expect(receipt).toContain('[REDACTED_PATH]');
    expect(receipt).not.toContain('abcdefghijklmnopqrstuvwxyz123456');
    expect(receipt).not.toContain('C:\\Users\\thoma\\secret\\file.txt');
  });

  it('does not include dangerous private entry or never-share sentinel values', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-09T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry(
        'VAULT_SECRET_DO_NOT_EXPORT sk-123456789012345678901234567890 C:\\Users\\thoma\\secret',
        {
          id: 'project-export-sentinel-entry',
          updatedAt: vault.updatedAt,
        },
      ),
    ];
    vault.neverShare = ['Personal never-share phrase'];

    const receipt = generateConsentReceiptMarkdown(vault, '2026-05-09T11:00:00.000Z');

    expect(receipt).not.toContain('VAULT_SECRET_DO_NOT_EXPORT');
    expect(receipt).not.toContain('sk-123456789012345678901234567890');
    expect(receipt).not.toContain('C:\\Users\\thoma\\secret');
    expect(receipt).not.toContain('Personal never-share phrase');
    expect(receipt).toContain('- Private entries: 1');
    expect(receipt).toContain('- Never-share items: 1');
  });

  it('does not modify the vault', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-09T10:00:00.000Z');
    vault.consentLedger = [
      createConsentLedgerEvent({
        id: 'consent-4',
        createdAt: '2026-05-09T10:55:00.000Z',
        action: 'consent_revoked',
        scope: 'platform_sharing',
      }),
    ];
    const before = JSON.stringify(vault);

    generateConsentReceiptMarkdown(vault, '2026-05-09T11:00:00.000Z');

    expect(JSON.stringify(vault)).toBe(before);
  });
});

describe('Consent Receipt integrity hash', () => {
  it('appends an integrity hash section and labels it as a tamper-evidence helper, not legal proof', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-09T10:00:00.000Z');
    const receipt = generateConsentReceiptMarkdown(vault, '2026-05-09T11:00:00.000Z');

    expect(receipt).toContain('## Integrity Hash');
    expect(receipt).toContain('tamper-evidence helper');
    expect(receipt).toContain('not a digital signature');
    expect(receipt).toContain('not legal proof');
    expect(receipt).toContain('not identity verification');

    const { hashLine } = splitReceiptBodyAndHashLine(receipt);
    expect(hashLine).toMatch(
      new RegExp(`^Integrity hash \\(SHA-256, 12 chars\\): [0-9a-f]{${RECEIPT_INTEGRITY_HASH_LENGTH}}$`),
    );
    expect(receipt.endsWith(hashLine)).toBe(true);
  });

  it('produces the same hash for the same vault and generatedAt timestamp', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-09T10:00:00.000Z');
    vault.consentLedger = [
      createConsentLedgerEvent({
        id: 'consent-deterministic',
        createdAt: '2026-05-09T10:30:00.000Z',
        action: 'consent_refused',
        scope: 'ai_training',
      }),
    ];

    const first = generateConsentReceiptMarkdown(vault, '2026-05-09T11:00:00.000Z');
    const second = generateConsentReceiptMarkdown(vault, '2026-05-09T11:00:00.000Z');

    expect(first).toBe(second);
    expect(readDisplayedHash(first)).toBe(readDisplayedHash(second));
  });

  it('changes the hash when consent ledger data changes', () => {
    const generatedAt = '2026-05-09T11:00:00.000Z';

    const vaultA = createDefaultPersonalMemoryVault('2026-05-09T10:00:00.000Z');
    vaultA.consentLedger = [
      createConsentLedgerEvent({
        id: 'consent-original',
        createdAt: '2026-05-09T10:30:00.000Z',
        action: 'consent_refused',
        scope: 'ai_training',
      }),
    ];

    const vaultB = createDefaultPersonalMemoryVault('2026-05-09T10:00:00.000Z');
    vaultB.consentLedger = [
      createConsentLedgerEvent({
        id: 'consent-original',
        createdAt: '2026-05-09T10:30:00.000Z',
        action: 'consent_granted',
        scope: 'ai_training',
        aiTrainingAllowed: true,
      }),
    ];

    const hashA = readDisplayedHash(generateConsentReceiptMarkdown(vaultA, generatedAt));
    const hashB = readDisplayedHash(generateConsentReceiptMarkdown(vaultB, generatedAt));

    expect(hashA).not.toEqual(hashB);
  });

  it('computes the integrity hash over the body and excludes the hash line itself', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-09T10:00:00.000Z');
    vault.consentLedger = [
      createConsentLedgerEvent({
        id: 'consent-body-exclusion',
        createdAt: '2026-05-09T10:30:00.000Z',
        action: 'permission_updated',
        scope: 'memory_export',
      }),
    ];

    const receipt = generateConsentReceiptMarkdown(vault, '2026-05-09T11:00:00.000Z');
    const { body, hashLine } = splitReceiptBodyAndHashLine(receipt);
    const displayedHash = hashLine.slice(RECEIPT_INTEGRITY_HASH_PREFIX.length);

    expect(displayedHash).toHaveLength(RECEIPT_INTEGRITY_HASH_LENGTH);
    expect(displayedHash).toMatch(/^[0-9a-f]+$/);
    expect(body).not.toContain(RECEIPT_INTEGRITY_HASH_PREFIX);
    expect(computeReceiptIntegrityHash(body)).toBe(displayedHash);
  });

  it('produces a different hash when the receipt body would change', () => {
    const generatedAt = '2026-05-09T11:00:00.000Z';
    const vault = createDefaultPersonalMemoryVault('2026-05-09T10:00:00.000Z');

    const baseline = generateConsentReceiptMarkdown(vault, generatedAt);
    const baselineHash = readDisplayedHash(baseline);

    const tamperedBody = splitReceiptBodyAndHashLine(baseline).body.replace(
      'Memephant Personal Memory Vault - Consent Receipt',
      'Tampered Consent Receipt Title',
    );
    expect(computeReceiptIntegrityHash(tamperedBody)).not.toEqual(baselineHash);
  });

  it('keeps the integrity hash section free of private entry contents and never-share text', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-09T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry('IntegrityHashPrivateEntrySentinel', {
        id: 'integrity-pref-1',
        updatedAt: vault.updatedAt,
      }),
    ];
    vault.privateNotes = [
      createPersonalMemoryEntry('IntegrityHashPrivateNoteSentinel', {
        id: 'integrity-note-1',
        updatedAt: vault.updatedAt,
      }),
    ];
    vault.neverShare = ['IntegrityHashNeverShareSentinel'];

    const receipt = generateConsentReceiptMarkdown(vault, '2026-05-09T11:00:00.000Z');

    expect(receipt).not.toContain('IntegrityHashPrivateEntrySentinel');
    expect(receipt).not.toContain('IntegrityHashPrivateNoteSentinel');
    expect(receipt).not.toContain('IntegrityHashNeverShareSentinel');

    const { hashLine } = splitReceiptBodyAndHashLine(receipt);
    expect(hashLine).not.toContain('IntegrityHashPrivateEntrySentinel');
    expect(hashLine).not.toContain('IntegrityHashPrivateNoteSentinel');
    expect(hashLine).not.toContain('IntegrityHashNeverShareSentinel');
  });

  it('keeps redacting secrets and local paths even with the integrity hash appended', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-09T10:00:00.000Z');
    vault.consentLedger = [
      createConsentLedgerEvent({
        id: 'consent-redaction-with-hash',
        createdAt: '2026-05-09T10:50:00.000Z',
        action: 'permission_updated',
        scope: 'memory_export',
        notes:
          'token=integrityHashRedactionToken1234567890 plus C:\\Users\\thoma\\integrity-secret\\file.txt',
      }),
    ];

    const receipt = generateConsentReceiptMarkdown(vault, '2026-05-09T11:00:00.000Z');

    expect(receipt).toContain('[REDACTED]');
    expect(receipt).toContain('[REDACTED_PATH]');
    expect(receipt).not.toContain('integrityHashRedactionToken1234567890');
    expect(receipt).not.toContain('C:\\Users\\thoma\\integrity-secret\\file.txt');

    const { body, hashLine } = splitReceiptBodyAndHashLine(receipt);
    expect(computeReceiptIntegrityHash(body)).toBe(
      hashLine.slice(RECEIPT_INTEGRITY_HASH_PREFIX.length),
    );
  });
});
