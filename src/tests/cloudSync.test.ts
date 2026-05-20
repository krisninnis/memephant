import { toCloudProjectData } from '../services/toCloudProjectData';
import type { ProjectMemory } from '../types/memphant-types';

function makeProject(overrides: Partial<ProjectMemory> = {}): ProjectMemory {
  return {
    schema_version: '1.2.0',
    id: 'cloud-safe-project',
    name: 'Cloud Safe Project',
    summary: 'Testing cloud serialization.',
    goals: ['Keep cloud payloads safe'],
    rules: ['Never upload local paths'],
    decisions: [],
    currentState: 'Ready for sync.',
    nextSteps: ['Run validation'],
    openQuestions: [],
    importantAssets: [],
    changelog: [],
    checkpoints: [],
    platformState: {},
    updatedAt: '2026-05-20T10:00:00.000Z',
    ...overrides,
  };
}

describe('toCloudProjectData', () => {
  it('removes linkedFolder.path from serialized cloud payloads', () => {
    const localPath = 'C:\\Users\\thoma\\secret-project';
    const cloudData = toCloudProjectData(makeProject({
      linkedFolder: {
        path: localPath,
        scanHash: 'scan-123',
        lastScannedAt: '2026-05-20T09:00:00.000Z',
      },
      currentState: `Linked folder is ${localPath}`,
    }));

    const serialized = JSON.stringify(cloudData);

    expect(serialized).not.toContain(localPath);
    expect(serialized).not.toContain(localPath.replace(/\\/g, '/'));
    expect((cloudData.linkedFolder as Record<string, unknown>).path).toBeUndefined();
  });

  it('preserves linked folder scan metadata', () => {
    const cloudData = toCloudProjectData(makeProject({
      linkedFolder: {
        path: '/Users/thoma/private/repo',
        scanHash: 'scan-hash-survives',
        lastScannedAt: '2026-05-20T09:00:00.000Z',
      },
    }));

    expect(cloudData.linkedFolder).toEqual({
      scanHash: 'scan-hash-survives',
      lastScannedAt: '2026-05-20T09:00:00.000Z',
    });
  });

  it('keeps sanitized legacy project link fields but drops local legacy paths', () => {
    const project = {
      ...makeProject(),
      linkedProjectName: 'Desktop app repo',
      linkedProjectPath: 'workspace-alias',
      previousLinkedProjectPath: 'C:\\Users\\thoma\\private\\legacy',
    } as ProjectMemory & {
      linkedProjectName: string;
      linkedProjectPath: string;
      previousLinkedProjectPath: string;
    };

    const cloudData = toCloudProjectData(project);

    expect(cloudData.linkedProjectName).toBe('Desktop app repo');
    expect(cloudData.linkedProjectPath).toBe('workspace-alias');
    expect(cloudData.previousLinkedProjectPath).toBeUndefined();
    expect(JSON.stringify(cloudData)).not.toContain('C:\\Users\\thoma\\private\\legacy');
  });

  it('round-trips through JSON while keeping project data usable', () => {
    const cloudData = toCloudProjectData(makeProject({
      linkedFolder: {
        path: 'C:\\Users\\thoma\\private\\repo',
        scanHash: 'scan-roundtrip',
        lastScannedAt: '2026-05-20T09:00:00.000Z',
      },
      decisions: [{ decision: 'Serialize safely', rationale: 'Cloud data should remain useful' }],
      platformState: {
        claude: { lastExportedAt: '2026-05-20T09:30:00.000Z' },
      },
    }));

    const roundTripped = JSON.parse(JSON.stringify(cloudData)) as ProjectMemory;

    expect(roundTripped.id).toBe('cloud-safe-project');
    expect(roundTripped.name).toBe('Cloud Safe Project');
    expect(roundTripped.decisions[0].decision).toBe('Serialize safely');
    expect(roundTripped.platformState.claude?.lastExportedAt).toBe('2026-05-20T09:30:00.000Z');
    expect(roundTripped.linkedFolder?.scanHash).toBe('scan-roundtrip');
    expect(roundTripped.linkedFolder?.path).toBeUndefined();
  });
});

