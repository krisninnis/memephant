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

  it('redacts Windows absolute paths inside free-text fields', () => {
    const windowsPath = 'C:\\Users\\Kris\\Desktop\\Secret';
    const cloudData = toCloudProjectData(makeProject({
      summary: `Normal text before ${windowsPath} and normal text after.`,
    }));

    expect(cloudData.summary).toBe(
      'Normal text before [local-path-redacted] and normal text after.',
    );
    expect(JSON.stringify(cloudData)).not.toContain(windowsPath);
  });

  it('redacts macOS absolute paths inside free-text fields', () => {
    const macPath = '/Users/kris/project';
    const cloudData = toCloudProjectData(makeProject({
      currentState: `The local folder was ${macPath}. Keep the sentence useful.`,
    }));

    expect(cloudData.currentState).toBe(
      'The local folder was [local-path-redacted]. Keep the sentence useful.',
    );
    expect(JSON.stringify(cloudData)).not.toContain(macPath);
  });

  it('redacts Linux absolute paths inside multiline strings', () => {
    const linuxPath = '/home/user/private';
    const cloudData = toCloudProjectData(makeProject({
      lastSessionSummary: [
        'First line is safe.',
        `Second line mentions ${linuxPath}`,
        'Third line is safe.',
      ].join('\n'),
    }));

    expect(cloudData.lastSessionSummary).toBe([
      'First line is safe.',
      'Second line mentions [local-path-redacted]',
      'Third line is safe.',
    ].join('\n'));
    expect(JSON.stringify(cloudData)).not.toContain(linuxPath);
  });

  it('redacts file URL paths without destroying mixed normal text', () => {
    const fileUrl = 'file:///Users/kris/project/notes.md';
    const cloudData = toCloudProjectData(makeProject({
      goals: [`Review ${fileUrl} after launch`],
    }));

    expect(cloudData.goals).toEqual(['Review [local-path-redacted] after launch']);
    expect(JSON.stringify(cloudData)).not.toContain(fileUrl);
  });
});
