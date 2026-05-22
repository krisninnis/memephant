import type {
  ConsentLedgerAction,
  ConsentLedgerEvent,
  ConsentLedgerScope,
  PersonalMemoryVault,
} from '../types/personalMemoryVault';

export const RECEIPT_INTEGRITY_HASH_LENGTH = 12;
export const RECEIPT_INTEGRITY_HASH_PREFIX = 'Integrity hash (SHA-256, 12 chars): ';

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

// --- Integrity hash helpers --------------------------------------------------
// Tamper-evidence helper only. NOT a digital signature, NOT identity proof,
// NOT legal enforcement. The hash lets a user spot whether the receipt body
// they exported has been changed since export. We ship a small synchronous
// SHA-256 implementation so the receipt can be generated deterministically in
// both the Node-backed jest environment and the Tauri webview without async.

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr32(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function utf8EncodeToBytes(input: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    let c = input.charCodeAt(i);
    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < input.length) {
      const c2 = input.charCodeAt(i + 1);
      if (c2 >= 0xdc00 && c2 <= 0xdfff) {
        i += 1;
        const cp = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
        bytes.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f),
        );
      } else {
        bytes.push(0xef, 0xbf, 0xbd);
      }
    } else {
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return bytes;
}

function sha256HexSync(input: string): string {
  const bytes = utf8EncodeToBytes(input);
  const bitLen = bytes.length * 8;

  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const high = Math.floor(bitLen / 0x100000000);
  const low = bitLen >>> 0;
  bytes.push(
    (high >>> 24) & 0xff,
    (high >>> 16) & 0xff,
    (high >>> 8) & 0xff,
    high & 0xff,
    (low >>> 24) & 0xff,
    (low >>> 16) & 0xff,
    (low >>> 8) & 0xff,
    low & 0xff,
  );

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);

  for (let chunk = 0; chunk < bytes.length; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      const o = chunk + i * 4;
      W[i] =
        ((bytes[o] << 24) |
          (bytes[o + 1] << 16) |
          (bytes[o + 2] << 8) |
          bytes[o + 3]) >>>
        0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr32(W[i - 15], 7) ^ rotr32(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr32(W[i - 2], 17) ^ rotr32(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];
    let f = H[5];
    let g = H[6];
    let h = H[7];

    for (let i = 0; i < 64; i++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA256_K[i] + W[i]) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  let out = '';
  for (let i = 0; i < 8; i++) out += H[i].toString(16).padStart(8, '0');
  return out;
}

export function computeReceiptIntegrityHash(body: string): string {
  return sha256HexSync(body).slice(0, RECEIPT_INTEGRITY_HASH_LENGTH);
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
      if (event.correctsEventId) {
        lines.push(`- Corrects event: ${sanitizeReceiptText(event.correctsEventId)}`);
      }
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
  lines.push('- This receipt does not include Memory Trail data.');
  lines.push('- This receipt does not include Memory Bridge data.');
  lines.push('- This receipt is not synced to cloud by this feature.');
  lines.push('');
  lines.push('## Legal Caution');
  lines.push('This is a local user record, not legal advice or automatic enforcement. It does not automatically bind AI platforms or other third parties.');

  lines.push('');
  lines.push('## Integrity Hash');
  lines.push('This integrity hash is a tamper-evidence helper for the receipt body above. It is not a digital signature, not legal proof, and not identity verification. If the receipt body is edited after export, the hash will no longer match a freshly recomputed hash of the same body.');
  lines.push('');

  const body = lines.join('\n');
  const hash = computeReceiptIntegrityHash(body);
  lines.push(`${RECEIPT_INTEGRITY_HASH_PREFIX}${hash}`);

  return lines.join('\n');
}

export const generateConsentReceiptMarkdown = generateConsentReceipt;
