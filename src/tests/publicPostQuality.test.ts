import {
  getPublicPostContext,
  humanizePublicPostSignal,
  isLowValuePublicPostSignal,
  scorePublicPostSignal,
} from '../utils/publicPostQuality';
import type { ProjectMemory } from '../types/memphant-types';

const project: ProjectMemory = {
  schema_version: '1.2.0',
  id: 'public-post-quality-project',
  name: 'Memephant',
  summary: 'Move your project between AI tools without ever rebuilding context.',
  currentState: 'Launch Studio is improving generated public content.',
  goals: ['Help builders keep context across AI tools'],
  rules: [],
  decisions: [],
  nextSteps: ['Post on Indie Hackers'],
  openQuestions: ['Does this make the sharing flow feel safer?'],
  importantAssets: [],
  changelog: [],
  checkpoints: [],
  platformState: {},
  workflowMode: 'launch',
};

describe('public post quality', () => {
  it('down-ranks planning and bookkeeping signals', () => {
    expect(isLowValuePublicPostSignal('Prepared next step: Post on Indie Hackers')).toBe(true);
    expect(isLowValuePublicPostSignal('Last session summary updated')).toBe(true);
    expect(scorePublicPostSignal('Prepared next step: Post on Indie Hackers').score).toBe(0);
  });

  it('humanizes known launch-worthy updates into postable public summaries', () => {
    expect(humanizePublicPostSignal('Added Social Bridge composer links.'))
      .toBe('Added Social Bridge so generated content can be opened directly in X, LinkedIn, Reddit, and Facebook.');
    expect(humanizePublicPostSignal('Fixed OAuth session persistence.'))
      .toBe('Improved OAuth session persistence and sign-in reliability.');
  });

  it('prefers what was built over next-step planning notes', () => {
    const context = getPublicPostContext({
      ...project,
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
    });

    expect(context.primaryUpdate)
      .toBe('Added Social Bridge so generated content can be opened directly in X, LinkedIn, Reddit, and Facebook.');
    expect(context.highlights).not.toContain('Prepared next step: Post on Indie Hackers');
  });

  it('turns auth maintenance into a public trust/reliability update', () => {
    const context = getPublicPostContext({
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
    });

    expect(context.primaryUpdate).toBe('Improved OAuth session persistence and sign-in reliability.');
    expect(context.highlights).not.toContain('Last session summary updated');
  });
});
