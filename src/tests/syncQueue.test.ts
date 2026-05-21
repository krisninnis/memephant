import type { ProjectMemory } from '../types/memphant-types';

type StoredRecord = Record<string, unknown>;

function makeProject(id: string, name = id): ProjectMemory {
  return {
    schema_version: '1.2.0',
    id,
    name,
    summary: 'Queued project',
    goals: [],
    rules: [],
    decisions: [],
    currentState: 'Pending sync',
    nextSteps: [],
    openQuestions: [],
    importantAssets: [],
    changelog: [],
    checkpoints: [],
    platformState: {},
    updatedAt: '2026-05-21T10:00:00.000Z',
  };
}

function createRequest<T>() {
  return {
    result: undefined as T,
    error: null as Error | null,
    onsuccess: null as null | (() => void),
    onerror: null as null | (() => void),
    onupgradeneeded: null as null | (() => void),
  };
}

function installIndexedDbMock() {
  const records = new Map<string, StoredRecord>();

  const db = {
    objectStoreNames: {
      contains: () => true,
    },
    createObjectStore: jest.fn(),
    transaction: () => {
      const tx = {
        oncomplete: null as null | (() => void),
        onerror: null as null | (() => void),
        error: null,
        objectStore: () => ({
          put: (value: StoredRecord) => {
            records.set(String(value.id), value);
          },
          getAll: () => {
            const req = createRequest<StoredRecord[]>();
            setTimeout(() => {
              req.result = Array.from(records.values());
              req.onsuccess?.();
            }, 0);
            return req;
          },
          delete: (id: string) => {
            records.delete(id);
          },
          count: () => {
            const req = createRequest<number>();
            setTimeout(() => {
              req.result = records.size;
              req.onsuccess?.();
            }, 0);
            return req;
          },
        }),
      };

      setTimeout(() => tx.oncomplete?.(), 5);
      return tx;
    },
    close: jest.fn(),
  };

  const indexedDb = {
    open: jest.fn(() => {
      const req = createRequest<typeof db>();
      setTimeout(() => {
        req.result = db;
        req.onsuccess?.();
      }, 0);
      return req;
    }),
  };

  Reflect.set(globalThis, 'indexedDB', indexedDb);

  return { records };
}

describe('syncQueue account safety', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useRealTimers();
    installIndexedDbMock();
  });

  it('stores queued projects with the owning user id', async () => {
    const { enqueue, getAll } = await import('../services/syncQueue');

    await enqueue(makeProject('project-a'), 'user-a');

    const queued = await getAll();
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      id: 'user-a:project-a',
      userId: 'user-a',
      legacy: false,
    });
    expect(queued[0].project.id).toBe('project-a');
  });

  it('selects only entries belonging to the active user', async () => {
    const { queuedEntriesForUser } = await import('../services/syncQueue');

    const userAProject = makeProject('project-a');
    const userBProject = makeProject('project-b');
    const legacyProject = makeProject('legacy-project');

    const selected = queuedEntriesForUser([
      { id: 'user-a:project-a', userId: 'user-a', project: userAProject, legacy: false },
      { id: 'user-b:project-b', userId: 'user-b', project: userBProject, legacy: false },
      { id: 'legacy-project', userId: null, project: legacyProject, legacy: true },
    ], 'user-a');

    expect(selected.map((entry) => entry.project.id)).toEqual(['project-a']);
  });

  it('keeps stale entries from another user out of the active user drain set', async () => {
    const { enqueue, getAll, queuedEntriesForUser } = await import('../services/syncQueue');

    await enqueue(makeProject('same-device-a'), 'user-a');
    await enqueue(makeProject('same-device-b'), 'user-b');

    const queued = await getAll();
    const userBDrainSet = queuedEntriesForUser(queued, 'user-b');

    expect(userBDrainSet).toHaveLength(1);
    expect(userBDrainSet[0].userId).toBe('user-b');
    expect(userBDrainSet[0].project.id).toBe('same-device-b');
  });

  it('dequeues a deleted project across all queued accounts', async () => {
    const { enqueue, dequeue, getAll, queuedEntriesForUser } = await import('../services/syncQueue');

    await enqueue(makeProject('deleted-project'), 'user-a');
    await enqueue(makeProject('deleted-project'), 'user-b');
    await enqueue(makeProject('kept-project'), 'user-b');

    await dequeue('deleted-project');

    const queued = await getAll();
    expect(queued.map((entry) => entry.project.id)).toEqual(['kept-project']);
    expect(queuedEntriesForUser(queued, 'user-a')).toEqual([]);
    expect(queuedEntriesForUser(queued, 'user-b').map((entry) => entry.project.id)).toEqual([
      'kept-project',
    ]);
  });
});
