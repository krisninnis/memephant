import { generateDailyContentPack } from '../utils/dailyContentPackGenerator';
import type { ProjectMemory } from '../types/memphant-types';

const project: ProjectMemory = {
  schema_version: '1.2.0',
  id: 'daily-content-pack-project',
  name: 'Memephant Launch Studio',
  summary: 'Turn project memory into copy-ready launch and social ideas.',
  currentState: 'Daily Content Pack is ready for local preview.',
  goals: ['Make daily distribution easier', 'Keep public copy grounded in real progress'],
  rules: ['Do not add posting automation'],
  decisions: [
    {
      decision: 'Keep Daily Content Pack local-first and copy-only.',
      rationale: 'Publishing should stay under user control.',
    },
  ],
  nextSteps: ['Share the content pack with early users', 'Ask which draft feels most useful'],
  openQuestions: ['Which daily post format saves the most time?'],
  importantAssets: ['C:\\Users\\kris\\memephant\\demo-clip.mp4'],
  inProgress: ['Packaging social drafts inside Launch Studio'],
  changelog: [
    {
      timestamp: '2026-05-28T10:00:00.000Z',
      field: 'launch',
      action: 'added',
      summary: 'Added Daily Content Pack generator.',
    },
  ],
  checkpoints: [],
  platformState: {},
  workflowMode: 'launch',
};

describe('generateDailyContentPack', () => {
  it('generates deterministic daily content sections from project context', () => {
    const pack = generateDailyContentPack(project, '2026-05-28T12:00:00.000Z');

    expect(pack.projectName).toBe('Memephant Launch Studio');
    expect(pack.generatedAt).toBe('2026-05-28T12:00:00.000Z');
    expect(pack.sections).toHaveLength(10);
    expect(pack.sections.map((section) => section.id)).toEqual([
      'xPost',
      'linkedInPost',
      'redditPost',
      'memeIdea',
      'founderReflection',
      'replyIdeas',
      'demoClipCaption',
      'feedbackQuestion',
      'whatShippedToday',
      'problemSolutionPost',
    ]);
    expect(pack.markdown).toContain('# Daily Content Pack: Memephant Launch Studio');
    expect(pack.markdown).toContain('## X post');
    expect(pack.markdown).toContain('Added Daily Content Pack generation for copy-ready social ideas.');
    expect(pack.markdown).toContain('Launch Mode');
    expect(pack.markdown).toContain('Which daily post format saves the most time?');
  });

  it('keeps content ideas public by removing local folder paths', () => {
    const pack = generateDailyContentPack(project, '2026-05-28T12:00:00.000Z');

    expect(pack.markdown).toContain('demo-clip.mp4');
    expect(pack.markdown).not.toContain('C:\\Users\\kris');
  });

  it('redacts obvious secrets and filters placeholder scaffolding', () => {
    const pack = generateDailyContentPack({
      ...project,
      summary: 'Write 1-2 sentences describing what is true right now after this session.',
      currentState: 'Updated integration with api_key=secret-123.',
      nextSteps: [
        'List the immediate next actions that should happen after this session',
        'Record a daily demo clip',
      ],
      openQuestions: [
        'The single most important unresolved question or decision needed to move forward',
        'Does the daily content feel specific enough?',
      ],
    }, '2026-05-28T12:00:00.000Z');

    expect(pack.markdown).not.toContain('Write 1-2 sentences');
    expect(pack.markdown).not.toContain('secret-123');
    expect(pack.markdown).not.toContain('List the immediate next actions');
    expect(pack.markdown).not.toContain('single most important unresolved question');
    expect(pack.markdown).toContain('[redacted]');
    expect(pack.markdown).not.toContain('List the immediate next actions');
    expect(pack.markdown).toContain('Does the daily content feel specific enough?');
  });

  it('suppresses noisy export changelog entries while keeping real shipping signals', () => {
    const pack = generateDailyContentPack({
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
          summary: 'Shipped Daily Content Pack preview.',
        },
      ],
    }, '2026-05-28T12:00:00.000Z');

    expect(pack.markdown).not.toContain('Copied project context');
    expect(pack.markdown).toContain('Added Daily Content Pack generation for copy-ready social ideas.');
  });

  it('uses shipping highlights in daily shipped sections', () => {
    const pack = generateDailyContentPack({
      ...project,
      changelog: [
        {
          timestamp: '2026-05-28T09:00:00.000Z',
          field: 'general',
          action: 'updated',
          summary: '2 items added by AI',
        },
        {
          timestamp: '2026-05-28T10:00:00.000Z',
          field: 'launch',
          action: 'added',
          summary: 'Added Launch Studio separation.',
        },
      ],
    }, '2026-05-28T12:00:00.000Z');

    const shippedToday = pack.sections.find((section) => section.id === 'whatShippedToday');

    expect(shippedToday?.content).toContain('Added Launch Studio separation');
    expect(shippedToday?.content).not.toContain('2 items added by AI');
  });

  it('adds a content quality warning when positioning context is weak', () => {
    const pack = generateDailyContentPack({
      ...project,
      summary: 'Write 1-2 sentences describing what is true right now after this session.',
    }, '2026-05-28T12:00:00.000Z');

    expect(pack.qualityWarning).toBe('Content quality may be limited because the project summary is incomplete.');
    expect(pack.markdown).toContain('> Content quality may be limited because the project summary is incomplete.');
  });

  it('does not use planning notes as the generated X post', () => {
    const pack = generateDailyContentPack({
      ...project,
      nextSteps: ['Post on Indie Hackers'],
      changelog: [
        {
          timestamp: '2026-05-29T09:00:00.000Z',
          field: 'planning',
          action: 'updated',
          summary: 'Prepared next step: Post on Indie Hackers',
        },
        {
          timestamp: '2026-05-29T10:00:00.000Z',
          field: 'launch',
          action: 'added',
          summary: 'Added Social Bridge composer links.',
        },
      ],
    }, '2026-05-29T12:00:00.000Z');

    const xPost = pack.sections.find((section) => section.id === 'xPost');

    expect(xPost?.content).toContain('Added Social Bridge so generated content can be opened directly in X, LinkedIn, Reddit, and Facebook.');
    expect(xPost?.content).not.toContain('Prepared next step');
    expect(xPost?.content).not.toContain('Next up: Post on Indie Hackers');
  });

  it('keeps project positioning out of what shipped when no recent highlights exist', () => {
    const pack = generateDailyContentPack({
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

    const shippedToday = pack.sections.find((section) => section.id === 'whatShippedToday');
    const xPost = pack.sections.find((section) => section.id === 'xPost');

    expect(pack.progressWarning).toBe('Recent progress may be limited because no meaningful shipped updates were found.');
    expect(shippedToday?.content).toContain('No recent shipped updates found yet.');
    expect(shippedToday?.content).toContain('Add what changed recently to generate better posts.');
    expect(shippedToday?.content).toContain('Tell Memephant what changed recently');
    expect(shippedToday?.content).not.toContain('Recent progress may be limited because no meaningful shipped updates were found.');
    expect(shippedToday?.content).not.toContain('Move your project between AI tools without ever rebuilding context.');
    expect(shippedToday?.shareable).toBe(false);
    expect(xPost?.content).toContain('Move your project between AI tools without ever rebuilding context.');
  });
});
