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

export interface FrontalLobeProfile {
  defaultAnswerStyle: FrontalLobeAnswerStyle;
  challengeLevel: FrontalLobeChallengeLevel;
  codeReviewStrictness: FrontalLobeCodeReviewStrictness;
  explanationDepth: FrontalLobeExplanationDepth;
  tone: FrontalLobeTone;
  customRules: string[];
  updatedAt?: string;
}

export const DEFAULT_FRONTAL_LOBE_PROFILE: FrontalLobeProfile = {
  defaultAnswerStyle: 'balanced_builder',
  challengeLevel: 'balanced',
  codeReviewStrictness: 'normal',
  explanationDepth: 'explain_why',
  tone: 'balanced',
  customRules: [],
};

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
   