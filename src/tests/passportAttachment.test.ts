import {
  appendPassportAttachment,
  buildPassportAttachmentPreview,
} from '../features/passport/passportAttachment';
import type { PassportData } from '../features/passport/passport.types';
import { DEFAULT_FRONTAL_LOBE_PROFILE } from '../types/personalMemoryVault';

const passport: PassportData = {
  id: 'MPH-AAAA-BBBB-CCCC',
  fingerprint: 'AAAABBBBCCCCDDDD',
  profile: {
    communicationStyle: 'structured',
    tone: 'friendly',
    focusArea: 'app',
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
    expect(attachment.text).toContain('- Tone: Friendly');
    expect(attachment.text).toContain('- Style: Structured');
    expect(attachment.text).toContain('- Language: British English');
    expect(attachment.text).toContain('- No passwords');
    expect(attachment.text).toContain('- No API keys');
    expect(attachment.text).toContain('- No silent sharing');
    expect(attachment.text).toContain('Integrity fingerprint: MPH-AAAA-BBBB-CCCC');
    expect(attachment.text).not.toMatch(/credential/i);
    expect(attachment.text.length).toBeLessThan(700);
  });

  it('appends attachment text without mutating the base export', () => {
    const base = 'PROJECT EXPORT';
    const result = appendPassportAttachment(base, 'PASSPORT ATTACHMENT');

    expect(base).toBe('PROJECT EXPORT');
    expect(result).toBe('PROJECT EXPORT\n\nPASSPORT ATTACHMENT');
  });
});
