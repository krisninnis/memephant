import type { PassportData } from './passport.types';
import {
  COMMUNICATION_LABELS,
  FOCUS_LABELS,
  TONE_LABELS,
  getPassportConfiguration,
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
  identity: {
    preferredName: string;
    region: string;
    timezone: string;
    dateFormat: string;
    currency: string;
  };
  guidance: {
    directness: string;
    technicalLevel: string;
    riskTolerance: string;
    alwaysRules: string[];
    neverRules: string[];
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

function compactAttachmentText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 3).trimEnd()}...`;
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
  const configuration = getPassportConfiguration(passport);
  const preferredName = compactAttachmentText(configuration.preferredName, 60);
  const region = compactAttachmentText(configuration.region, 80);
  const timezone = compactAttachmentText(configuration.timezone, 60);
  const dateFormat = compactAttachmentText(configuration.dateFormat, 40);
  const currency = compactAttachmentText(configuration.currency, 40);
  const directness = compactAttachmentText(configuration.directness, 120);
  const technicalLevel = compactAttachmentText(configuration.technicalLevel, 120);
  const riskTolerance = compactAttachmentText(configuration.riskTolerance, 120);
  const alwaysRules = configuration.alwaysRules
    .slice(0, 3)
    .map((rule) => compactAttachmentText(rule, 140));
  const neverRules = configuration.neverRules
    .slice(0, 3)
    .map((rule) => compactAttachmentText(rule, 140));
  const privacyRules = ['No passwords', 'No API keys', 'No silent sharing'];
  const compatibility = ['ChatGPT', 'Claude', 'Gemini'];

  const text = [
    '# Memephant Passport Attachment v0.1',
    '',
    'AI Working Identity',
    ...(preferredName ? [`- Preferred name: ${preferredName}`] : []),
    `- Region: ${region}`,
    `- Tone: ${tone}`,
    `- Style: ${style}`,
    `- Focus: ${focus}`,
    `- Language: ${language}`,
    `- Locale: ${timezone} · ${dateFormat} · ${currency}`,
    `- Directness: ${directness}`,
    `- Technical level: ${technicalLevel}`,
    `- Risk tolerance: ${riskTolerance}`,
    '',
    'Always',
    ...alwaysRules.map((rule) => `- ${rule}`),
    '',
    'Never',
    ...neverRules.map((rule) => `- ${rule}`),
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
    identity: {
      preferredName,
      region,
      timezone,
      dateFormat,
      currency,
    },
    guidance: {
      directness,
      technicalLevel,
      riskTolerance,
      alwaysRules,
      neverRules,
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
