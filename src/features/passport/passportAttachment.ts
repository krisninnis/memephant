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
    roleContext: string;
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

function formatOptionalLine(label: string, value: string): string[] {
  return value.trim() ? [`- ${label}: ${value}`] : [];
}

export function buildPassportAttachmentPreview(
  passport: PassportData,
  frontalLobeProfile?: FrontalLobeProfile | null,
  generatedAt = new Date().toISOString(),
): PassportAttachmentPreview {
  const style = COMMUNICATION_LABELS[passport.profile.communicationStyle];
  const tone = TONE_LABELS[passport.profile.tone];
  const focus = FOCUS_LABELS[passport.profile.focusArea];
  const configuration = getPassportConfiguration(passport);

  const preferredName = compactAttachmentText(configuration.preferredName, 40);
  const roleContext = compactAttachmentText(configuration.roleContext, 50);
  const region = compactAttachmentText(configuration.region, 45);
  const language =
    compactAttachmentText(configuration.languagePreference, 45) ||
    getLanguage(frontalLobeProfile);
  const timezone = compactAttachmentText(configuration.timezone, 35);
  const dateFormat = compactAttachmentText(configuration.dateFormat, 24);
  const currency = compactAttachmentText(configuration.currency, 24);
  const directness = compactAttachmentText(configuration.directness, 60);
  const technicalLevel = compactAttachmentText(configuration.technicalLevel, 60);
  const riskTolerance = compactAttachmentText(configuration.riskTolerance, 60);

  const alwaysRules = configuration.alwaysRules
    .slice(0, 3)
    .map((rule) => compactAttachmentText(rule, 62))
    .filter(Boolean);

  const neverRules = configuration.neverRules
    .slice(0, 3)
    .map((rule) => compactAttachmentText(rule, 62))
    .filter(Boolean);

  const privacyRules = [
    'No passwords.',
    'No API keys, private keys, recovery phrases, or secrets.',
    'No silent sharing or invented facts.',
    'Medical/legal/financial: general guidance; suggest professional checks.',
    'No project state, commits, file paths, repo status, or tasks.',
  ];

  const compatibility = [
    'ChatGPT',
    'Claude',
    'Gemini',
    'Grok',
    'Perplexity',
    'local LLMs',
  ];

  const text = [
    '# AI Passport',
    '',
    'User-provided profile for how AI should work with me.',
    'Not a project brief, task update, repo summary, or Memory Trail.',
    '',
    '## Basics',
    ...formatOptionalLine('Preferred name', preferredName),
    ...formatOptionalLine('Role/context', roleContext),
    `- Region: ${region}`,
    `- Language: ${language}`,
    `- Locale: ${timezone} | ${dateFormat} | ${currency}`,
    '',
    '## How to Answer Me',
    `- Style: ${style}`,
    `- Tone: ${tone}`,
    `- Typical use area: ${focus}`,
    `- Directness: ${directness}`,
    `- Technical level: ${technicalLevel}`,
    `- Risk tolerance: ${riskTolerance}`,
    '',
    '## Everyday Use',
    '- Use my region, currency, dates, and language when relevant.',
    '- For comparisons, show cheap / sensible / premium options.',
    '- For local prices, state assumptions or ask for details.',
    '',
    '## Always',
    ...alwaysRules.map((rule) => `- ${rule}`),
    '',
    '## Never',
    ...neverRules.map((rule) => `- ${rule}`),
    '',
    '## Boundaries',
    ...privacyRules.map((rule) => `- ${rule}`),
    '',
    `Compatible with: ${compatibility.join(', ')}`,
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
      roleContext,
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
