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
    expect(update.markdown).toContain('Added post-copy guidance after export');
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

  it('filters placeholder scaffolding from public update drafts', () => {
    const update = generateBuildUpdate({
      ...project,
      summary: 'Write 1-2 sentences describing what is true right now after this session.',
      currentState: 'Project just created',
      nextSteps: [
        'List the immediate next actions that should happen after this session',
        'Record a Context Passport handoff clip',
      ],
      openQuestions: [
        'The single most important unresolved question or decision needed to move forward',
        'Does the copy make the handoff feel real?',
      ],
    }, '2026-05-28T12:00:00.000Z');

    expect(update.markdown).not.toContain('Write 1-2 sentences');
    expect(update.markdown).not.toContain('Project just created');
    expect(update.markdown).not.toContain('List the immediate next actions');
    expect(update.markdown).not.toContain('single most important unresolved question');
    expect(update.markdown).toContain('Record a Context Passport handoff clip');
    expect(update.markdown).toContain('Does the copy make the handoff feel real?');
  });

  it('suppresses noisy duplicate changelog entries while keeping meaningful progress', () => {
    const update = generateBuildUpdate({
      ...project,
      changelog: [
        {
          timestamp: '2026-05-28T09:00:00.000Z',
          field: 'export',
          action: 'updated',
          summary: 'Copied project context for ChatGPT.',
        },
        {
          timestamp: '2026-05-28T10:00:00.000Z',
          field: 'launch',
          action: 'updated',
          summary: 'Added Launch Passport polish.',
        },
        {
          timestamp: '2026-05-28T11:00:00.000Z',
          field: 'launch',
          action: 'updated',
          summary: 'Added Launch Passport polish.',
        },
        {
          timestamp: '2026-05-28T12:00:00.000Z',
          field: 'workflow',
          action: 'updated',
          summary: 'Refined workflow mode guidance.',
        },
      ],
    }, '2026-05-28T12:00:00.000Z');

    const releaseNotes = update.sections.find((section) => section.id === 'releaseNotes');

    expect(update.markdown).not.toContain('Copied project context');
    expect(releaseNotes?.content.match(/Added Launch Passport polish/g)).toHaveLength(1);
    expect(update.markdown).toContain('Improved workflow mode guidance');
  });

  it('uses shipping highlights instead of low-signal AI bookkeeping', () => {
    const update = generateBuildUpdate({
      ...project,
      changelog: [
        {
          timestamp: '2026-05-28T09:00:00.000Z',
          field: 'general',
          action: 'updated',
          summary: '4 decisions added by AI',
        },
        {
          timestamp: '2026-05-28T10:00:00.000Z',
          field: 'general',
          action: 'updated',
          summary: '7 items added by AI',
        },
        {
          timestamp: '2026-05-28T11:00:00.000Z',
          field: 'launch',
          action: 'added',
          summary: 'Implemented Content Readiness scoring.',
        },
        {
          timestamp: '2026-05-28T12:00:00.000Z',
          field: 'onboarding',
          action: 'updated',
          summary: 'Refined onboarding clarity.',
        },
      ],
    }, '2026-05-28T12:00:00.000Z');

    expect(update.markdown).not.toContain('4 decisions added by AI');
    expect(update.markdown).not.toContain('7 items added by AI');
    expect(update.markdown).toContain('Added Content Readiness scoring');
    expect(update.markdown).toContain('Improved onboarding clarity');
  });

  it('adds a content quality warning when positioning context is weak', () => {
    const update = generateBuildUpdate({
      ...project,
      summary: 'Write 1-2 sentences describing what is true right now after this session.',
    }, '2026-05-28T12:00:00.000Z');

    expect(update.qualityWarning).toBe('Content quality may be limited because the project summary is incomplete.');
    expect(update.markdown).toContain('> Content quality may be limited because the project summary is incomplete.');
  });

  it('prefers public quality updates over bookkeeping in social sections', () => {
    const update = generateBuildUpdate({
      ...project,
      changelog: [
        {
          timestamp: '2026-05-29T09:00:00.000Z',
          field: 'session',
          action: 'updated',
          summary: 'Last session summary updated',
        },
        {
          timestamp: '2026-05-29T10:00:00.000Z',
          field: 'auth',
          action: 'updated',
          summary: 'Fixed OAuth session persistence.',
        },
      ],
    }, '2026-05-29T12:00:00.000Z');

    const xUpdate = update.sections.find((section) => section.id === 'xUpdate');

    expect(xUpdate?.content).toContain('Improved OAuth session persistence and sign-in reliability.');
    expect(xUpdate?.content).not.toContain('Last session summary updated');
  });

  it('does not use positioning summary as a shipped update when recent progress is missing', () => {
    const update = generateBuildUpdate({
      ...project,
      summary: 'Move your project between AI tools without ever rebuilding context.',
      currentState: 'Project updated.',
      inProgress: [],
      changelog: [
        {
          timestamp: '2026-05-29T09:00:00.000Z',
          field: 'session',
          action: 'updated',
          summary: 'Last session summary updated',
        },
      ],
    }, '2026-05-29T12:00:00.000Z');

    const shippedThisWeek = update.sections.find((section) => section.id === 'shippedThisWeek');
    const reddit = update.sections.find((section) => section.id === 'reddit');

    expect(update.progressWarning).toBe('Recent progress may be limited because no meaningful shipped updates were found.');
    expect(shippedThisWeek?.content).toContain('No recent shipped updates found yet.');
    expect(shippedThisWeek?.content).toContain('Add what changed recently to generate better posts.');
    expect(shippedThisWeek?.content).toContain('Tell Memephant what changed recently');
    expect(shippedThisWeek?.content).not.toContain('Recent progress may be limited because no meaningful shipped updates were found.');
    expect(shippedThisWeek?.content).not.toContain('Move your project between AI tools without ever rebuilding context.');
    expect(shippedThisWeek?.shareable).toBe(false);
    expect(reddit?.content).toContain('Move your project between AI tools without ever rebuilding context.');
  });
});
