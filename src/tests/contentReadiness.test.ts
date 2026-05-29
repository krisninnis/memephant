import {
  evaluateContentReadiness,
  getContentQualityWarning,
} from '../utils/contentReadiness';
import type { ProjectMemory } from '../types/memphant-types';

const strongProject: ProjectMemory = {
  schema_version: '1.2.0',
  id: 'strong-content-project',
  name: 'Memephant Launch Studio',
  summary: 'Memephant helps solo founders and AI-heavy teams turn local project memory into clear launch content without posting automation.',
  currentState: 'Shipped the deterministic Daily Content Pack preview and tested the copy-only export flow.',
  goals: ['Help 20 beta users create one useful launch post per day', 'Reduce repeated project explanation during launch prep'],
  rules: ['Keep launch copy honest'],
  decisions: [
    {
      decision: 'Keep content generation local-first and copy-only instead of adding posting APIs.',
    },
  ],
  nextSteps: ['Ask early users which post format saves the most time'],
  openQuestions: ['Which daily post format saves the most time?'],
  importantAssets: [],
  inProgress: ['Building Content Readiness checks for launch positioning'],
  changelog: [
    {
      timestamp: '2026-05-28T10:00:00.000Z',
      field: 'launch',
      action: 'added',
      summary: 'Shipped deterministic content pack preview.',
    },
  ],
  checkpoints: [],
  platformState: {},
  workflowMode: 'launch',
};

describe('content readiness', () => {
  it('scores strong positioning higher and explains strengths', () => {
    const report = evaluateContentReadiness(strongProject);

    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(report.warning).toBeNull();
    expect(report.strengths.join(' ')).toContain('Who this is for');
    expect(report.strengths.join(' ')).toContain('Recent visible progress');
    expect(report.suggestedImprovements).not.toContain('Replace placeholder setup text.');
  });

  it('flags placeholder summaries and missing positioning signals', () => {
    const report = evaluateContentReadiness({
      ...strongProject,
      summary: 'Write 1-2 sentences describing what is true right now after this session.',
      currentState: '',
      goals: ['Make the project better', 'Make the project better'],
      decisions: [],
      nextSteps: [],
      openQuestions: [],
      inProgress: [],
      changelog: [],
      workflowMode: undefined,
    });

    expect(report.score).toBeLessThan(50);
    expect(report.warning).toBe('Content quality may be limited because the project summary is incomplete.');
    expect(report.missingSignals).toEqual(expect.arrayContaining([
      'Who this is for',
      'Frustrating problem',
      'Clear project summary',
    ]));
    expect(report.suggestedImprovements).toEqual(expect.arrayContaining([
      'Describe who this is for.',
      'Describe the frustrating problem this solves.',
      'Replace placeholder setup text.',
      'Your goals are broad; make one measurable.',
    ]));
  });

  it('detects repeated low-signal phrases', () => {
    const report = evaluateContentReadiness({
      ...strongProject,
      summary: 'Make the project better for users.',
      currentState: 'Make the project better.',
      goals: ['Make the project better'],
    });

    const repetition = report.signals.find((signal) => signal.id === 'lowSignalRepetition');

    expect(repetition?.status).not.toBe('strong');
    expect(repetition?.evidence).toContain('Repeated phrase');
  });

  it('returns a compact warning for weak audience context', () => {
    const warning = getContentQualityWarning({
      ...strongProject,
      summary: 'A deterministic local content tool with clear exports and launch drafts.',
      goals: ['Create one useful launch draft per day'],
      decisions: [],
      nextSteps: ['Improve the launch draft'],
      openQuestions: ['Which format is clearest?'],
      workflowMode: 'launch',
    });

    expect(warning).toBe("Content quality may be limited because we don't yet know who this project is for.");
  });

  it('recognises emotional pain and continuity outcomes in positioning', () => {
    const report = evaluateContentReadiness({
      ...strongProject,
      summary: 'Memephant helps AI builders move your project between AI tools without ever rebuilding context or losing momentum.',
      currentState: 'Launch Studio content generation is ready for demo feedback.',
      goals: ['Help 20 builders keep continuity across AI tools'],
      decisions: [
        {
          decision: 'Prioritise cross-AI continuity so users stop repeating yourself to every AI.',
        },
      ],
      workflowMode: 'launch',
    });

    const problem = report.signals.find((signal) => signal.id === 'problemStatement');
    const outcome = report.signals.find((signal) => signal.id === 'outcomeStatement');

    expect(problem?.status).toBe('strong');
    expect(problem?.evidence).toBe('The frustrating problem feels concrete.');
    expect(outcome?.status).toBe('strong');
    expect(report.score).toBeGreaterThanOrEqual(85);
  });
});
