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
    expect(pack.markdown).toContain('Added Daily Content Pack generator.');
    expect(pack.markdown).toContain('Launch Mode');
    expect(pack.markdown).toContain('Share the content pack with early users');
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
    expect(pack.markdown).toContain('Record a daily demo clip');
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
    expect(pack.markdown).toContain('Shipped Daily Content Pack preview.');
  });
});
