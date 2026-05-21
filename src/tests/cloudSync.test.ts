import { toCloudProjectData } from '../services/toCloudProjectData';
import type { ProjectMemory } from '../types/memphant-types';

const OPENAI_KEY = `sk-${'a'.repeat(30)}`;
const STRIPE_SECRET_KEY = ['sk', 'live', 'b'.repeat(30)].join('_');
const GITHUB_TOKEN = `ghp_${'c'.repeat(36)}`;
const SUPABASE_SERVICE_ROLE_JWT = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UifQ',
  'signaturepart1234567890abcdef',
].join('.');

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

  it('redacts secrets inside summary, currentState, goals, rules, and decisions', () => {
    const cloudData = toCloudProjectData(makeProject({
      summary: `OpenAI key ${OPENAI_KEY}`,
      currentState: `Stripe key ${STRIPE_SECRET_KEY}`,
      goals: [`Remove GitHub token ${GITHUB_TOKEN}`],
      rules: [`Never store service role ${SUPABASE_SERVICE_ROLE_JWT}`],
      decisions: [{
        decision: 'Rotate leaked credential',
        rationale: 'api_key=abcdef1234567890abcdef',
      }],
    }));
    const serialized = JSON.stringify(cloudData);

    expect(serialized).not.toContain(OPENAI_KEY);
    expect(serialized).not.toContain(STRIPE_SECRET_KEY);
    expect(serialized).not.toContain(GITHUB_TOKEN);
    expect(serialized).not.toContain(SUPABASE_SERVICE_ROLE_JWT);
    expect(serialized).not.toContain('abcdef1234567890abcdef');
    expect(serialized).toContain('[secret-redacted]');
  });

  it('redacts .env-style multiline strings', () => {
    const cloudData = toCloudProjectData(makeProject({
      projectCharter: [
        'PUBLIC_APP_NAME=Memephant',
        'SUPABASE_SERVICE_ROLE_KEY=service-role-secret-value',
        `STRIPE_SECRET_KEY=${['sk', 'live', '123456789012345678901234'].join('_')}`,
        'NEXT_PUBLIC_SAFE_LABEL=visible',
      ].join('\n'),
    }));

    expect(cloudData.projectCharter).toBe([
      'PUBLIC_APP_NAME=Memephant',
      'SUPABASE_SERVICE_ROLE_KEY=[secret-redacted]',
      'STRIPE_SECRET_KEY=[secret-redacted]',
      'NEXT_PUBLIC_SAFE_LABEL=visible',
    ].join('\n'));
  });

  it('preserves normal non-secret text', () => {
    const normalSummary = 'Use a token bucket design pattern in the docs, not an actual token value.';
    const normalGoal = 'Document API design choices without including credentials.';
    const cloudData = toCloudProjectData(makeProject({
      summary: normalSummary,
      goals: [normalGoal],
    }));

    expect(cloudData.summary).toBe(normalSummary);
    expect(cloudData.goals).toEqual([normalGoal]);
  });

  it('does not mutate the saved local project object while redacting cloud payloads', () => {
    const project = makeProject({
      summary: `Keep local value ${OPENAI_KEY}`,
      currentState: 'Ready for sync.',
    });
    const before = JSON.stringify(project);

    const cloudData = toCloudProjectData(project);

    expect(project.summary).toContain(OPENAI_KEY);
    expect(JSON.stringify(project)).toBe(before);
    expect(JSON.stringify(cloudData)).not.toContain(OPENAI_KEY);
  });

  it('redacts paths and secrets in the same cloud payload', () => {
    const localPath = 'C:\\Users\\Kris\\Desktop\\Secret';
    const cloudData = toCloudProjectData(makeProject({
      summary: `Path ${localPath} used key ${OPENAI_KEY}`,
      linkedFolder: {
        path: localPath,
        scanHash: 'scan-safe',
        lastScannedAt: '2026-05-20T09:00:00.000Z',
      },
    }));
    const serialized = JSON.stringify(cloudData);

    expect(serialized).not.toContain(localPath);
    expect(serialized).not.toContain(OPENAI_KEY);
    expect(serialized).toContain('[local-path-redacted]');
    expect(serialized).toContain('[secret-redacted]');
    expect(cloudData.linkedFolder).toEqual({
      scanHash: 'scan-safe',
      lastScannedAt: '2026-05-20T09:00:00.000Z',
    });
  });
});
