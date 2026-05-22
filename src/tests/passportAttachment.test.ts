import {
  appendPassportAttachment,
  buildPassportAttachmentPreview,
} from '../features/passport/passportAttachment';
import {
  DEFAULT_PASSPORT_CONFIGURATION_V2,
  type PassportData,
} from '../features/passport/passport.types';
import { DEFAULT_FRONTAL_LOBE_PROFILE } from '../types/personalMemoryVault';

const passport: PassportData = {
  id: 'MPH-AAAA-BBBB-CCCC',
  fingerprint: 'AAAABBBBCCCCDDDD',
  profile: {
    communicationStyle: 'structured',
    tone: 'friendly',
    focusArea: 'app',
  },
  configuration: {
    ...DEFAULT_PASSPORT_CONFIGURATION_V2,
    preferredName: 'Kris',
    roleContext: 'Solo founder',
  },
  createdAt: '2026-05-21T10:00:00.000Z',
  schemaVersion: '1.0',
};

describe('Passport Attachment format', () => {
  it('builds a concise human-readable Passport Attachment', () => {
    const attachment = buildPassportAttachmentPreview(
      passport,
      DEFAULT_FRONTAL_LOBE_PROFILE,
      '2026-05-21T12:00:00.000Z',
    );

    expect(attachment.schemaVersion).toBe('memephant.passport.v0.1');
    expect(attachment.text).toContain('# Memephant Passport Attachment v0.1');
    expect(attachment.text).toContain('- Preferred name: Kris');
    expect(attachment.text).toContain('- Role/context: Solo founder');
    expect(attachment.text).toContain('- Region: United Kingdom');
    expect(attachment.text).toContain('- Tone: Friendly');
    expect(attachment.text).toContain('- Style: Structured');
    expect(attachment.text).toContain('- Language: British English');
    expect(attachment.text).toContain('- Directness: Honest but supportive');
    expect(attachment.text).toContain('- Technical level: Learning builder');
    expect(attachment.text).toContain('- Risk tolerance: Prefer small safe patches');
    expect(attachment.text).toContain('- Ask before assuming missing details.');
    expect(attachment.text).toContain('- Do not invent files or code that have not been shown.');
    expect(attachment.text).toContain('- No passwords');
    expect(attachment.text).toContain('- No API keys');
    expect(attachment.text).toContain('- No silent sharing');
    expect(attachment.text).toContain('Integrity fingerprint: MPH-AAAA-BBBB-CCCC');
    expect(attachment.text).not.toMatch(/credential/i);
    expect(attachment.text.length).toBeLessThan(1500);
    expect(attachment.text.trim()).not.toMatch(/^{/);
  });

  it('appends attachment text without mutating the base export', () => {
    const base = 'PROJECT EXPORT';
    const result = appendPassportAttachment(base, 'PASSPORT ATTACHMENT');

    expect(base).toBe('PROJECT EXPORT');
    expect(result).toBe('PROJECT EXPORT\n\nPASSPORT ATTACHMENT');
  });

  it('keeps long configured guidance compact in the attachment', () => {
    const longPassport: PassportData = {
      ...passport,
      configuration: {
        ...DEFAULT_PASSPORT_CONFIGURATION_V2,
        directness: 'Be very detailed about trade-offs, constraints, risks, alternatives, assumptions, and edge cases whenever the task is ambiguous or safety-critical.',
        alwaysRules: [
          'Explain the smallest safe next step, name the exact files involved, and avoid skipping validation details even when the request looks straightforward.',
          'Keep the user informed without turning the answer into a long corporate status report.',
          'Ask before assuming missing business context, hidden requirements, or private details.',
        ],
        neverRules: [
          'Do not suggest broad rewrites before small safe fixes, especially in production-sensitive code paths where deterministic behaviour matters.',
          'Do not ask for passwords, API keys, secrets, tokens, OAuth credentials, or private account recovery details.',
          'Do not invent files, APIs, product claims, customer data, or code that has not been shown.',
        ],
      },
    };

    const attachment = buildPassportAttachmentPreview(longPassport, DEFAULT_FRONTAL_LOBE_PROFILE);

    expect(attachment.text.length).toBeLessThan(1500);
    expect(attachment.text).toContain('...');
  });
});
