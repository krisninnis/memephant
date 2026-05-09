import type {
  ConsentLedgerAction,
  ConsentLedgerEvent,
  ConsentLedgerScope,
  PersonalMemoryVault,
} from '../types/personalMemoryVault';

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9]{20,}/g,
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /ghp_[A-Za-z0-9]{36}/g,
  /github_pat_[A-Za-z0-9_]{82}/g,
  /xoxb-[A-Za-z0-9-]+/g,
  /xoxp-[A-Za-z0-9-]+/g,
  /sk_live_[A-Za-z0-9]{24,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /hf_[A-Za-z0-9]{30,}/g,
  /-----BEGIN [A-Z ]+ KEY-----/g,
  /eyJ[A-Za-z0-9+/=]{20,}/g,
  /password\s*[=:]\s*\S+/gi,
  /secret\s*[=:]\s*\S+/gi,
  /token\s*[=:]\s*["']?[A-Za-z0-9_-]{20,}["']?/gi,
  /api[_-]?key\s*[=:]\s*["']?[A-Za-z0-9_-]{16,}["']?/gi,
];

const LOCAL_PATH_PATTERNS: RegExp[] = [
  /[A-Za-z]:\\(?:[^\\\r\n:*?"<>|]+\\)*[^\\\r\n:*?"<>|]*/g,
  /\/Users\/[^\s)'"`]+/g,
  /\/home\/[^\s)'"`]+/g,
];

function sanitizeReceiptText(text: string): string {
  let out = text;

  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }

  for (const pattern of LOCAL_PATH_PATTERNS) {
    out = out.replace(pattern, '[REDACTED_PATH]');
  }

  return out.trim();
}

function formatLabel(value: ConsentLedgerAction | ConsentLedgerScope): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getConsentStatus(event: ConsentLedgerEvent): string {
  if (event.action === 'consent_revoked') return 'Revoked';
  if (event.action === 'consent_refused') return 'Refused';
  return event.allowed ? 'Allowed' : 'Off';
}

function countVaultEntries(vault: PersonalMemoryVault): number {
  return (
    vault.preferences.length +
    vault.workStyle.length +
    vault.communicationStyle.length +
    vault.goals.length +
    vault.skills.length +
    vault.rules.length +
    vault.privateNotes.length
  );
}

function getEntryCategoryCounts(vault: PersonalMemoryVault): Array<[string, number]> {
  return [
    ['Owner profile fields', Object.values(vault.ownerProfile).filter(Boolean).length],
    ['Preferences', vault.preferences.length],
    ['Work style', vault.workStyle.length],
    ['Communication style', vault.communicationStyle.length],
    ['Goals', vault.goals.length],
    ['Skills', vault.skills.length],
    ['Rules', vault.rules.length],
    ['Private notes', vault.privateNotes.length],
  ];
}

function getCurrentPermissionState(vault: PersonalMemoryVault): {
  sharing: string;
  aiTraining: string;
  commercialLicensing: string;
} {
  const latestSharing = [...vault.consentLedger]
    .reverse()
    .find((event) => event.scope === 'platform_sharing' || event.scope === 'memory_export');
  const latestAiTraining = [...vault.consentLedger]
    .reverse()
    .find((event) => event.scope === 'ai_training');
  const latestCommercial = [...vault.consentLedger]
    .reverse()
    .find((event) => event.scope === 'commercial_licensing');

  return {
    sharing: latestSharing?.allowed ? 'Allowed by latest local ledger event' : 'Off unless explicitly enabled',
    aiTraining: latestAiTraining?.aiTrainingAllowed ? 'Allowed by latest local ledger event' : 'Off unless explicitly enabled',
    commercialLicensing:
      latestCommercial?.commercialUseAllowed || vault.dataLicensingPreferences.allowLicensing
        ? 'Allowed by latest local ledger event'
        : 'Disabled unless explicitly enabled',
  };
}

export function generateConsentReceipt(
  vault: PersonalMemoryVault,
  generatedAt = new Date().toISOString(),
): string {
  const permissionState = getCurrentPermissionState(vault);
  const totalEvents = vault.consentLedger.length;
  const allowedEvents = vault.consentLedger.filter((event) => event.allowed).length;
  const refusedEvents = vault.consentLedger.filter((event) => event.action === 'consent_refused').length;
  const revokedEvents = vault.consentLedger.filter((event) => event.action === 'consent_revoked').length;
  const lines: string[] = [];

  lines.push('# Memephant Personal Memory Vault - Consent Receipt');
  lines.push('');
  lines.push(`Generated: ${sanitizeReceiptText(generatedAt)}`);
  lines.push(`Vault schema: ${sanitizeReceiptText(vault.schemaVersion)}`);
  lines.push('');
  lines.push('## Local-Only Disclaimer');
  lines.push('This receipt is a local user-owned record generated from Memephant Personal Memory Vault consent choices. It is stored locally, not legal advice, and not automatic enforcement. Platforms are not automatically bound by this receipt unless they separately agree to or respect it.');
  lines.push('');
  lines.push('## Vault Summary');
  lines.push(`- Private entries: ${countVaultEntries(vault)}`);
  lines.push(`- Never-share items: ${vault.neverShare.length}`);
  lines.push(`- Consent ledger events: ${totalEvents}`);
  lines.push('');
  lines.push('## Memory Counts By Category');
  getEntryCategoryCounts(vault).forEach(([label, count]) => {
    lines.push(`- ${label}: ${count}`);
  });
  lines.push('');
  lines.push('## Current Permission State');
  lines.push(`- Sharing permissions: ${permissionState.sharing}`);
  lines.push(`- AI training permission: ${permissionState.aiTraining}`);
  lines.push(`- Commercial licensing permission: ${permissionState.commercialLicensing}`);
  lines.push('- Local-only/cloud status: Local only. This feature does not sync the receipt to cloud.');
  lines.push('');
  lines.push('## Consent Ledger History');

  if (vault.consentLedger.length === 0) {
    lines.push('No consent events recorded yet.');
  } else {
    vault.consentLedger.forEach((event, index) => {
      lines.push('');
      lines.push(`### Event ${index + 1}`);
      lines.push(`- Timestamp: ${sanitizeReceiptText(event.createdAt)}`);
      lines.push(`- Action: ${formatLabel(event.action)}`);
      lines.push(`- Scope: ${formatLabel(event.scope)}`);
      lines.push(`- Status: ${getConsentStatus(event)}`);
      lines.push(`- AI training allowed: ${event.aiTrainingAllowed ? 'yes' : 'no'}`);
      lines.push(`- Commercial use allowed: ${event.commercialUseAllowed ? 'yes' : 'no'}`);
      if (event.platform) lines.push(`- Platform: ${sanitizeReceiptText(event.platform)}`);
      if (event.target) lines.push(`- Target: ${sanitizeReceiptText(event.target)}`);
      if (event.receiptText.trim()) {
        lines.push(`- Receipt text: ${sanitizeReceiptText(event.receiptText)}`);
      }
    });
  }

  lines.push('');
  lines.push('## Summary');
  lines.push(`- Total events: ${totalEvents}`);
  lines.push(`- Allowed events: ${allowedEvents}`);
  lines.push(`- Refused events: ${refusedEvents}`);
  lines.push(`- Revoked events: ${revokedEvents}`);
  lines.push('');
  lines.push('## Redaction Note');
  lines.push('This receipt does not include private memory entry contents.');
  lines.push('');
  lines.push('## Privacy Boundary');
  lines.push('- This receipt does not include project memory.');
  lines.push('- This receipt does not include project exports.');
  lines.push('- This receipt does not include Context Passport data.');
  lines.push('- This receipt does not include Memory Bridge data.');
  lines.push('- This receipt is not synced to cloud by this feature.');
  lines.push('');
  lines.push('## Legal Caution');
  lines.push('This is a local user record, not legal advice or automatic enforcement. It does not automatically bind AI platforms or other third parties.');

  return lines.join('\n');
}

export const generateConsentReceiptMarkdown = generateConsentReceipt;
