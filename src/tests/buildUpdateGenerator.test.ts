import { generateBuildUpdate } from '../utils/buildUpdateGenerator';
import type { ProjectMemory } from '../types/memphant-types';

const project: ProjectMemory = {
  schema_version: '1.2.0',
  id: 'build-update-project',
  name: 'Memephant Landing Page Refresh',
  summary: 'Help visitors understand Context Passport in under 30 seconds.',
  currentState: 'The demo flow is ready and Launch Mode is selected.',
  goals: ['Explain cross-AI continuity clearly', 'Collect first-user feedback'],
  rules: ['Keep public updates honest'],
  decisions: [
    {
      decision: 'Use Context Passport as the flagship handoff name.',
      rationale: 'It explains portability better than memory.',
    },
  ],
  nextSteps: ['Record the 90-second demo', 'Ask first users where the value becomes clear'],
  openQuestions: ['Does the demo make the handoff feel real?'],
  importantAssets: ['C:\\Users\\kris\\memephant\\demo-video-script.md'],
  inProgress: ['Preparing public demo clips'],
  changelog: [
    {
      timestamp: '2026-05-28T10:00:00.000Z',
      field: 'demo',
      action: 'updated',
      summary: 'Added post-copy guidance after export.',
    },
  ],
  checkpoints: [],
  platformState: {},
  workflowMode: 'launch',
};

describe('generateBuildUpdate', () => {
  it('generates deterministic build update sections from project context', () => {
    const update = generateBuildUpdate(project, '2026-05-28T12:00:00.000Z');

    expect(update.projectName).toBe('Memephant Landing Page Refresh');
    expect(update.generatedAt).toBe('2026-05-28T12:00:00.000Z');
    expect(update.sections).toHaveLength(10);
    expect(update.markdown).toContain('# Build Update: Memephant Landing Page Refresh');
    expect(update.markdown).toContain('## X/Twitter build update');
    expect(update.markdown).toContain('Added post-copy guidance after export.');
    expect(update.markdown).toContain('Record the 90-second demo');
    expect(update.markdown).toContain('Launch Mode');
  });

  it('keeps launch-facing assets public by removing local folder paths', () => {
    const update = generateBuildUpdate(project, '2026-05-28T12:00:00.000Z');

    expect(update.markdown).toContain('demo-video-script.md');
    expect(update.markdown).not.toContain('C:\\Users\\kris');
  });

  it('redacts obvious secret patterns from public update drafts', () => {
    const update = generateBuildUpdate({
      ...project,
      currentState: 'Fixed deployment with token=super-secret-token.',
    }, '2026-05-28T12:00:00.000Z');

    expect(update.markdown).toContain('[redacted]');
    expect(update.markdown).not.toContain('super-secret-token');
  });
});
