import type { Platform } from './memphant-types';

export const PERSONAL_MEMORY_VAULT_SCHEMA_VERSION = '0.1.0';

export type PersonalMemorySensitivity = 'standard' | 'private' | 'never_share';
export type PersonalMemoryPermission = 'never' | 'ask_each_time' | 'allow';

export interface PersonalMemoryOwnerProfile {
  displayName?: string;
  role?: string;
  bio?: string;
  locationHint?: string;
}

export interface PersonalMemoryTextEntry {
  id: string;
  label?: string;
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
  auditLog: PersonalMemoryAuditLogEntry[];
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
    sensitivity?: PersonalMemorySensitivity;
    updatedAt?: string;
  } = {},
): PersonalMemoryTextEntry {
  const updatedAt = options.updatedAt ?? new Date().toISOString();

  return {
    id: options.id ?? createId('pmv_entry'),
    label: options.label,
    value,
    sensitivity: options.sensitivity ?? 'private',
    updatedAt,
  };
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
    auditLog: [],
    updatedAt: now,
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
