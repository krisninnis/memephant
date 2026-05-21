import type { PassportData } from './passport.types';
import {
  COMMUNICATION_LABELS,
  FOCUS_LABELS,
  TONE_LABELS,
} from './passport.utils';
import {
  DEFAULT_FRONTAL_LOBE_PROFILE,
  getFrontalLobeLanguageLabel,
  type FrontalLobeProfile,
} from '../../types/personalMemoryVault';

export const PASSPORT_ATTACHMENT_SCHEMA_VERSION = 'memephant.passport.v0.1';

export type PassportAttachmentStatus = 'included' | 'excluded' | 'locked';

export type PassportAttachmentPreview = {
  schemaVersion: typeof PASSPORT_ATTACHMENT_SCHEMA_VERSION;
  passportId: string;
  workingStyle: {
    tone: string;
    style: string;
    focus: string;
    language: string;
  };
  privacyRules: string[];
  compatibility: string[];
  integrityFingerprint: string;
  generatedAt: string;
  text: string;
};

function getLanguage(profile?: FrontalLobeProfile | null): string {
  return getFrontalLobeLanguageLabel(
    profile?.languagePreference ?? DEFAULT_FRONTAL_LOBE_PROFILE.languagePreference,
  );
}

export function buildPassportAttachmentPreview(
  passport: PassportData,
  frontalLobeProfile?: FrontalLobeProfile | null,
  generatedAt = new Date().toISOString(),
): PassportAttachmentPreview {
  const style = COMMUNICATION_LABELS[passport.profile.communicationStyle];
  const tone = TONE_LABELS[passport.profile.tone];
  const focus = FOCUS_LABELS[passport.profile.focusArea];
  const language = getLanguage(frontalLobeProfile);
  const privacyRules = ['No passwords', 'No API keys', 'No silent sharing'];
  const compatibility = ['ChatGPT', 'Claude', 'Gemini'];

  const text = [
    '# Memephant Passport Attachment v0.1',
    '',
    'AI Working Identity',
    `- Tone: ${tone}`,
    `- Style: ${style}`,
    `- Focus: ${focus}`,
    `- Language: ${language}`,
    '',
    'Privacy Rules',
    ...privacyRules.map((rule) => `- ${rule}`),
    '',
    'Compatibility',
    ...compatibility.map((platform) => `- ${platform}`),
    '',
    `Integrity fingerprint: ${passport.id}`,
  ].join('\n');

  return {
    schemaVersion: PASSPORT_ATTACHMENT_SCHEMA_VERSION,
    passportId: passport.id,
    workingStyle: {
      tone,
      style,
      focus,
      language,
    },
    privacyRules,
    compatibility,
    integrityFingerprint: passport.fingerprint,
    generatedAt,
    text,
  };
}

export function appendPassportAttachment(
  exportText: string,
  attachmentText?: string | null,
): string {
  if (!attachmentText?.trim()) return exportText;
  return `${exportText.trimEnd()}\n\n${attachmentText.trim()}`;
}
