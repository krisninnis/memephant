import {
  createDefaultPersonalMemoryVault,
  isPersonalMemoryVault,
  type PersonalMemoryVault,
} from '../types/personalMemoryVault';

export const PERSONAL_MEMORY_VAULT_STORAGE_KEY = 'mph_personal_memory_vault_v1';

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage ?? null;
}

export function loadPersonalMemoryVault(): PersonalMemoryVault {
  const storage = getLocalStorage();
  if (!storage) {
    return createDefaultPersonalMemoryVault();
  }

  try {
    const raw = storage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    if (!raw) {
      return createDefaultPersonalMemoryVault();
    }

    const parsed = JSON.parse(raw) as unknown;
    if (isPersonalMemoryVault(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn('[Memephant] Failed to load Personal Memory Vault:', err);
  }

  return createDefaultPersonalMemoryVault();
}

export function savePersonalMemoryVault(vault: PersonalMemoryVault): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  storage.setItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY, JSON.stringify(vault));
}

export function clearPersonalMemoryVault(): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
}
