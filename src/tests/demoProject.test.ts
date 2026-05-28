import { createDemoProject, DEMO_PROJECT_ID, DEMO_PROJECT_NAME } from '../utils/demoProject';

describe('demo project seed', () => {
  it('creates a deterministic local-first demo project with export-ready context', () => {
    const project = createDemoProject('2026-05-28T10:00:00.000Z');

    expect(project.id).toBe(DEMO_PROJECT_ID);
    expect(project.name).toBe(DEMO_PROJECT_NAME);
    expect(project.summary).toContain('Context Passport');
    expect(project.currentState).toContain('landing page');
    expect(project.nextSteps.length).toBeGreaterThanOrEqual(3);
    expect(project.importantAssets).toContain('src/components/Workspace/ContextPassportModal.tsx');
    expect(project.aiInstructions).toContain('privacy-first');
    expect(project.platformState).toEqual({});
    expect(project.changelog[0]).toMatchObject({
      action: 'added',
      source: 'app',
    });
  });

  it('does not include linked folders, accounts, or cloud routing fields', () => {
    const serialized = JSON.stringify(createDemoProject('2026-05-28T10:00:00.000Z'));

    expect(serialized).not.toContain('linkedFolder');
    expect(serialized).not.toContain('userId');
    expect(serialized).not.toContain('user_id');
    expect(serialized).not.toContain('supabase');
    expect(serialized).not.toContain('cloudSync');
  });
});
