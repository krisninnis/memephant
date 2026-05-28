import { generateLaunchPassport } from '../utils/launchPassportGenerator';
import type { ProjectMemory } from '../types/memphant-types';

const project: ProjectMemory = {
  schema_version: '1.2.0',
  id: 'launch-passport-project',
  name: 'Memephant Landing Page Refresh',
  summary: 'Help visitors understand Context Passport in under 30 seconds.',
  currentState: 'Hero copy is drafted and the demo flow is ready.',
  goals: ['Explain cross-AI continuity clearly', 'Convert first-time visitors into demo users'],
  rules: ['Keep launch copy honest'],
  decisions: [
    {
      decision: 'Use Context Passport as the flagship export name.',
      rationale: 'It describes project portability better than memory.',
    },
  ],
  nextSteps: ['Record a 45-second demo video', 'Ask first users where the value becomes clear'],
  openQuestions: ['Does the landing page make local-first behavior obvious?'],
  importantAssets: ['C:\\Users\\kris\\memephant\\public\\og-image.png'],
  aiInstructions: 'Use plain language and avoid hype.',
  changelog: [],
  checkpoints: [],
  platformState: {},
};

describe('generateLaunchPassport', () => {
  it('generates deterministic launch sections from project context', () => {
    const passport = generateLaunchPassport(project, '2026-05-28T12:00:00.000Z');

    expect(passport.projectName).toBe('Memephant Landing Page Refresh');
    expect(passport.generatedAt).toBe('2026-05-28T12:00:00.000Z');
    expect(passport.sections).toHaveLength(10);
    expect(passport.markdown).toContain('# Launch Passport: Memephant Landing Page Refresh');
    expect(passport.markdown).toContain('## X/Twitter launch post');
    expect(passport.markdown).toContain('Help visitors understand Context Passport in under 30 seconds.');
    expect(passport.markdown).toContain('Record a 45-second demo video');
  });

  it('keeps launch-facing assets public by removing local folder paths', () => {
    const passport = generateLaunchPassport(project, '2026-05-28T12:00:00.000Z');

    expect(passport.markdown).toContain('Relevant asset visible: og-image.png');
    expect(passport.markdown).not.toContain('C:\\Users\\kris');
  });

  it('redacts obvious secret patterns from launch copy', () => {
    const passport = generateLaunchPassport({
      ...project,
      summary: 'Launch copy with api_key=secret-123 should stay safe.',
    }, '2026-05-28T12:00:00.000Z');

    expect(passport.markdown).toContain('[redacted]');
    expect(passport.markdown).not.toContain('secret-123');
  });

  it('filters placeholder scaffolding from launch-facing drafts', () => {
    const passport = generateLaunchPassport({
      ...project,
      summary: 'Write 1-2 sentences describing what is true right now after this session.',
      goals: [
        'What is the top priority for this project?',
        'Show serious AI users how Context Passport works',
      ],
      nextSteps: [
        'List the immediate next actions that should happen after this session',
        'Record a handoff demo clip',
      ],
      decisions: [
        {
          decision: 'Only include genuinely new decisions made this session',
        },
        {
          decision: 'Keep Context Passport as the main demo moment.',
        },
      ],
    }, '2026-05-28T12:00:00.000Z');

    expect(passport.markdown).not.toContain('Write 1-2 sentences');
    expect(passport.markdown).not.toContain('What is the top priority');
    expect(passport.markdown).not.toContain('List the immediate next actions');
    expect(passport.markdown).not.toContain('Only include genuinely new decisions');
    expect(passport.markdown).toContain('Show serious AI users how Context Passport works');
    expect(passport.markdown).toContain('Record a handoff demo clip');
    expect(passport.markdown).toContain('Keep Context Passport as the main demo moment.');
  });

  it('adds a content quality warning when positioning context is weak', () => {
    const passport = generateLaunchPassport({
      ...project,
      summary: 'Write 1-2 sentences describing what is true right now after this session.',
    }, '2026-05-28T12:00:00.000Z');

    expect(passport.qualityWarning).toBe('Content quality may be limited because the project summary is incomplete.');
    expect(passport.markdown).toContain('> Content quality may be limited because the project summary is incomplete.');
  });

  it('uses shipping highlights in launch context instead of AI bookkeeping', () => {
    const passport = generateLaunchPassport({
      ...project,
      changelog: [
        {
          timestamp: '2026-05-28T09:00:00.000Z',
          field: 'general',
          action: 'updated',
          summary: '7 items added by AI',
        },
        {
          timestamp: '2026-05-28T10:00:00.000Z',
          field: 'launch',
          action: 'added',
          summary: 'Created Daily Content Pack generation.',
        },
      ],
    }, '2026-05-28T12:00:00.000Z');

    expect(passport.markdown).not.toContain('7 items added by AI');
    expect(passport.markdown).toContain('Added Daily Content Pack generation');
    expect(passport.markdown).toContain('Shipped: Added Daily Content Pack generation');
  });
});
