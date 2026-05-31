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

  it('does not label project positioning as shipped progress', () => {
    const passport = generateLaunchPassport({
      ...project,
      summary: 'Move your project between AI tools without ever rebuilding context.',
      currentState: 'Project updated.',
      changelog: [
        {
          timestamp: '2026-05-29T09:00:00.000Z',
          field: 'session',
          action: 'updated',
          summary: 'Last session summary updated',
        },
      ],
    }, '2026-05-29T12:00:00.000Z');

    const showHn = passport.sections.find((section) => section.id === 'showHn');

    expect(passport.progressWarning).toBe('Recent progress may be limited because no meaningful shipped updates were found.');
    expect(showHn?.content).toContain('No recent shipped updates found yet.');
    expect(showHn?.content).toContain('Add what changed recently to generate better posts.');
    expect(showHn?.content).toContain('Tell Memephant what changed recently');
    expect(showHn?.content).not.toContain('Recent progress may be limited because no meaningful shipped updates were found.');
    expect(showHn?.content).not.toContain('What shipped: Move your project between AI tools without ever rebuilding context.');
    expect(showHn?.content).toContain('Show HN: Memephant Landing Page Refresh - Move your project between AI tools without ever rebuilding context.');
  });

  it('uses user-entered recent progress in Launch Kit shipped context', () => {
    const shippedToday = [
      'Added Launch Studio tabs.',
      'Improved modal scrolling.',
      'Added Social Bridge sharing actions.',
      'Polished app-wide spacing.',
    ].join('\n');
    const passport = generateLaunchPassport({
      ...project,
      summary: 'Move your project between AI tools without ever rebuilding context.',
      currentState: 'Project updated.',
      recentProgressNote: shippedToday,
      changelog: [],
    }, '2026-05-29T12:00:00.000Z');

    const showHn = passport.sections.find((section) => section.id === 'showHn');
    const founderStory = passport.sections.find((section) => section.id === 'founderStory');

    expect(passport.progressWarning).toBeNull();
    expect(passport.markdown).toContain('Added Launch Studio tabs.');
    expect(passport.markdown).toContain('Improved modal scrolling.');
    expect(passport.markdown).toContain('Added Social Bridge so generated content can be opened directly in X, LinkedIn, Reddit, and Facebook.');
    expect(showHn?.content).toContain('What shipped:');
    expect(showHn?.content).not.toContain('No recent shipped updates found yet.');
    expect(founderStory?.content).toContain('The latest visible progress:');
  });

  it('uses projectReason for founder story, Show HN, Reddit, and demo framing', () => {
    const projectReason =
      'I got tired of re-explaining the same project every time I switched between ChatGPT, Claude, Cursor, or Gemini.';
    const projectReasonFragment = projectReason.replace(/[.!?]+$/g, '');
    const passport = generateLaunchPassport({
      ...project,
      projectReason,
    }, '2026-05-29T12:00:00.000Z');

    const positioning = passport.sections.find((section) => section.id === 'positioning');
    const showHn = passport.sections.find((section) => section.id === 'showHn');
    const reddit = passport.sections.find((section) => section.id === 'reddit');
    const founderStory = passport.sections.find((section) => section.id === 'founderStory');
    const demo = passport.sections.find((section) => section.id === 'demoVideo');

    expect(positioning?.content).toContain(`Why it exists: ${projectReason}`);
    expect(showHn?.content).toContain(`I built this because ${projectReason}`);
    expect(reddit?.content).toContain(`I built Memephant Landing Page Refresh to solve this problem: ${projectReason}`);
    expect(founderStory?.content).toContain(`I built Memephant Landing Page Refresh because ${projectReason}`);
    expect(demo?.content).toContain(`state why it exists: ${projectReasonFragment}`);
  });

  it('does not use technical stack decisions as the Show HN reason', () => {
    const passport = generateLaunchPassport({
      ...project,
      summary: 'Move your project between AI tools without ever rebuilding context.',
      decisions: [
        { decision: 'Supabase used for backend and auth.' },
        { decision: 'Stripe planned for subscriptions.' },
      ],
    }, '2026-05-29T12:00:00.000Z');

    const showHn = passport.sections.find((section) => section.id === 'showHn');

    expect(showHn?.content).toContain(
      'I built this because Move your project between AI tools without ever rebuilding context.',
    );
    expect(showHn?.content).not.toContain('Supabase used for backend');
    expect(showHn?.content).not.toContain('Stripe planned for subscriptions');
  });

  it('does not treat goals as founder motivation when projectReason is missing', () => {
    const passport = generateLaunchPassport({
      ...project,
      summary: 'Move your project between AI tools without ever rebuilding context.',
      goals: ['Get first 10 beta users'],
      projectReason: undefined,
    }, '2026-05-29T12:00:00.000Z');

    const founderStory = passport.sections.find((section) => section.id === 'founderStory');

    expect(founderStory?.content).toContain(
      'I built Memephant Landing Page Refresh because Move your project between AI tools without ever rebuilding context.',
    );
    expect(founderStory?.content).not.toContain('because the project context kept pointing to the same need');
    expect(founderStory?.content).not.toContain('because Get first 10 beta users');
  });
});
