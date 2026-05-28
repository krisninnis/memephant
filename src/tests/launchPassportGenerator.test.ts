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
});
