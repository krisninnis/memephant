import type { Platform } from './memphant-types';

export const PERSONAL_MEMORY_VAULT_SCHEMA_VERSION = '0.1.0';

// ── Frontal Lobe / AI Working Style profile ──────────────────────────────────

export type FrontalLobeAnswerStyle =
  | 'straight_shooter'
  | 'strict_code_reviewer'
  | 'balanced_builder'
  | 'friendly_coach'
  | 'red_team_mode';

export type FrontalLobeChallengeLevel = 'low' | 'balanced' | 'high' | 'red_team';

export type FrontalLobeCodeReviewStrictness = 'gentle' | 'normal' | 'strict' | 'no_mercy';

export type FrontalLobeExplanationDepth = 'steps_only' | 'explain_why' | 'teach_deeply';

export type FrontalLobeTone = 'direct' | 'balanced' | 'friendly';

export type FrontalLobeLanguagePreference =
  | 'british_english'
  | 'american_english'
  | 'australian_english'
  | 'canadian_english'
  | 'neutral_english';

// ── Builder Skill Profile ─────────────────────────────────────────────────────

export type FrontalLobeCodingConfidence =
  | 'brand_new'
  | 'can_edit_with_exact_instructions'
  | 'understands_basics'
  | 'builds_with_guidance'
  | 'experienced';

export type FrontalLobeCodeInstructionStyle =
  | 'exact_file_and_patch'
  | 'small_safe_steps'
  | 'full_files'
  | 'focused_diffs'
  | 'high_level_then_code';

export type FrontalLobeDebuggingSupport =
  | 'plain_english_error'
  | 'exact_next_command'
  | 'likely_causes_and_fixes'
  | 'ask_for_logs'
  | 'advanced_root_cause';

export type FrontalLobePreferredPace =
  | 'slow_guided'
  | 'normal'
  | 'fast_with_risks'
  | 'expert';

// ── Default inclusion mode ───────────────────────────────────────────────────

export type FrontalLobeMode = 'default_on' | 'ask_each_time' | 'manual_only' | 'off';
export type MemephantPassportStatus = 'Starter' | 'Calibrated' | 'Portable' | 'Trusted';

export interface FrontalLobeProfile {
  defaultAnswerStyle: FrontalLobeAnswerStyle;
  challengeLevel: FrontalLobeChallengeLevel;
  codeReviewStrictness: FrontalLobeCodeReviewStrictness;
  explanationDepth: FrontalLobeExplanationDepth;
  tone: FrontalLobeTone;
  languagePreference: FrontalLobeLanguagePreference;
  codingConfidence: FrontalLobeCodingConfidence;
  codeInstructionStyle: FrontalLobeCodeInstructionStyle;
  debuggingSupport: FrontalLobeDebuggingSupport;
  preferredPace: FrontalLobePreferredPace;
  mode: FrontalLobeMode;
  customRules: string[];
  updatedAt?: string;
}

export const DEFAULT_FRONTAL_LOBE_PROFILE: FrontalLobeProfile = {
  defaultAnswerStyle: 'balanced_builder',
  challengeLevel: 'balanced',
  codeReviewStrictness: 'normal',
  explanationDepth: 'explain_why',
  tone: 'balanced',
  languagePreference: 'british_english',
  codingConfidence: 'can_edit_with_exact_instructions',
  codeInstructionStyle: 'exact_file_and_patch',
  debuggingSupport: 'plain_english_error',
  preferredPace: 'slow_guided',
  mode: 'default_on',
  customRules: [],
};

export const FRONTAL_LOBE_LANGUAGE_LABELS: Record<FrontalLobeLanguagePreference, string> = {
  british_english: 'British English',
  american_english: 'American English',
  australian_english: 'Australian English',
  canadian_english: 'Canadian English',
  neutral_english: 'Neutral English',
};

export const FRONTAL_LOBE_LANGUAGE_INSTRUCTIONS: Record<FrontalLobeLanguagePreference, string> = {
  british_english: 'Use British spelling and phrasing, e.g. centre, colour, organise, behaviour.',
  american_english: 'Use American spelling and phrasing, e.g. center, color, organize, behavior.',
  australian_english: 'Use Australian English spelling and phrasing.',
  canadian_english: 'Use Canadian English spelling and phrasing.',
  neutral_english: 'Use clear, neutral English and avoid region-specific idioms where possible.',
};

export const FRONTAL_LOBE_ANSWER_STYLE_LABELS: Record<FrontalLobeAnswerStyle, string> = {
  straight_shooter: 'Straight Shooter',
  strict_code_reviewer: 'Strict Code Reviewer',
  balanced_builder: 'Balanced Builder',
  friendly_coach: 'Friendly Coach',
  red_team_mode: 'Red Team Mode',
};

export const FRONTAL_LOBE_TONE_LABELS: Record<FrontalLobeTone, string> = {
  direct: 'Direct',
  balanced: 'Balanced',
  friendly: 'Friendly',
};

export const FRONTAL_LOBE_PACE_LABELS: Record<FrontalLobePreferredPace, string> = {
  slow_guided: 'Slow and guided',
  normal: 'Normal pace',
  fast_with_risks: 'Fast, with risks explained',
  expert: 'Expert mode',
};

export interface MemephantPassportSummary {
  status: MemephantPassportStatus;
  completionPercentage: number;
  completedItems: number;
  totalItems: number;
  missingItems: string[];
  workingStyleSummary: string;
  languagePreference: string;
  privacyStatus: string;
  exportReadiness: string;
  fingerprint: string;
  copyText: string;
}

export function getFrontalLobeLanguageLabel(value: FrontalLobeLanguagePreference): string {
  return FRONTAL_LOBE_LANGUAGE_LABELS[value] ?? value;
}

export function getFrontalLobeLanguageInstruction(value: FrontalLobeLanguagePreference): string {
  return FRONTAL_LOBE_LANGUAGE_INSTRUCTIONS[value] ?? FRONTAL_LOBE_LANGUAGE_INSTRUCTIONS.british_english;
}

function hasPassportValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === 'string' && item.trim().length > 0);
  }

  return typeof value === 'string' && value.trim().length > 0;
}

export function getMemephantPassportStatus(percentage: number): MemephantPassportStatus {
  if (percentage >= 100) return 'Trusted';
  if (percentage >= 85) return 'Portable';
  if (percentage >= 50) return 'Calibrated';
  return 'Starter';
}

export function getMemephantPassportSummary(
  profileInput?: Partial<FrontalLobeProfile> | null,
): MemephantPassportSummary {
  const profile = {
    ...DEFAULT_FRONTAL_LOBE_PROFILE,
    ...(profileInput ?? {}),
  };

  const checks: Array<{ label: string; complete: boolean }> = [
    { label: 'Answer style', complete: hasPassportValue(profileInput?.defaultAnswerStyle) },
    { label: 'Tone', complete: hasPassportValue(profileInput?.tone) },
    { label: 'Language preference', complete: hasPassportValue(profileInput?.languagePreference) },
    { label: 'Coding confidence', complete: hasPassportValue(profileInput?.codingConfidence) },
    { label: 'Code instruction style', complete: hasPassportValue(profileInput?.codeInstructionStyle) },
    { label: 'Custom working rules', complete: hasPassportValue(profileInput?.customRules) },
    { label: 'Export inclusion mode', complete: hasPassportValue(profileInput?.mode) },
  ];
  const completedItems = checks.filter((check) => check.complete).length;
  const totalItems = checks.length;
  const completionPercentage = Math.round((completedItems / totalItems) * 100);
  const status = getMemephantPassportStatus(completionPercentage);
  const languagePreference = getFrontalLobeLanguageLabel(profile.languagePreference);
  const answerStyle = FRONTAL_LOBE_ANSWER_STYLE_LABELS[profile.defaultAnswerStyle];
  const tone = FRONTAL_LOBE_TONE_LABELS[profile.tone];
  const pace = FRONTAL_LOBE_PACE_LABELS[profile.preferredPace];
  const exportReadiness = profile.mode === 'off'
    ? 'Export disabled'
    : profile.mode === 'manual_only'
      ? 'Manual only'
      : profile.mode === 'ask_each_time'
        ? 'Ready with confirmation'
        : 'Ready for handoff';
  const privacyStatus = 'Local only, user controlled';
  const fingerprint = [
    languagePreference,
    answerStyle,
    tone,
    pace,
    'Privacy-first',
  ].join(' · ');

  return {
    status,
    completionPercentage,
    completedItems,
    totalItems,
    missingItems: checks.filter((check) => !check.complete).map((check) => check.label),
    workingStyleSummary: `${answerStyle} · ${tone} · ${pace}`,
    languagePreference,
    privacyStatus,
    exportReadiness,
    fingerprint,
    copyText: [
      `Working Style Profile: ${status}`,
      `Completion: ${completionPercentage}%`,
      `Fingerprint: ${fingerprint}`,
      `Language: ${languagePreference}`,
      `Working style: ${answerStyle}, ${tone}, ${pace}`,
      `Privacy: ${privacyStatus}`,
      `Export readiness: ${exportReadiness}`,
    ].join('\n'),
  };
}

export type PersonalMemorySensitivity = 'standard' | 'private' | 'never_share';
export type PersonalMemoryPermission = 'never' | 'ask_each_time' | 'allow';
export type ConsentLedgerAction =
  | 'consent_granted'
  | 'consent_refused'
  | 'consent_revoked'
  | 'permission_updated';
export type ConsentLedgerScope =
  | 'ai_training'
  | 'commercial_licensing'
  | 'platform_sharing'
  | 'memory_export'
  | 'custom';
export type PersonalMemoryEntryCategory =
  | 'owner_profile'
  | 'preference'
  | 'goal'
  | 'rule'
  | 'boundary'
  | 'never_share'
  | 'custom';

export interface PersonalMemoryOwnerProfile {
  displayName?: string;
  role?: string;
  bio?: string;
  locationHint?: string;
}

export interface PersonalMemoryTextEntry {
  id: string;
  label?: string;
  category?: PersonalMemoryEntryCategory;
  value: string;
  sensitivity: PersonalMemorySensitivity;
  updatedAt: string;
}

export interface PersonalMemoryPlatformRule {
  permission: PersonalMemoryPermission;
  allowedCategories: string[];
  deniedCategories: string[];
  updatedAt: string;
}

export interface PersonalMemoryDataLicensingPreferences {
  allowLicensing: boolean;
  requireExplicitConsent: boolean;
  allowedCategories: string[];
  deniedCategories: string[];
  notes?: string;
  updatedAt: string;
}

export interface PersonalMemoryAuditLogEntry {
  id: string;
  timestamp: string;
  action: 'created' | 'updated' | 'deleted' | 'exported' | 'permission_changed';
  summary: string;
  source: 'user' | 'system';
}

export interface ConsentLedgerEvent {
  id: string;
  createdAt: string;
  action: ConsentLedgerAction;
  scope: ConsentLedgerScope;
  correctsEventId?: string;
  platform?: string;
  target?: string;
  allowed: boolean;
  commercialUseAllowed: boolean;
  aiTrainingAllowed: boolean;
  notes?: string;
  receiptText: string;
}

export interface PersonalMemoryVault {
  schemaVersion: typeof PERSONAL_MEMORY_VAULT_SCHEMA_VERSION;
  ownerProfile: PersonalMemoryOwnerProfile;
  preferences: PersonalMemoryTextEntry[];
  workStyle: PersonalMemoryTextEntry[];
  communicationStyle: PersonalMemoryTextEntry[];
  goals: PersonalMemoryTextEntry[];
  skills: PersonalMemoryTextEntry[];
  rules: PersonalMemoryTextEntry[];
  privateNotes: PersonalMemoryTextEntry[];
  neverShare: string[];
  platformPermissions: Partial<Record<Platform, PersonalMemoryPlatformRule>>;
  dataLicensingPreferences: PersonalMemoryDataLicensingPreferences;
  consentLedger: ConsentLedgerEvent[];
  auditLog: PersonalMemoryAuditLogEntry[];
  /** Local-only AI Working Style profile. Never included in project exports. */
  frontalLobeProfile?: FrontalLobeProfile;
  updatedAt: string;
}

function createId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createPersonalMemoryEntry(
  value: string,
  options: {
    id?: string;
    label?: string;
    category?: PersonalMemoryEntryCategory;
    sensitivity?: PersonalMemorySensitivity;
    updatedAt?: string;
  } = {},
): PersonalMemoryTextEntry {
  const updatedAt = options.updatedAt ?? new Date().toISOString();

  return {
    id: options.id ?? createId('pmv_entry'),
    label: options.label,
    category: options.category,
    value,
    sensitivity: options.sensitivity ?? 'private',
    updatedAt,
  };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function formatConsentLedgerLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

export function createConsentLedgerEvent(
  input: {
    id?: string;
    createdAt?: string;
    action: ConsentLedgerAction;
    scope: ConsentLedgerScope;
    platform?: string;
    target?: string;
    commercialUseAllowed?: boolean;
    aiTrainingAllowed?: boolean;
    notes?: string;
    correctsEventId?: string;
  },
): ConsentLedgerEvent {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const allowed = input.action === 'consent_granted' || input.action === 'permission_updated';
  const correctsEventId = normalizeOptionalText(input.correctsEventId);
  const platform = normalizeOptionalText(input.platform);
  const target = normalizeOptionalText(input.target);
  const notes = normalizeOptionalText(input.notes);
  const commercialUseAllowed = allowed ? Boolean(input.commercialUseAllowed) : false;
  const aiTrainingAllowed = allowed ? Boolean(input.aiTrainingAllowed) : false;
  const targetParts = [
    platform ? `platform ${platform}` : null,
    target ? `target ${target}` : null,
  ].filter(Boolean);
  const targetText = targetParts.length ? ` for ${targetParts.join(', ')}` : '';
  const receiptText = [
    `${formatConsentLedgerLabel(input.action)} for ${formatConsentLedgerLabel(input.scope)}${targetText}.`,
    `AI training allowed: ${aiTrainingAllowed ? 'yes' : 'no'}.`,
    `Commercial use allowed: ${commercialUseAllowed ? 'yes' : 'no'}.`,
    notes ? `Notes: ${notes}` : null,
  ].filter(Boolean).join(' ');

  return {
    id: input.id ?? createId('pmv_consent'),
    createdAt,
    action: input.action,
    scope: input.scope,
    correctsEventId,
    platform,
    target,
    allowed,
    commercialUseAllowed,
    aiTrainingAllowed,
    notes,
    receiptText,
  };
}

export function validateConsentLedgerEvent(value: unknown): value is ConsentLedgerEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<ConsentLedgerEvent>;
  const validActions: ConsentLedgerAction[] = [
    'consent_granted',
    'consent_refused',
    'consent_revoked',
    'permission_updated',
  ];
  const validScopes: ConsentLedgerScope[] = [
    'ai_training',
    'commercial_licensing',
    'platform_sharing',
    'memory_export',
    'custom',
  ];

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.createdAt === 'string' &&
    validActions.includes(candidate.action as ConsentLedgerAction) &&
    validScopes.includes(candidate.scope as ConsentLedgerScope) &&
    typeof candidate.allowed === 'boolean' &&
    typeof candidate.commercialUseAllowed === 'boolean' &&
    typeof candidate.aiTrainingAllowed === 'boolean' &&
    typeof candidate.receiptText === 'string' &&
    (candidate.correctsEventId === undefined || typeof candidate.correctsEventId === 'string')
  );
}

export function appendConsentLedgerEvent(
  vault: PersonalMemoryVault,
  event: ConsentLedgerEvent,
): PersonalMemoryVault {
  if (!validateConsentLedgerEvent(event)) {
    return vault;
  }

  if (vault.consentLedger.some((existing) => existing.id === event.id)) {
    return vault;
  }

  return {
    ...vault,
    consentLedger: [...vault.consentLedger, { ...event }],
    updatedAt: event.createdAt,
  };
}

export function mergeAppendOnlyConsentLedger(
  existingEvents: ConsentLedgerEvent[],
  nextEvents: ConsentLedgerEvent[],
): ConsentLedgerEvent[] {
  const existingById = new Map<string, ConsentLedgerEvent>();

  existingEvents.filter(validateConsentLedgerEvent).forEach((event) => {
    if (!existingById.has(event.id)) {
      existingById.set(event.id, { ...event });
    }
  });

  const merged = Array.from(existingById.values());
  const seen = new Set(merged.map((event) => event.id));

  nextEvents.filter(validateConsentLedgerEvent).forEach((event) => {
    if (!seen.has(event.id)) {
      merged.push({ ...event });
      seen.add(event.id);
    }
  });

  return merged;
}

export function createDefaultPersonalMemoryVault(
  now = new Date().toISOString(),
): PersonalMemoryVault {
  return {
    schemaVersion: PERSONAL_MEMORY_VAULT_SCHEMA_VERSION,
    ownerProfile: {},
    preferences: [],
    workStyle: [],
    communicationStyle: [],
    goals: [],
    skills: [],
    rules: [],
    privateNotes: [],
    neverShare: [],
    platformPermissions: {},
    dataLicensingPreferences: {
      allowLicensing: false,
      requireExplicitConsent: true,
      allowedCategories: [],
      deniedCategories: [],
      updatedAt: now,
    },
    consentLedger: [],
    auditLog: [],
    frontalLobeProfile: { ...DEFAULT_FRONTAL_LOBE_PROFILE },
    updatedAt: now,
  };
}

export function normalizePersonalMemoryVault(value: unknown): PersonalMemoryVault | null {
  if (!isPersonalMemoryVault(value)) {
    return null;
  }

  const candidate = value as PersonalMemoryVault & { consentLedger?: unknown };

  return {
    ...candidate,
    consentLedger: Array.isArray(candidate.consentLedger)
      ? candidate.consentLedger.filter(validateConsentLedgerEvent)
      : [],
    // Hydrate frontalLobeProfile from defaults, merging any missing fields for
    // vaults saved before Builder Skill Profile was added in Task 8A, or
    // before FrontalLobeMode was added in Task 8B.
    frontalLobeProfile: candidate.frontalLobeProfile
      ? { ...DEFAULT_FRONTAL_LOBE_PROFILE, ...candidate.frontalLobeProfile }
      : { ...DEFAULT_FRONTAL_LOBE_PROFILE },
  };
}

export function isPersonalMemoryVault(value: unknown): value is PersonalMemoryVault {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PersonalMemoryVault>;

  return (
    candidate.schemaVersion === PERSONAL_MEMORY_VAULT_SCHEMA_VERSION &&
    Array.isArray(candidate.preferences) &&
    Array.isArray(candidate.neverShare) &&
    !!candidate.dataLicensingPreferences &&
    typeof candidate.dataLicensingPreferences.allowLicensing === 'boolean' &&
    typeof candidate.dataLicensingPreferences.requireExplicitConsent === 'boolean'
  );
}
