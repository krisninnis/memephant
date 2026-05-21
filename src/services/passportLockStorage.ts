export const PASSPORT_LOCK_STORAGE_KEY = 'mph_passport_lock_v1';

export type PassportLockRecord = {
  schemaVersion: 'memephant.passportLock.v1';
  enabled: boolean;
  salt?: string;
  pinVerifier?: string;
  kdf?: 'PBKDF2-SHA256';
  iterations?: number;
  createdAt?: string;
  updatedAt?: string;
};

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function loadPassportLockRecord(): PassportLockRecord | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(PASSPORT_LOCK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PassportLockRecord>;
    if (parsed.schemaVersion !== 'memephant.passportLock.v1') return null;
    return {
      schemaVersion: 'memephant.passportLock.v1',
      enabled: Boolean(parsed.enabled),
      salt: parsed.salt,
      pinVerifier: parsed.pinVerifier,
      kdf: parsed.kdf,
      iterations: parsed.iterations,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

export function isPassportLockEnabled(): boolean {
  return loadPassportLockRecord()?.enabled === true;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function derivePasscodeVerifier(
  passcode: string,
  salt: string,
  iterations: number,
): Promise<string> {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error('Web Crypto is unavailable');
  }

  const encoder = new TextEncoder();
  const key = await cryptoApi.subtle.importKey(
    'raw',
    encoder.encode(passcode),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await cryptoApi.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(salt),
      iterations,
    },
    key,
    256,
  );
  return toHex(bits);
}

export async function verifyPassportPasscode(passcode: string): Promise<boolean> {
  const record = loadPassportLockRecord();
  if (!record?.enabled) return true;
  if (!record.salt || !record.pinVerifier) return false;

  const verifier = await derivePasscodeVerifier(
    passcode,
    record.salt,
    record.iterations ?? 210_000,
  );

  return verifier === record.pinVerifier;
}
