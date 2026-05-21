/**
 * Offline sync queue backed by IndexedDB.
 *
 * When a push fails (offline / transient error), the project is saved here.
 * On next successful online sync, all queued items are drained.
 *
 * DB: memphant-sync / store: pending-pushes
 */

import type { ProjectMemory } from '../types/memphant-types';

const DB_NAME    = 'memphant-sync';
const DB_VERSION = 1;
const STORE      = 'pending-pushes';

export interface QueuedSyncEntry {
  id: string;
  userId: string;
  project: ProjectMemory;
}

export interface ReadQueuedSyncEntry {
  id: string;
  userId: string | null;
  project: ProjectMemory;
  legacy: boolean;
}

function queueEntryId(userId: string, projectId: string): string {
  return `${userId}:${projectId}`;
}

function isProjectMemory(value: unknown): value is ProjectMemory {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof (value as Partial<ProjectMemory>).id === 'string',
  );
}

function normalizeQueuedEntry(value: unknown): ReadQueuedSyncEntry | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<QueuedSyncEntry>;
  if (
    typeof candidate.id === 'string'
    && typeof candidate.userId === 'string'
    && isProjectMemory(candidate.project)
  ) {
    return {
      id: candidate.id,
      userId: candidate.userId,
      project: candidate.project,
      legacy: false,
    };
  }

  if (isProjectMemory(value)) {
    return {
      id: value.id,
      userId: null,
      project: value,
      legacy: true,
    };
  }

  return null;
}

export function queuedEntriesForUser(
  entries: ReadQueuedSyncEntry[],
  userId: string,
): ReadQueuedSyncEntry[] {
  return entries.filter((entry) => !entry.legacy && entry.userId === userId);
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/** Add or replace a project in the pending queue for a specific account. */
export async function enqueue(project: ProjectMemory, userId: string): Promise<void> {
  try {
    const db   = await openDB();
    const tx   = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.put({
      id: queueEntryId(userId, project.id),
      userId,
      project,
    } satisfies QueuedSyncEntry);
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[SyncQueue] enqueue failed:', err);
  }
}

/** Return all queued entries. Legacy unscoped projects are marked but never uploaded blindly. */
export async function getAll(): Promise<ReadQueuedSyncEntry[]> {
  try {
    const db    = await openDB();
    const tx    = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);

    const result = await new Promise<unknown[]>((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result as unknown[]);
      req.onerror   = () => rej(req.error);
    });

    db.close();
    return result
      .map(normalizeQueuedEntry)
      .filter((entry): entry is ReadQueuedSyncEntry => entry !== null);
  } catch {
    return [];
  }
}

/** Remove a project from the queue by its project id. Omit userId to clear it across all accounts. */
export async function dequeue(projectId: string, userId?: string): Promise<void> {
  try {
    const db    = await openDB();
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);

    if (userId) {
      store.delete(queueEntryId(userId, projectId));
      store.delete(projectId);
    } else {
      const entries = await new Promise<ReadQueuedSyncEntry[]>((res, rej) => {
        const req = store.getAll();
        req.onsuccess = () => {
          const normalized = (req.result as unknown[])
            .map(normalizeQueuedEntry)
            .filter((entry): entry is ReadQueuedSyncEntry => entry !== null);
          res(normalized);
        };
        req.onerror = () => rej(req.error);
      });

      for (const entry of entries) {
        if (entry.project.id === projectId) {
          store.delete(entry.id);
        }
      }
    }

    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('[SyncQueue] dequeue failed:', err);
  }
}

/** How many projects are waiting to be synced. */
export async function pendingCount(): Promise<number> {
  try {
    const db    = await openDB();
    const tx    = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);

    const count = await new Promise<number>((res, rej) => {
      const req = store.count();
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });

    db.close();
    return count;
  } catch {
    return 0;
  }
}
