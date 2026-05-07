/**
 * Cloud sync service — Supabase backend.
 *
 * Strategy:
 *  - Push: after every local save, upsert the project to Supabase.
 *  - Pull: on login / app open, fetch all remote projects and merge.
 *  - Conflict resolution: last-write-wins by `updatedAt`.
 *
 * Auth strategy (important):
 *  - We prefer cached identity / known user IDs for sync paths whenever the
 *    app already has a confirmed signed-in user in state.
 *  - getSession() can trigger token refresh work internally and may hang.
 *    We wrap it in a short timeout.
 *  - getUser() makes a live network call to /auth/v1/user and CAN hang
 *    indefinitely if the auth server is slow. We only call it as a fallback
 *    with an explicit 5-second timeout.
 *  - For sync operations, RLS policies enforce row-level security regardless,
 *    so the cached session user is safe to use.
 */

import { supabase, supabaseClientInstanceId } from './supabaseClient';
import type { ProjectMemory } from '../types/memphant-types';
import type { SubscriptionTier, SubscriptionStatus } from '../store/projectStore';
import { enqueue, dequeue, getAll as getQueued } from './syncQueue';
import { getRuntimeEnv } from '../utils/runtimeEnv';

// ─── Types ────────────────────────────────────────────────────────────────────

function getSupabase() {
  if (!supabase) {
    throw new Error('Supabase client not initialised');
  }
  return supabase;
}

type CloudSyncStage =
  | 'auth'
  | 'queue'
  | 'push'
  | 'pull'
  | 'subscription'
  | 'cycle';

type SyncReason = 'manual' | 'signin' | 'startup' | 'autosave' | 'unknown';

const SUPABASE_WRITE_TIMEOUT_MS = 15000;
const SUBSCRIPTION_FETCH_TIMEOUT_MS = 6000;

// signOut() makes a live network call. Cap it so logout can never hang the UI.
const LOGOUT_SIGNOUT_TIMEOUT_MS = 5000;

const PROJECTS_TABLE = 'projects';
const PROJECTS_ON_CONFLICT = 'user_id,project_id';
const PROJECTS_EXPECTED_KEYS = ['user_id', 'project_id', 'name', 'data', 'updated_at'] as const;

type ProjectRow = {
  user_id: string;
  project_id: string;
  name: string;
  data: Record<string, unknown>;
  updated_at: string;
};

interface SyncLogMeta {
  reason?: SyncReason;
  requestId?: string;
  [key: string]: unknown;
}

interface SupabaseErrorShape {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  name?: string;
}

interface AuthUserResult {
  user: { id: string; email?: string | null } | null;
  requestId: string;
}

// ─── In-flight dedup ──────────────────────────────────────────────────────────

// Prevents concurrent sync cycles from stepping on each other.
let syncCycleInFlight: Promise<{ merged: ProjectMemory[]; changed: boolean; conflicts: string[] }> | null = null;
let authLookupInFlight: Promise<AuthUserResult> | null = null;
let authLookupOwnerRequestId: string | null = null;
let authLookupWaiterCount = 0;
const subscriptionLookupInFlight = new Map<string, Promise<SubscriptionInfo>>();
let cloudConnectionGeneration = 0;
let cloudDisconnectInProgress = false;

// Supabase auth/session operations can fight over the internal auth-token lock
// if we allow them to overlap (getSession/getUser/refreshSession/signOut/etc).
// Serialize them through one shared queue.
let authOpQueue: Promise<void> = Promise.resolve();

type CloudSyncEnv = {
  VITE_APP_URL?: string;
  VITE_API_URL?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

// ─── Auth callback URL ────────────────────────────────────────────────────────

const cloudSyncEnv = getRuntimeEnv() as CloudSyncEnv;
const AUTH_CALLBACK_URL = cloudSyncEnv.VITE_APP_URL
  ? `${cloudSyncEnv.VITE_APP_URL}/auth/callback`
  : cloudSyncEnv.VITE_API_URL
    ? `${cloudSyncEnv.VITE_API_URL}/auth/callback`
    : 'https://memephant.com/auth/callback';

// ─── Utilities ────────────────────────────────────────────────────────────────

function nextRequestId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeTimeoutError(label: string, timeoutMs: number): Error {
  const err = new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)} s`);
  err.name = 'TimeoutError';
  return err;
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

function normalizeError(err: unknown): SupabaseErrorShape {
  if (!err || typeof err !== 'object') {
    return { message: String(err) };
  }

  const candidate = err as SupabaseErrorShape;

  return {
    name: candidate.name,
    code: candidate.code,
    message: candidate.message ?? String(err),
    details: candidate.details,
    hint: candidate.hint,
  };
}

function classifyError(
  err: unknown,
): 'auth_failure' | 'network_failure' | 'timeout' | 'rls_or_database_rejection' {
  const normalized = normalizeError(err);
  const message = (normalized.message ?? '').toLowerCase();
  const code = (normalized.code ?? '').toLowerCase();
  const name = (normalized.name ?? '').toLowerCase();

  if (name.includes('timeout') || message.includes('timed out') || message.includes('timeout')) {
    return 'timeout';
  }

  if (
    message.includes('not signed in') ||
    message.includes('session') ||
    code.startsWith('auth')
  ) {
    return 'auth_failure';
  }

  if (normalized.code || normalized.details || normalized.hint) {
    return 'rls_or_database_rejection';
  }

  return 'network_failure';
}

function logSync(stage: CloudSyncStage, event: string, meta: SyncLogMeta = {}): void {
  console.warn(`[CloudSync][${stage}] ${event}`, meta);
}

function logSyncError(
  stage: CloudSyncStage,
  event: string,
  err: unknown,
  meta: SyncLogMeta = {},
): void {
  console.error(`[CloudSync][${stage}] ${event}`, {
    ...meta,
    kind: classifyError(err),
    error: normalizeError(err),
  });
}

async function runExclusiveAuthOp<T>(
  stage: CloudSyncStage,
  event: string,
  fn: () => Promise<T>,
  meta: SyncLogMeta = {},
): Promise<T> {
  const previous = authOpQueue.catch(() => undefined);

  let release!: () => void;
  authOpQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;

  logSync(stage, `${event}_exclusive_start`, meta);

  try {
    return await fn();
  } finally {
    release();
    logSync(stage, `${event}_exclusive_end`, meta);
  }
}

function estimateChars(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? 0;
  } catch {
    return -1;
  }
}

function summarizeLargeDataShape(
  value: unknown,
  path = 'data',
  findings: string[] = [],
): string[] {
  if (findings.length >= 6) return findings;

  if (typeof value === 'string') {
    if (value.length > 50_000) findings.push(`${path}:string(${value.length})`);
    return findings;
  }

  if (Array.isArray(value)) {
    if (value.length > 250) findings.push(`${path}:array(${value.length})`);

    for (let i = 0; i < Math.min(value.length, 5); i++) {
      summarizeLargeDataShape(value[i], `${path}[${i}]`, findings);
      if (findings.length >= 6) break;
    }

    return findings;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 100) findings.push(`${path}:objectKeys(${entries.length})`);

    for (const [key, nested] of entries.slice(0, 8)) {
      summarizeLargeDataShape(nested, `${path}.${key}`, findings);
      if (findings.length >= 6) break;
    }
  }

  return findings;
}

function summarizeProjectRows(rows: ProjectRow[]): SyncLogMeta {
  const first = rows[0];
  const keys = first ? Object.keys(first).sort() : [];
  const expectedKeys = [...PROJECTS_EXPECTED_KEYS].sort();
  const unexpectedKeys = keys.filter((key) => !expectedKeys.includes(key as typeof PROJECTS_EXPECTED_KEYS[number]));
  const missingKeys = expectedKeys.filter((key) => !keys.includes(key));
  const payloadChars = estimateChars(rows);
  const payloadBytes = payloadChars >= 0 ? new Blob([JSON.stringify(rows)]).size : -1;
  const firstDataKeys =
    first?.data && typeof first.data === 'object'
      ? Object.keys(first.data).sort().slice(0, 20)
      : [];

  return {
    table: PROJECTS_TABLE,
    onConflict: PROJECTS_ON_CONFLICT,
    recordCount: rows.length,
    payloadChars,
    payloadBytes,
    firstRecordKeys: keys,
    firstDataKeys,
    missingKeys,
    unexpectedKeys,
    firstProjectId: first?.project_id ?? null,
    largeDataFindings: first ? summarizeLargeDataShape(first.data) : [],
  };
}

/**
 * Run a Supabase write request with a hard deadline.
 *
 * Important:
 *  - Passing .abortSignal(signal) to Supabase is necessary but not sufficient.
 *  - If Supabase/fetch fails to settle after abort, awaiting the query can still
 *    hang forever.
 *
 * This wrapper does both:
 *  1. aborts the HTTP request on timeout;
 *  2. rejects the caller on timeout even if the underlying query never settles.
 */
async function withSupabaseWriteTimeout<T>(
  requestFactory: (signal: AbortSignal) => PromiseLike<T>,
  eventBase: 'request' | 'batch',
  meta: SyncLogMeta = {},
  timeoutMs = SUPABASE_WRITE_TIMEOUT_MS,
): Promise<T> {
  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;

  logSync('push', `${eventBase}_factory_created`, {
    ...meta,
    timeoutMs,
  });

  let timeoutId: number | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      timedOut = true;

      const timeoutErr = makeTimeoutError('Cloud write', timeoutMs);

      logSync('push', `${eventBase}_timeout`, {
        ...meta,
        timeoutMs,
        durationMs: Date.now() - startedAt,
      });

      try {
        controller.abort();
      } catch {
        // Very old runtimes may throw here. The explicit reject below still
        // protects the UI from hanging.
      }

      reject(timeoutErr);
    }, timeoutMs);
  });

  try {
    logSync('push', `${eventBase}_factory_invoked`, {
      ...meta,
      signalAlreadyAborted: controller.signal.aborted,
    });

    const requestLike = requestFactory(controller.signal);

    logSync('push', `${eventBase}_query_builder_created`, {
      ...meta,
      hasThen: Boolean(requestLike && typeof (requestLike as { then?: unknown }).then === 'function'),
    });

    logSync('push', `${eventBase}_query_execution_started`, {
      ...meta,
    });

    const requestPromise = Promise.resolve(requestLike);

    void requestPromise.then(
      () => {
        if (timedOut) {
          logSync('push', `${eventBase}_late_response_ignored`, {
            ...meta,
            durationMs: Date.now() - startedAt,
          });
        }
      },
      (lateErr) => {
        if (timedOut || isAbortError(lateErr)) {
          logSyncError('push', `${eventBase}_late_rejection_ignored`, lateErr, {
            ...meta,
            durationMs: Date.now() - startedAt,
          });
        }
      },
    );

    const result = await Promise.race([requestPromise, timeoutPromise]);

    if (timeoutId !== null) window.clearTimeout(timeoutId);

    logSync('push', `${eventBase}_response_received`, {
      ...meta,
      durationMs: Date.now() - startedAt,
    });

    return result;
  } catch (err) {
    if (timeoutId !== null) window.clearTimeout(timeoutId);

    if (timedOut || isAbortError(err)) {
      const timeoutErr = makeTimeoutError('Cloud write', timeoutMs);

      logSyncError('push', `${eventBase}_promise_unresolved`, timeoutErr, {
        ...meta,
        durationMs: Date.now() - startedAt,
      });

      throw timeoutErr;
    }

    logSyncError('push', `${eventBase}_promise_rejected`, err, {
      ...meta,
      durationMs: Date.now() - startedAt,
    });

    throw err;
  }
}

// ─── Supabase reachability check ─────────────────────────────────────────────

/**
 * Ping the Supabase REST metadata endpoint with a 5-second deadline.
 *
 * Returns 'ok' | 'paused' | 'unreachable'.
 *
 * Note: a 401/403 still means Supabase is reachable. Browser DevTools may show
 * that request as red, but the app treats it as "server is awake".
 */
async function checkSupabaseReachable(
  projectUrl: string,
  anonKey: string,
): Promise<'ok' | 'paused' | 'unreachable'> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${projectUrl}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      signal: controller.signal,
    });

    window.clearTimeout(timeoutId);

    // 2xx or 4xx = Supabase is up.
    // 4xx means "alive but request not allowed", which is fine for health.
    return res.status < 500 ? 'ok' : 'unreachable';
  } catch (err) {
    window.clearTimeout(timeoutId);

    const isAbort = isAbortError(err);

    logSync('push', 'health_check_result', {
      reachable: false,
      isAbort,
      error: err instanceof Error ? err.message : String(err),
    });

    return isAbort ? 'paused' : 'unreachable';
  }
}

let lastHealthCheckAt = 0;
let lastHealthResult: 'ok' | 'paused' | 'unreachable' | null = null;
const HEALTH_CHECK_CACHE_MS = 30_000;

async function ensureSupabaseReachable(): Promise<void> {
  const url = cloudSyncEnv.VITE_SUPABASE_URL;
  const key = cloudSyncEnv.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) return;

  const now = Date.now();
  if (lastHealthResult === 'ok' && now - lastHealthCheckAt < HEALTH_CHECK_CACHE_MS) {
    return;
  }

  logSync('push', 'health_check_start', { url });

  const result = await checkSupabaseReachable(url, key);

  lastHealthCheckAt = Date.now();
  lastHealthResult = result;

  logSync('push', 'health_check_result', { result });

  if (result === 'paused') {
    throw new Error(
      'Supabase is not responding (project may be paused on free tier). ' +
      'Visit supabase.com/dashboard → your project → Resume to wake it up.',
    );
  }

  if (result === 'unreachable') {
    throw new Error('Cannot reach Supabase — check your internet connection.');
  }
}

// ─── Direct REST write path for autosave ──────────────────────────────────────

function getCachedSupabaseAccessToken(): string | null {
  if (typeof window === 'undefined') return null;

  const readFromStorage = (storage: Storage | undefined): string | null => {
    if (!storage) return null;

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;

      const looksLikeSupabaseAuthKey =
        key.startsWith('sb-') ||
        key.startsWith('supabase.auth.') ||
        key.includes('auth-token') ||
        key.includes('gotrue');

      if (!looksLikeSupabaseAuthKey) continue;

      const raw = storage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw) as {
          access_token?: unknown;
          currentSession?: { access_token?: unknown };
          session?: { access_token?: unknown };
        };

        if (typeof parsed.access_token === 'string') {
          return parsed.access_token;
        }

        if (typeof parsed.currentSession?.access_token === 'string') {
          return parsed.currentSession.access_token;
        }

        if (typeof parsed.session?.access_token === 'string') {
          return parsed.session.access_token;
        }
      } catch {
        // Ignore non-JSON storage values.
      }
    }

    return null;
  };

  return readFromStorage(window.localStorage) ?? readFromStorage(window.sessionStorage);
}

function makeSupabaseRestError(
  response: Response,
  bodyText: string,
): SupabaseErrorShape {
  try {
    const parsed = JSON.parse(bodyText) as SupabaseErrorShape;

    return {
      code: parsed.code ?? String(response.status),
      message: parsed.message ?? response.statusText,
      details: parsed.details,
      hint: parsed.hint,
      name: 'SupabaseRestError',
    };
  } catch {
    return {
      code: String(response.status),
      message: bodyText || response.statusText,
      name: 'SupabaseRestError',
    };
  }
}

async function upsertProjectRowsDirect(
  rows: ProjectRow[],
  eventBase: 'request' | 'batch',
  meta: SyncLogMeta = {},
  timeoutMs = SUPABASE_WRITE_TIMEOUT_MS,
): Promise<void> {
  const projectUrl = cloudSyncEnv.VITE_SUPABASE_URL;
  const anonKey = cloudSyncEnv.VITE_SUPABASE_ANON_KEY;
  const accessToken = getCachedSupabaseAccessToken();

  if (!projectUrl || !anonKey) {
    throw new Error('Supabase REST configuration is missing.');
  }

  if (!accessToken) {
    throw new Error('Cloud access token unavailable. Will retry after session refresh.');
  }

  const endpoint = new URL(`${projectUrl}/rest/v1/${PROJECTS_TABLE}`);
  endpoint.searchParams.set('on_conflict', PROJECTS_ON_CONFLICT);

  logSync('push', `${eventBase}_direct_rest_start`, {
    ...meta,
    rowCount: rows.length,
    payloadBytes: new Blob([JSON.stringify(rows)]).size,
  });

  const response = await withSupabaseWriteTimeout<Response>(
    (signal) =>
      fetch(endpoint.toString(), {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(rows),
        signal,
      }),
    eventBase,
    {
      ...meta,
      directRest: true,
    },
    timeoutMs,
  );

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    const errorShape = makeSupabaseRestError(response, bodyText);

    logSyncError('push', `${eventBase}_direct_rest_failed`, errorShape, {
      ...meta,
      status: response.status,
    });

    const err = new Error(errorShape.message ?? 'Supabase REST write failed') as Error & SupabaseErrorShape;
    err.name = errorShape.name ?? 'SupabaseRestError';
    err.code = errorShape.code;
    err.details = errorShape.details;
    err.hint = errorShape.hint;

    throw err;
  }

  logSync('push', `${eventBase}_direct_rest_success`, {
    ...meta,
    status: response.status,
  });
}

// ─── Session pre-warm ─────────────────────────────────────────────────────────

/**
 * Ensure the Supabase JWT is fresh before full sync cycles.
 *
 * IMPORTANT AUTOSAVE RULE:
 *   Do not call this from autosave.
 *
 * Reason:
 *   refreshSession()/getSession() can hold Supabase's internal auth lock if
 *   refresh work hangs. If autosave starts that work right before an upsert,
 *   the upsert can hang at query execution. Autosave should use the existing
 *   client session and let RLS/HTTP failure decide whether to queue.
 */
const SESSION_EXPIRY_BUFFER_SEC = 120;

async function ensureSessionFresh(reason: SyncReason): Promise<void> {
  if (!supabase) return;

  if (reason === 'autosave') {
    logSync('push', 'session_preflight_skipped_autosave', {
      reason,
      why: 'Avoid auth refresh lock during autosave writes',
    });
    return;
  }

  await runExclusiveAuthOp('auth', 'ensure_session_fresh', async () => {
    let shouldRefresh = false;

    try {
      const sb = getSupabase();

      const { data } = await Promise.race([
        sb.auth.getSession(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('session quick-check timed out')), 750),
        ),
      ]);

      const exp = data?.session?.expires_at ?? 0;
      const nowSec = Math.floor(Date.now() / 1000);
      const secsLeft = exp - nowSec;

      if (exp === 0 || secsLeft < SESSION_EXPIRY_BUFFER_SEC) {
        shouldRefresh = true;
        logSync('push', 'session_stale', { reason, secsLeft });
      } else {
        logSync('push', 'session_fresh', { reason, secsLeft });
        return;
      }
    } catch (err) {
      shouldRefresh = true;
      logSyncError('push', 'session_check_timed_out', err, { reason });
    }

    if (!shouldRefresh) return;

    logSync('push', 'session_refresh_start', { reason });

    try {
      const sb = getSupabase();

      const { data, error } = await Promise.race([
        sb.auth.refreshSession(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('session refresh timed out after 6 s')), 6000),
        ),
      ]);

      if (error) {
        logSyncError('push', 'session_refresh_error', error, { reason });
      } else {
        const newExp = data.session?.expires_at ?? 0;
        logSync('push', 'session_refresh_success', {
          reason,
          newSecsLeft: newExp - Math.floor(Date.now() / 1000),
        });
      }
    } catch (err) {
      logSyncError('push', 'session_refresh_failed', err, { reason });
    }
  }, { reason });
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 4,
  baseDelayMs = 500,
  shouldRetry?: (attempt: number, err: unknown) => boolean,
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      if (shouldRetry && !shouldRetry(attempt, err)) {
        throw err;
      }

      if (attempt < maxAttempts - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;
        await new Promise((res) => setTimeout(res, delay));
      }
    }
  }

  throw lastErr;
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthUser(reason: SyncReason, source: CloudSyncStage): Promise<AuthUserResult> {
  const requestId = nextRequestId(source);

  if (!supabase) {
    logSync(source, 'auth_skipped_no_supabase', { reason, requestId });
    return { user: null, requestId };
  }

  if (authLookupInFlight) {
    authLookupWaiterCount += 1;

    logSync(source, 'auth_check_join_inflight', {
      reason,
      requestId,
      ownerRequestId: authLookupOwnerRequestId,
      waiterCount: authLookupWaiterCount,
      clientInstanceId: supabaseClientInstanceId,
    });

    return authLookupInFlight;
  }

  authLookupOwnerRequestId = requestId;
  authLookupWaiterCount = 0;

  authLookupInFlight = runExclusiveAuthOp(source, 'get_auth_user', async () => {
    logSync(source, 'auth_check_start', {
      reason,
      requestId,
      method: 'getSession_first',
      clientInstanceId: supabaseClientInstanceId,
      anotherAuthInFlight: false,
    });

    try {
      const t0 = Date.now();

      const sessionTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('getSession timed out — token refresh may be hanging')),
          3000,
        ),
      );

      const sb = getSupabase();

      const { data: sessionData, error: sessionError } = await Promise.race([
        sb.auth.getSession(),
        sessionTimeoutPromise,
      ]);

      const sessionMs = Date.now() - t0;

      if (sessionError) {
        logSyncError(source, 'auth_session_error', sessionError, { reason, requestId, sessionMs });
      } else if (sessionData.session?.user) {
        const sessionUser = sessionData.session.user;

        const expiry = sessionData.session.expires_at ?? 0;
        const nowSec = Math.floor(Date.now() / 1000);
        const isExpired = expiry > 0 && nowSec > expiry;

        if (!isExpired) {
          logSync(source, 'auth_check_success', {
            reason,
            requestId,
            sessionMs,
            method: 'session_cache',
            userId: sessionUser.id,
            expiresIn: expiry - nowSec,
          });

          return { user: sessionUser, requestId };
        }

        logSync(source, 'auth_session_expired', {
          reason,
          requestId,
          sessionMs,
          expiredSecondsAgo: nowSec - expiry,
        });
      } else {
        logSync(source, 'auth_session_empty', { reason, requestId, sessionMs });
      }
    } catch (sessionErr) {
      logSyncError(source, 'auth_session_exception', sessionErr, { reason, requestId });
    }

    logSync(source, 'auth_getuser_start', { reason, requestId });

    try {
      const sb = getSupabase();

      const getUserPromise = sb.auth.getUser();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Auth getUser timed out after 5 s — token refresh may be stuck')),
          5000,
        ),
      );

      const t1 = Date.now();
      const { data, error } = await Promise.race([getUserPromise, timeoutPromise]);
      const getUserMs = Date.now() - t1;

      if (error) {
        logSyncError(source, 'auth_getuser_failed', error, { reason, requestId, getUserMs });
        throw new Error(error.message);
      }

      logSync(source, 'auth_check_success', {
        reason,
        requestId,
        getUserMs,
        method: 'getUser_network',
        hasUser: Boolean(data.user),
        userId: data.user?.id ?? null,
      });

      return { user: data.user, requestId };
    } catch (err) {
      logSyncError(source, 'auth_check_exception', err, { reason, requestId });
      throw err;
    }
  }, { reason, requestId }).finally(() => {
    logSync(source, 'auth_check_settled', {
      reason,
      requestId,
      waiterCount: authLookupWaiterCount,
      clientInstanceId: supabaseClientInstanceId,
    });

    authLookupInFlight = null;
    authLookupOwnerRequestId = null;
    authLookupWaiterCount = 0;
  });

  return authLookupInFlight;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CloudUser {
  id: string;
  email: string;
}

interface RemoteRow {
  project_id: string;
  name: string;
  data: ProjectMemory;
  updated_at: string;
}

export interface CloudPushResult {
  status: 'disabled' | 'skipped' | 'saved_local' | 'pending' | 'error';
  message?: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string): Promise<CloudUser> {
  if (!supabase) throw new Error('Cloud sync not configured.');

  cloudDisconnectInProgress = false;

  const { data, error } = await runExclusiveAuthOp('auth', 'signin', async () => {
    const sb = getSupabase();
    return sb.auth.signInWithPassword({ email, password });
  });

  if (error) throw new Error(error.message);
  if (!data.user?.email) throw new Error('Sign-in succeeded but no user returned.');

  return { id: data.user.id, email: data.user.email };
}

export async function signUp(email: string, password: string): Promise<CloudUser> {
  if (!supabase) throw new Error('Cloud sync not configured.');

  cloudDisconnectInProgress = false;

  const { data, error } = await runExclusiveAuthOp('auth', 'signup', async () => {
    const sb = getSupabase();

    return sb.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: AUTH_CALLBACK_URL },
    });
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Sign-up succeeded but no user returned.');

  return { id: data.user.id, email: data.user.email ?? email };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;

  const { error } = await runExclusiveAuthOp('auth', 'signout', async () => {
    const sb = getSupabase();
    return sb.auth.signOut({ scope: 'global' });
  });

  if (error) throw new Error(error.message);
}

function clearSupabaseAuthStorage(): { clearedKeys: string[] } {
  const clearedKeys = new Set<string>();

  const shouldClearKey = (key: string): boolean =>
    key.startsWith('sb-') ||
    key.startsWith('supabase.auth.') ||
    key.includes('.auth.token') ||
    key.includes('.auth.refreshToken') ||
    key.includes('.auth.expiresAt') ||
    key.includes('gotrue');

  const clearFromStorage = (storage: Storage | undefined) => {
    if (!storage) return;

    const keysToRemove: string[] = [];

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && shouldClearKey(key)) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      storage.removeItem(key);
      clearedKeys.add(key);
    }
  };

  if (typeof window !== 'undefined') {
    clearFromStorage(window.localStorage);
    clearFromStorage(window.sessionStorage);
    void clearSupabaseIndexedDB();
  }

  return { clearedKeys: Array.from(clearedKeys).sort() };
}

async function clearSupabaseIndexedDB(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  try {
    if (typeof indexedDB.databases === 'function') {
      const dbs = await indexedDB.databases();

      for (const db of dbs) {
        if (db.name && (db.name.startsWith('sb-') || /supabase|gotrue/i.test(db.name))) {
          indexedDB.deleteDatabase(db.name);
        }
      }
    }
  } catch {
    // Silent fail — IndexedDB.databases() not supported everywhere.
  }
}

export async function disconnectCloud(): Promise<{ clearedKeys: string[] }> {
  cloudDisconnectInProgress = true;
  cloudConnectionGeneration += 1;

  logSync('auth', 'disconnect_start', {
    clientInstanceId: supabaseClientInstanceId,
    connectionGeneration: cloudConnectionGeneration,
  });

  try {
    logSync('auth', 'disconnect_complete', {
      clientInstanceId: supabaseClientInstanceId,
      clearedKeys: [],
      connectionGeneration: cloudConnectionGeneration,
    });

    return { clearedKeys: [] };
  } finally {
    cloudDisconnectInProgress = false;
  }
}

export async function logoutCloudAccount(): Promise<{ clearedKeys: string[] }> {
  cloudDisconnectInProgress = true;
  cloudConnectionGeneration += 1;

  logSync('auth', 'logout_start', {
    clientInstanceId: supabaseClientInstanceId,
    connectionGeneration: cloudConnectionGeneration,
  });

  try {
    let signOutError: unknown = null;

    try {
      logSync('auth', 'logout_signout_start', {
        clientInstanceId: supabaseClientInstanceId,
        connectionGeneration: cloudConnectionGeneration,
        timeoutMs: LOGOUT_SIGNOUT_TIMEOUT_MS,
      });

      await Promise.race([
        signOut(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Logout signOut timed out after ${Math.round(LOGOUT_SIGNOUT_TIMEOUT_MS / 1000)} s`)),
            LOGOUT_SIGNOUT_TIMEOUT_MS,
          ),
        ),
      ]);

      logSync('auth', 'logout_signout_success', {
        clientInstanceId: supabaseClientInstanceId,
        connectionGeneration: cloudConnectionGeneration,
      });
    } catch (err) {
      signOutError = err;

      logSyncError('auth', 'logout_signout_error', err, {
        clientInstanceId: supabaseClientInstanceId,
        connectionGeneration: cloudConnectionGeneration,
      });
    }

    const result = clearSupabaseAuthStorage();

    logSync('auth', 'logout_complete', {
      clientInstanceId: supabaseClientInstanceId,
      clearedKeys: result.clearedKeys,
      hadSignOutError: Boolean(signOutError),
      connectionGeneration: cloudConnectionGeneration,
    });

    return result;
  } finally {
    cloudDisconnectInProgress = false;
  }
}

// ─── Timestamp helper ─────────────────────────────────────────────────────────

function localUpdatedAt(project: ProjectMemory): string {
  if (project.updatedAt) return project.updatedAt;
  if (!project.changelog?.length) return '1970-01-01T00:00:00.000Z';

  const sorted = project.changelog.map((entry) => entry.timestamp).sort();
  return sorted[sorted.length - 1] ?? '1970-01-01T00:00:00.000Z';
}

// ─── Push single project ──────────────────────────────────────────────────────

export async function pushProject(
  project: ProjectMemory,
  knownUserId?: string,
): Promise<CloudPushResult> {
  if (!supabase) return { status: 'disabled' };

  const connectionGenerationAtStart = cloudConnectionGeneration;

  let userId: string;
  let requestId: string;

  if (knownUserId) {
    userId = knownUserId;
    requestId = nextRequestId('push');

    logSync('push', 'auth_skipped_known_user', {
      reason: 'autosave',
      requestId,
      userId,
      projectId: project.id,
    });
  } else {
    try {
      const { user, requestId: authRequestId } = await getAuthUser('autosave', 'push');

      if (!user) return { status: 'error', message: 'Cloud session is missing.' };

      userId = user.id;
      requestId = authRequestId;
    } catch (err) {
      logSyncError('push', 'auth_failed_before_request', err, {
        reason: 'autosave',
        projectId: project.id,
      });

      await enqueue(project);

      return {
        status: 'pending',
        message: err instanceof Error ? err.message : 'Cloud auth timed out. Will retry later.',
      };
    }
  }

  try {
    const row: ProjectRow = {
      user_id: userId,
      project_id: project.id,
      name: project.name,
      data: project as unknown as Record<string, unknown>,
      updated_at: localUpdatedAt(project),
    };

    // Critical fix:
    // Do NOT run ensureSessionFresh('autosave') here.
    // It can start refreshSession/getSession work that holds Supabase's auth lock,
    // causing the actual upsert to hang at query execution.
    logSync('push', 'session_preflight_skipped_autosave', {
      reason: 'autosave',
      requestId,
      projectId: project.id,
      why: 'Avoid auth refresh lock during autosave write',
    });

    await ensureSupabaseReachable();

    await withRetry(async () => {
      const startedAt = Date.now();

      logSync('push', 'request_start', {
        reason: 'autosave',
        requestId,
        projectId: project.id,
      });

      logSync('push', 'request_before_upsert', {
        reason: 'autosave',
        requestId,
        projectId: project.id,
        ...summarizeProjectRows([row]),
      });

      await upsertProjectRowsDirect(
        [row],
        'request',
        {
          reason: 'autosave',
          requestId,
          projectId: project.id,
        },
      );

      logSync('push', 'request_success', {
        requestId,
        projectId: project.id,
        durationMs: Date.now() - startedAt,
      });
    }, 4, 500, (attempt, err) => {
      const disconnected = cloudDisconnectInProgress || cloudConnectionGeneration !== connectionGenerationAtStart;

      if (disconnected) {
        logSync('push', 'request_retry_aborted_disconnect', {
          requestId,
          projectId: project.id,
          attempt: attempt + 1,
        });

        return false;
      }

      const kind = classifyError(err);

      if (kind === 'timeout') {
        logSync('push', 'request_retry_skipped_timeout', {
          reason: 'autosave',
          requestId,
          projectId: project.id,
          attempt: attempt + 1,
        });

        return false;
      }

      if (kind === 'auth_failure' || kind === 'rls_or_database_rejection') {
        logSync('push', 'request_retry_skipped_non_retryable', {
          reason: 'autosave',
          requestId,
          projectId: project.id,
          attempt: attempt + 1,
          kind,
        });

        return false;
      }

      return true;
    });

    await dequeue(project.id);
    return { status: 'saved_local' };
  } catch (err) {
    const disconnected = cloudDisconnectInProgress || cloudConnectionGeneration !== connectionGenerationAtStart;

    if (disconnected) {
      logSync('push', 'request_aborted_disconnect', {
        reason: 'autosave',
        requestId,
        projectId: project.id,
      });

      return { status: 'saved_local', message: 'Cloud disconnected during autosave.' };
    }

    if (!cloudDisconnectInProgress) {
      logSyncError('push', 'request_exception', err, {
        reason: 'autosave',
        requestId,
        projectId: project.id,
      });

      await enqueue(project);
    }

    return {
      status: 'pending',
      message: err instanceof Error ? err.message : 'Cloud sync failed. Will retry later.',
    };
  }
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
}

export async function fetchSubscription(userId: string): Promise<SubscriptionInfo> {
  const defaultInfo: SubscriptionInfo = { tier: 'free', status: 'none' };

  if (!supabase) return defaultInfo;

  if (subscriptionLookupInFlight.has(userId)) {
    return subscriptionLookupInFlight.get(userId)!;
  }

  const requestId = nextRequestId('subscription');

  logSync('subscription', 'fetch_start', { userId, requestId });

  const promise = (async (): Promise<SubscriptionInfo> => {
    const sb = getSupabase();
    const startedAt = Date.now();
    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, SUBSCRIPTION_FETCH_TIMEOUT_MS);

    try {
      const { data, error } = await sb
        .from('subscriptions')
        .select('tier, status')
        .eq('user_id', userId)
        .abortSignal(controller.signal)
        .maybeSingle();

      if (error) {
        logSyncError('subscription', 'fetch_failed', error, {
          userId,
          requestId,
          durationMs: Date.now() - startedAt,
        });

        return defaultInfo;
      }

      if (!data) {
        logSync('subscription', 'fetch_default_free', {
          userId,
          requestId,
          durationMs: Date.now() - startedAt,
        });

        return defaultInfo;
      }

      const tier = (['pro', 'team'].includes(data.tier) ? data.tier : 'free') as SubscriptionTier;
      const status = (
        ['active', 'trialing', 'past_due', 'canceled'].includes(data.status)
          ? data.status
          : 'none'
      ) as SubscriptionStatus;

      logSync('subscription', 'fetch_success', {
        userId,
        requestId,
        tier,
        status,
        durationMs: Date.now() - startedAt,
      });

      return { tier, status };
    } catch (err) {
      if (isAbortError(err)) {
        logSync('subscription', 'fetch_timeout', {
          userId,
          requestId,
          timeoutMs: SUBSCRIPTION_FETCH_TIMEOUT_MS,
          durationMs: Date.now() - startedAt,
        });

        return defaultInfo;
      }

      logSyncError('subscription', 'fetch_exception', err, {
        userId,
        requestId,
        durationMs: Date.now() - startedAt,
      });

      return defaultInfo;
    } finally {
      window.clearTimeout(timeoutId);
      subscriptionLookupInFlight.delete(userId);
    }
  })();

  subscriptionLookupInFlight.set(userId, promise);
  return promise;
}

// ─── Pull & merge ─────────────────────────────────────────────────────────────

async function pullAndMerge(
  localProjects: ProjectMemory[],
  userId: string,
  reason: SyncReason,
): Promise<{ merged: ProjectMemory[]; changed: boolean; conflicts: string[] }> {
  const requestId = nextRequestId('pull');

  if (!supabase) {
    logSync('pull', 'skipped_no_supabase', { reason, requestId });
    return { merged: localProjects, changed: false, conflicts: [] };
  }

  logSync('pull', 'fetch_start', { reason, requestId, userId });

  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select('project_id, name, data, updated_at')
    .eq('user_id', userId)
    .limit(500);

  if (error) {
    logSyncError('pull', 'fetch_failed', error, { reason, requestId, userId });
    throw new Error(error.message);
  }

  const remoteRows = (data ?? []) as RemoteRow[];

  logSync('pull', 'fetch_success', { reason, requestId, remoteCount: remoteRows.length });

  const localMap = new Map(localProjects.map((p) => [p.id, p]));
  let changed = false;
  const conflicts: string[] = [];

  for (const row of remoteRows) {
    const remoteProject = row.data as ProjectMemory;

    if (!remoteProject?.id) continue;

    const local = localMap.get(remoteProject.id);

    if (!local) {
      localMap.set(remoteProject.id, remoteProject);
      changed = true;

      logSync('pull', 'added_remote_project', {
        reason,
        requestId,
        projectId: remoteProject.id,
      });
    } else {
      const localTs = localUpdatedAt(local);
      const remoteTs = row.updated_at ?? localUpdatedAt(remoteProject);

      if (remoteTs > localTs) {
        localMap.set(remoteProject.id, remoteProject);
        changed = true;
        conflicts.push(remoteProject.name || remoteProject.id);

        logSync('pull', 'updated_from_remote', {
          reason,
          requestId,
          projectId: remoteProject.id,
          projectName: remoteProject.name,
          localTs,
          remoteTs,
        });
      }
    }
  }

  const merged = Array.from(localMap.values());

  logSync('pull', 'merge_complete', {
    reason,
    requestId,
    changed,
    mergedCount: merged.length,
    conflictCount: conflicts.length,
  });

  return { merged, changed, conflicts };
}

// ─── Drain offline queue ──────────────────────────────────────────────────────

async function drainQueue(
  userId: string,
  reason: SyncReason,
): Promise<void> {
  const queued = await getQueued();

  if (queued.length === 0) return;

  logSync('queue', 'drain_start', { reason, userId, queuedCount: queued.length });

  for (const project of queued) {
    try {
      const row: ProjectRow = {
        user_id: userId,
        project_id: project.id,
        name: project.name,
        data: project as unknown as Record<string, unknown>,
        updated_at: localUpdatedAt(project),
      };

      const { error } = await withSupabaseWriteTimeout<{ error: SupabaseErrorShape | null }>(
        (signal) => supabase!
          .from(PROJECTS_TABLE)
          .upsert(row, { onConflict: PROJECTS_ON_CONFLICT })
          .abortSignal(signal),
        'batch',
        { reason, projectId: project.id, drain: true },
      );

      if (error) {
        logSyncError('queue', 'drain_project_failed', error, { reason, projectId: project.id });
        continue;
      }

      await dequeue(project.id);

      logSync('queue', 'drain_project_success', { reason, projectId: project.id });
    } catch (err) {
      logSyncError('queue', 'drain_project_exception', err, { reason, projectId: project.id });
    }
  }

  logSync('queue', 'drain_complete', { reason, userId });
}

// ─── Push all local projects ──────────────────────────────────────────────────

async function pushAll(
  localProjects: ProjectMemory[],
  userId: string,
  reason: SyncReason,
): Promise<void> {
  if (!supabase || localProjects.length === 0) return;

  const requestId = nextRequestId('push');

  logSync('push', 'push_all_start', { reason, requestId, userId, count: localProjects.length });

  const rows: ProjectRow[] = localProjects.map((p) => ({
    user_id: userId,
    project_id: p.id,
    name: p.name,
    data: p as unknown as Record<string, unknown>,
    updated_at: localUpdatedAt(p),
  }));

  const BATCH_SIZE = 50;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const { error } = await withSupabaseWriteTimeout<{ error: SupabaseErrorShape | null }>(
      (signal) => supabase!
        .from(PROJECTS_TABLE)
        .upsert(batch, { onConflict: PROJECTS_ON_CONFLICT })
        .abortSignal(signal),
      'batch',
      { reason, requestId, batchStart: i, batchSize: batch.length },
      20000,
    );

    if (error) {
      logSyncError('push', 'push_all_batch_failed', error, {
        reason,
        requestId,
        batchStart: i,
      });

      throw new Error(error.message);
    }

    logSync('push', 'push_all_batch_success', {
      reason,
      requestId,
      batchStart: i,
      batchSize: batch.length,
    });
  }

  logSync('push', 'push_all_complete', { reason, requestId, count: localProjects.length });
}

// ─── Full sync cycle ──────────────────────────────────────────────────────────

async function _runCycle(
  localProjects: ProjectMemory[],
  reason: SyncReason,
  userId: string,
): Promise<{ merged: ProjectMemory[]; changed: boolean; conflicts: string[] }> {
  const cycleId = nextRequestId('cycle');

  logSync('cycle', 'cycle_start', { reason, cycleId, userId, localCount: localProjects.length });

  if ((reason === 'signin' || reason === 'startup') && localProjects.length > 0) {
    console.warn(
      `[cloudSync] SAFETY: local projects received on ${reason} cycle — dropping ${localProjects.length} to prevent cross-account leak`,
      { cycleId, userId, projectIds: localProjects.map((p) => p.id) },
    );

    logSync('cycle', 'unsafe_local_projects_dropped', {
      reason,
      cycleId,
      userId,
      count: localProjects.length,
    });

    localProjects = [];
  }

  try {
    const isAccountEntryCycle = reason === 'signin' || reason === 'startup';

    if (isAccountEntryCycle) {
      logSync('cycle', 'session_preflight_skipped_account_entry', {
        reason,
        cycleId,
        userId,
        why: 'Account entry already has an auth event/known user and must not wait behind sign-in auth locks.',
      });
    } else {
      logSync('cycle', 'before_ensure_session_fresh', { reason, cycleId, userId });
      await ensureSessionFresh(reason);
      logSync('cycle', 'after_ensure_session_fresh', { reason, cycleId, userId });
    }

    logSync('cycle', 'before_ensure_supabase_reachable', { reason, cycleId, userId });
    await ensureSupabaseReachable();
    logSync('cycle', 'after_ensure_supabase_reachable', { reason, cycleId, userId });

    if (isAccountEntryCycle) {
      logSync('cycle', 'write_steps_skipped_account_entry', {
        reason,
        cycleId,
        userId,
        localCount: localProjects.length,
        why: 'Login/startup must be pull-only; offline queue may contain device-local data from another account.',
      });
    } else {
      logSync('cycle', 'before_drain_queue', { reason, cycleId, userId });
      await drainQueue(userId, reason);
      logSync('cycle', 'after_drain_queue', { reason, cycleId, userId });

      logSync('cycle', 'before_push_all', {
        reason,
        cycleId,
        userId,
        localCount: localProjects.length,
      });
      await pushAll(localProjects, userId, reason);
      logSync('cycle', 'after_push_all', {
        reason,
        cycleId,
        userId,
        localCount: localProjects.length,
      });
    }

    logSync('cycle', 'before_pull_and_merge', { reason, cycleId, userId, localCount: localProjects.length });
    const result = await pullAndMerge(localProjects, userId, reason);

    logSync('cycle', 'after_pull_and_merge', {
      reason,
      cycleId,
      userId,
      changed: result.changed,
      mergedCount: result.merged.length,
      conflictCount: result.conflicts.length,
    });

    logSync('cycle', 'cycle_complete', {
      reason,
      cycleId,
      userId,
      changed: result.changed,
      mergedCount: result.merged.length,
      conflictCount: result.conflicts.length,
    });

    return result;
  } catch (err) {
    logSyncError('cycle', 'cycle_failed', err, { reason, cycleId, userId });
    throw err;
  }
}

export async function runCloudSyncCycle(
  localProjects: ProjectMemory[],
  reason: SyncReason,
  knownUserId?: string,
): Promise<{ merged: ProjectMemory[]; changed: boolean; conflicts: string[] }> {
  if (!supabase) {
    return { merged: localProjects, changed: false, conflicts: [] };
  }

  if (syncCycleInFlight) {
    logSync('cycle', 'cycle_join_inflight', { reason });
    return syncCycleInFlight;
  }

  const cyclePromise = (async (): Promise<{ merged: ProjectMemory[]; changed: boolean; conflicts: string[] }> => {
    let userId: string;

    if (knownUserId) {
      userId = knownUserId;
      logSync('cycle', 'auth_skipped_known_user', { reason, userId });
    } else {
      const { user } = await getAuthUser(reason, 'cycle');

      if (!user) {
        logSync('cycle', 'auth_no_user', { reason });
        return { merged: localProjects, changed: false, conflicts: [] };
      }

      userId = user.id;
    }

    return _runCycle(localProjects, reason, userId);
  })().finally(() => {
    syncCycleInFlight = null;
  });

  syncCycleInFlight = cyclePromise;
  return cyclePromise;
}

// ─── Delete project from cloud ────────────────────────────────────────────────

export async function deleteCloudProject(projectId: string, knownUserId?: string): Promise<void> {
  if (!supabase) return;

  const requestId = nextRequestId('push');

  let userId: string;

  if (knownUserId) {
    userId = knownUserId;

    logSync('push', 'delete_auth_skipped_known_user', { requestId, projectId, userId });
  } else {
    try {
      const { user } = await getAuthUser('autosave', 'push');

      if (!user) {
        logSync('push', 'delete_skipped_no_user', { requestId, projectId });
        return;
      }

      userId = user.id;
    } catch (err) {
      logSyncError('push', 'delete_auth_failed', err, { requestId, projectId });
      return;
    }
  }

  logSync('push', 'delete_start', { requestId, projectId, userId });

  try {
    const { error } = await supabase
      .from(PROJECTS_TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('project_id', projectId);

    if (error) {
      logSyncError('push', 'delete_failed', error, { requestId, projectId, userId });
    } else {
      logSync('push', 'delete_success', { requestId, projectId, userId });
    }
  } catch (err) {
    logSyncError('push', 'delete_exception', err, { requestId, projectId, userId });
  }
}

// ─── Re-export pendingCount from syncQueue ────────────────────────────────────

export { pendingCount } from './syncQueue';
