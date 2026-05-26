export function isDiagnosticLoggingEnabled(): boolean {
  const debugFromWindow =
    typeof window !== 'undefined' &&
    window.__MEMPHANT_ENV__?.VITE_MEMEPHANT_DEBUG_LOGS === 'true';

  const debugFromProcess =
    typeof process !== 'undefined' &&
    (process.env?.NODE_ENV !== 'production' ||
      process.env?.VITE_MEMEPHANT_DEBUG_LOGS === 'true');

  return Boolean(debugFromWindow || debugFromProcess);
}

export function devWarn(...args: unknown[]): void {
  if (isDiagnosticLoggingEnabled()) {
    console.warn(...args);
  }
}

export function devError(...args: unknown[]): void {
  if (isDiagnosticLoggingEnabled()) {
    console.error(...args);
  }
}
