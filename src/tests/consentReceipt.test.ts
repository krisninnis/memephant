import {
  createConsentLedgerEvent,
  createDefaultPersonalMemoryVault,
  createPersonalMemoryEntry,
} from '../types/personalMemoryVault';
import { generateConsentReceiptMarkdown } from '../utils/consentReceipt';

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
