/**
 * passportGenerator.test.ts
 *
 * Focused safety tests for generateContextPassport:
 *   1. All four formats are produced
 *   2. Secrets are redacted in every format
 *   3. linkedFolder.path never appears in any format
 *   4. No memphant_update / RESPONSE_FORMAT instructions appended
 *   5. Project data is never mutated
 *   6. Required sections are present in every format
 */

import { generateContextPassport } from '../utils/passportGenerator';
import type { ProjectMemory } from '../types/memphant-types';

// ─── Test Secret Builders ─────────────────────────────────────────────────────
// Build fake secret-looking values at runtime so GitHub push protection does not
// see literal tokens in the committed source. These are not real credentials.

const FAKE_OPENAI_KEY = ['sk', 'abcdefghijklmnopqrstuvwxyz123456'].join('-');
const FAKE_AWS_KEY = ['AKIA', 'IOSFODNN7EXAMPLE'].join('');
const FAKE_GITHUB_TOKEN = ['ghp', 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij'].join('_');
const FAKE_SLACK_TOKEN = ['xoxb', '1234567890', 'abcdefghijklmnop'].join('-');
const FAKE_STRIPE_KEY = ['sk', 'live', 'ABCDEFGHIJKLMNOPQRSTUVWX'].join('_');
const FAKE_JWT = [
  ['eyJ', 'hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'].join(''),
  ['eyJ', 'zdWIiOiJ1c2VyMTIzIn0'].join(''),
  'sig',
].join('.');

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** A realistic project containing secrets and a local path. */
const SECRET_PROJECT: ProjectMemory = {
  id: 'test-passport-001',
  name: 'Secret Test Project',
  summary: `OpenAI key ${FAKE_OPENAI_KEY} should be redacted.`,
  currentState: 'Stored locally at C:\\Users\\kris\\repos\\memphant',
  goals: [
    'Ship v2',
    `AWS key ${FAKE_AWS_KEY} must not leak`,
    `GitHub token ${FAKE_GITHUB_TOKEN} must not leak`,
  ],
  rules: ['Never commit secrets', `Slack ${FAKE_SLACK_TOKEN} to git`],
  decisions: [
    {
      decision: 'Use Supabase',
      rationale: `JWT ${FAKE_JWT} cheaper`,
    },
  ],
  importantAssets: ['C:\\Users\\kris\\repos\\memphant\\src\\App.tsx'],
  openQuestions: ['Which CI should we use?'],
  nextSteps: ['Deploy to prod'],
  changelog: [
    {
      field: 'goals',
      action: 'added',
      summary: 'Added shipping goal',
      timestamp: '2026-05-01T10:00:00Z',
    },
  ],
  linkedFolder: { path: 'C:\\Users\\kris\\repos\\memphant' },
  lastSessionSummary: `Reviewed ${FAKE_STRIPE_KEY} stripe key issues`,
  inProgress: ['Fixing the auth bug'],
  schema_version: '1.1.0',
  checkpoints: [],
  platformState: {},
};

/** A minimal project with no secrets and no linked folder. */
const CLEAN_PROJECT: ProjectMemory = {
  id: 'test-passport-002',
  name: 'Clean Project',
  summary: 'A project with no secrets.',
  currentState: 'Working on features',
  goals: ['Launch MVP'],
  rules: ['Keep it simple'],
  decisions: [{ decision: 'React frontend', rationale: 'Team knows it' }],
  importantAssets: [],
  openQuestions: [],
  nextSteps: ['Write docs'],
  changelog: [],
  inProgress: [],
  schema_version: '1.1.0',
  checkpoints: [],
  platformState: {},
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function allFormats(passport: ReturnType<typeof generateContextPassport>) {
  return Object.values(passport.formats) as string[];
}

function everyFormat(
  passport: ReturnType<typeof generateContextPassport>,
  predicate: (text: string) => boolean,
): boolean {
  return allFormats(passport).every(predicate);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('generateContextPassport — structure', () => {
  it('produces all four formats', () => {
    const passport = generateContextPassport(CLEAN_PROJECT);
    expect(passport.formats.markdown).toBeTruthy();
    expect(passport.formats.chatgpt).toBeTruthy();
    expect(passport.formats.claude).toBeTruthy();
    expect(passport.formats.codex).toBeTruthy();
  });

  it('includes the project name in every format', () => {
    const passport = generateContextPassport(CLEAN_PROJECT);
    expect(everyFormat(passport, (t) => t.includes('Clean Project'))).toBe(true);
  });

  it('includes projectId and projectName at the top level', () => {
    const passport = generateContextPassport(CLEAN_PROJECT);
    expect(passport.projectId).toBe('test-passport-002');
    expect(passport.projectName).toBe('Clean Project');
  });

  it('includes generatedAt timestamp', () => {
    const passport = generateContextPassport(CLEAN_PROJECT);
    expect(passport.generatedAt).toBeTruthy();
    expect(typeof passport.generatedAt).toBe('string');
  });

  it('includes required sections in Markdown format', () => {
    const passport = generateContextPassport(CLEAN_PROJECT);
    const md = passport.formats.markdown;
    expect(md).toContain('# Memory Trail: Clean Project');
    expect(md).not.toContain('Context Passport');
    expect(md).toContain('## Purpose');
    expect(md).toContain('## Current State');
    expect(md).toContain('## Goals');
    expect(md).toContain('## Rules to Follow');
  });

  it('includes required sections in Claude XML format', () => {
    const passport = generateContextPassport(CLEAN_PROJECT);
    const claude = passport.formats.claude;
    expect(claude).toContain('<memory_trail>');
    expect(claude).toContain('</memory_trail>');
    expect(claude).toContain('<purpose>');
    expect(claude).toContain('<goals>');
    expect(claude).toContain('<rules>');
  });

  it('includes required sections in Codex format', () => {
    const passport = generateContextPassport(CLEAN_PROJECT);
    const codex = passport.formats.codex;
    expect(codex).toContain('STATUS:');
    expect(codex).toContain('GOALS:');
    expect(codex).toContain('RULES:');
  });

  it('includes changelog entries when present', () => {
    const passport = generateContextPassport(SECRET_PROJECT);
    expect(everyFormat(passport, (t) => t.includes('2026-05-01'))).toBe(true);
  });

  it('includes inProgress items when present', () => {
    const passport = generateContextPassport(SECRET_PROJECT);
    expect(everyFormat(passport, (t) => t.includes('Fixing the auth bug'))).toBe(true);
  });
});

describe('generateContextPassport — secret redaction', () => {
  let passport: ReturnType<typeof generateContextPassport>;

  beforeEach(() => {
    passport = generateContextPassport(SECRET_PROJECT);
  });

  it('redacts OpenAI sk- keys in all formats', () => {
    expect(everyFormat(passport, (t) => !t.includes(FAKE_OPENAI_KEY))).toBe(true);
  });

  it('redacts AWS AKIA keys in all formats', () => {
    expect(everyFormat(passport, (t) => !t.includes(FAKE_AWS_KEY))).toBe(true);
  });

  it('redacts GitHub ghp_ tokens in all formats', () => {
    expect(everyFormat(passport, (t) => !t.includes(FAKE_GITHUB_TOKEN))).toBe(true);
  });

  it('redacts Slack xoxb tokens in all formats', () => {
    expect(everyFormat(passport, (t) => !t.includes(FAKE_SLACK_TOKEN))).toBe(true);
  });

  it('redacts Stripe sk_live_ keys in all formats', () => {
    expect(everyFormat(passport, (t) => !t.includes(FAKE_STRIPE_KEY))).toBe(true);
  });

  it('redacts JWT-like values in all formats', () => {
    expect(everyFormat(passport, (t) => !t.includes(FAKE_JWT))).toBe(true);
  });

  it('replaces secrets with [REDACTED] placeholder in all formats', () => {
    expect(everyFormat(passport, (t) => t.includes('[REDACTED]'))).toBe(true);
  });
});

describe('generateContextPassport — local path exclusion', () => {
  it('never includes linkedFolder.path in any format', () => {
    const passport = generateContextPassport(SECRET_PROJECT);
    const folderPath = 'C:\\Users\\kris\\repos\\memphant';
    expect(everyFormat(passport, (t) => !t.includes(folderPath))).toBe(true);
  });

  it('never includes forward-slash variant of folder path', () => {
    const passport = generateContextPassport(SECRET_PROJECT);
    expect(everyFormat(passport, (t) => !t.includes('C:/Users/kris/repos/memphant'))).toBe(true);
  });

  it('does not fail when linkedFolder is undefined', () => {
    const passport = generateContextPassport(CLEAN_PROJECT);
    expect(() => allFormats(passport)).not.toThrow();
  });
});

describe('generateContextPassport — AI instruction safety', () => {
  it('does not append memphant_update instructions in any format', () => {
    const passport = generateContextPassport(SECRET_PROJECT);
    expect(everyFormat(passport, (t) => !t.includes('memphant_update'))).toBe(true);
  });

  it('does not append RESPONSE_FORMAT instructions in any format', () => {
    const passport = generateContextPassport(SECRET_PROJECT);
    expect(everyFormat(passport, (t) => !t.includes('RESPONSE_FORMAT'))).toBe(true);
  });

  it('does not include schemaVersion instructions in any format', () => {
    const passport = generateContextPassport(SECRET_PROJECT);
    expect(everyFormat(passport, (t) => !t.includes('schemaVersion'))).toBe(true);
  });
});

describe('generateContextPassport — immutability', () => {
  it('does not mutate the project object', () => {
    const original = JSON.stringify(SECRET_PROJECT);
    generateContextPassport(SECRET_PROJECT);
    expect(JSON.stringify(SECRET_PROJECT)).toBe(original);
  });

  it('returns a new passport object on each call', () => {
    const p1 = generateContextPassport(CLEAN_PROJECT);
    const p2 = generateContextPassport(CLEAN_PROJECT);
    expect(p1).not.toBe(p2);
    expect(p1.formats).not.toBe(p2.formats);
  });

  it('does not throw on a project with all empty arrays', () => {
    const empty: ProjectMemory = {
      id: 'empty',
      name: 'Empty',
      summary: '',
      currentState: '',
      goals: [],
      rules: [],
      decisions: [],
      importantAssets: [],
      openQuestions: [],
      nextSteps: [],
      changelog: [],
      inProgress: [],
      schema_version: '1.1.0',
      checkpoints: [],
      platformState: {},
    };

    expect(() => generateContextPassport(empty)).not.toThrow();
  });
});
// ─── Custom Platform Tests ────────────────────────────────────────────────────

import { generateCustomPassportText, type CustomPlatform } from '../utils/passportGenerator';

/** Reusable custom platform base */
const GROK_PLATFORM: CustomPlatform = {
  id: 'custom_111',
  name: 'Grok',
  baseFormat: 'markdown',
  customInstruction: 'Focus on the architecture.',
  includeFiles: true,
  includeRecentChanges: true,
};

describe('generateCustomPassportText — structure', () => {
  it('produces output for all four base formats', () => {
    const formats: CustomPlatform['baseFormat'][] = [
      'markdown', 'xml-like', 'compact', 'developer-brief',
    ];
    for (const baseFormat of formats) {
      const platform = { ...GROK_PLATFORM, baseFormat };
      const text = generateCustomPassportText(CLEAN_PROJECT, platform);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it('includes the platform name in the output', () => {
    const text = generateCustomPassportText(CLEAN_PROJECT, GROK_PLATFORM);
    expect(text).toContain('Grok');
  });

  it('includes the project name in the output', () => {
    const text = generateCustomPassportText(CLEAN_PROJECT, GROK_PLATFORM);
    expect(text).toContain('Clean Project');
  });

  it('includes the custom instruction in the output', () => {
    const text = generateCustomPassportText(CLEAN_PROJECT, GROK_PLATFORM);
    expect(text).toContain('Focus on the architecture.');
  });

  it('does NOT include custom instruction when it is empty', () => {
    const platform = { ...GROK_PLATFORM, customInstruction: '' };
    const text = generateCustomPassportText(CLEAN_PROJECT, platform);
    // No extra separator or instruction section should be added
    expect(text).not.toContain('NOTE:');
  });

  it('omits important files section when includeFiles is false', () => {
    const projectWithFiles: ProjectMemory = {
      ...CLEAN_PROJECT,
      importantAssets: ['src/App.tsx', 'src/main.tsx'],
    };
    const platform = { ...GROK_PLATFORM, includeFiles: false };
    const text = generateCustomPassportText(projectWithFiles, platform);
    expect(text).not.toContain('src/App.tsx');
  });

  it('includes important files section when includeFiles is true and assets exist', () => {
    const projectWithFiles: ProjectMemory = {
      ...CLEAN_PROJECT,
      importantAssets: ['src/App.tsx'],
    };
    const platform = { ...GROK_PLATFORM, includeFiles: true };
    const text = generateCustomPassportText(projectWithFiles, platform);
    expect(text).toContain('src/App.tsx');
  });

  it('omits recent changes section when includeRecentChanges is false', () => {
    const projectWithChangelog: ProjectMemory = {
      ...CLEAN_PROJECT,
      changelog: [
        { field: 'goals', action: 'added', summary: 'Added new goal', timestamp: '2026-05-01T10:00:00Z' },
      ],
    };
    const platform = { ...GROK_PLATFORM, includeRecentChanges: false };
    const text = generateCustomPassportText(projectWithChangelog, platform);
    expect(text).not.toContain('Added new goal');
  });

  it('includes recent changes when includeRecentChanges is true and changelog exists', () => {
    const projectWithChangelog: ProjectMemory = {
      ...CLEAN_PROJECT,
      changelog: [
        { field: 'goals', action: 'added', summary: 'Added new goal', timestamp: '2026-05-01T10:00:00Z' },
      ],
    };
    const platform = { ...GROK_PLATFORM, includeRecentChanges: true };
    const text = generateCustomPassportText(projectWithChangelog, platform);
    expect(text).toContain('Added new goal');
  });
});

describe('generateCustomPassportText — format variants', () => {
  it('xml-like format wraps output in memory_trail tag', () => {
    const platform = { ...GROK_PLATFORM, baseFormat: 'xml-like' as const };
    const text = generateCustomPassportText(CLEAN_PROJECT, platform);
    expect(text).toContain('<memory_trail');
    expect(text).toContain('</memory_trail>');
  });

  it('xml-like format includes platform name as attribute', () => {
    const platform = { ...GROK_PLATFORM, baseFormat: 'xml-like' as const };
    const text = generateCustomPassportText(CLEAN_PROJECT, platform);
    expect(text).toContain('platform="Grok"');
  });

  it('compact format uses KEY: VALUE style', () => {
    const platform = { ...GROK_PLATFORM, baseFormat: 'compact' as const };
    const text = generateCustomPassportText(CLEAN_PROJECT, platform);
    expect(text).toContain('PLATFORM:');
    expect(text).toContain('PROJECT:');
    expect(text).toContain('STATE:');
  });

  it('developer-brief format includes status and decisions sections', () => {
    const platform = { ...GROK_PLATFORM, baseFormat: 'developer-brief' as const };
    const text = generateCustomPassportText(CLEAN_PROJECT, platform);
    expect(text).toContain('**Status:**');
    expect(text).toContain('**Decisions:**');
  });

  it('markdown format includes section headers', () => {
    const platform = { ...GROK_PLATFORM, baseFormat: 'markdown' as const };
    const text = generateCustomPassportText(CLEAN_PROJECT, platform);
    expect(text).toContain('## Current State');
    expect(text).toContain('## Goals');
  });
});

describe('generateCustomPassportText — safety', () => {
  it('redacts secrets in all four base formats', () => {
    const formats: CustomPlatform['baseFormat'][] = [
      'markdown', 'xml-like', 'compact', 'developer-brief',
    ];
    for (const baseFormat of formats) {
      const platform = { ...GROK_PLATFORM, baseFormat };
      const text = generateCustomPassportText(SECRET_PROJECT, platform);
      expect(text).not.toContain(FAKE_OPENAI_KEY);
      expect(text).not.toContain(FAKE_AWS_KEY);
      expect(text).not.toContain(FAKE_GITHUB_TOKEN);
      expect(text).not.toContain(FAKE_SLACK_TOKEN);
    }
  });

 it('never includes linkedFolder.path in any base format', () => {
  const formats: CustomPlatform['baseFormat'][] = [
    'markdown', 'xml-like', 'compact', 'developer-brief',
  ];
  const folderPath = 'C:\\Users\\kris\\repos\\memphant';
  const forwardSlashPath = 'C:/Users/kris/repos/memphant';

  for (const baseFormat of formats) {
    const platform = { ...GROK_PLATFORM, baseFormat };
    const text = generateCustomPassportText(SECRET_PROJECT, platform);
    expect(text).not.toContain(folderPath);
    expect(text).not.toContain(forwardSlashPath);
  }
});

  it('sanitizes a secret in a custom instruction', () => {
    const platform: CustomPlatform = {
      ...GROK_PLATFORM,
      customInstruction: `Use this key: ${FAKE_OPENAI_KEY}`,
    };
    const text = generateCustomPassportText(CLEAN_PROJECT, platform);
    expect(text).not.toContain(FAKE_OPENAI_KEY);
    expect(text).toContain('[REDACTED]');
  });

  it('does not append memphant_update in any format', () => {
    const formats: CustomPlatform['baseFormat'][] = [
      'markdown', 'xml-like', 'compact', 'developer-brief',
    ];
    for (const baseFormat of formats) {
      const platform = { ...GROK_PLATFORM, baseFormat };
      const text = generateCustomPassportText(CLEAN_PROJECT, platform);
      expect(text).not.toContain('memphant_update');
      expect(text).not.toContain('RESPONSE_FORMAT');
    }
  });

  it('does not mutate the project object', () => {
    const before = JSON.stringify(SECRET_PROJECT);
    generateCustomPassportText(SECRET_PROJECT, GROK_PLATFORM);
    expect(JSON.stringify(SECRET_PROJECT)).toBe(before);
  });

  it('does not throw on a project with all empty arrays', () => {
    const empty: ProjectMemory = {
      id: 'empty2',
      name: 'Empty2',
      summary: '',
      currentState: '',
      goals: [],
      rules: [],
      decisions: [],
      importantAssets: [],
      openQuestions: [],
      nextSteps: [],
      changelog: [],
      inProgress: [],
      schema_version: '1.1.0',
      checkpoints: [],
      platformState: {},
    };
    const formats: CustomPlatform['baseFormat'][] = [
      'markdown', 'xml-like', 'compact', 'developer-brief',
    ];
    for (const baseFormat of formats) {
      const platform = { ...GROK_PLATFORM, baseFormat };
      expect(() => generateCustomPassportText(empty, platform)).not.toThrow();
    }
  });
});
