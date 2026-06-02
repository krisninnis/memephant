import { getRuntimeEnv } from './runtimeEnv';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '');
}

function isUsableWebOrigin(value: string | undefined): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function isTauriWindow(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function isTauriLocalOrigin(origin: string): boolean {
  try {
    return new URL(origin).hostname.toLowerCase() === 'tauri.localhost';
  } catch {
    return false;
  }
}

export function getCurrentWebOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  if (isTauriWindow()) return null;
  const origin = window.location.origin;
  if (isTauriLocalOrigin(origin)) return null;
  return isUsableWebOrigin(origin) ? origin : null;
}

export function getAuthCallbackUrl(): string {
  const currentOrigin = getCurrentWebOrigin();
  if (currentOrigin) {
    return `${trimTrailingSlash(currentOrigin)}/auth/callback`;
  }

  const env = getRuntimeEnv();
  const configuredOrigin = env.VITE_APP_URL || env.VITE_API_URL;
  if (isUsableWebOrigin(configuredOrigin)) {
    return `${trimTrailingSlash(configuredOrigin)}/auth/callback`;
  }

  return 'https://memephant.com/auth/callback';
}
