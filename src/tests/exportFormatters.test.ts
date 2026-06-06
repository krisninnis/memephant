/**
 * Tests for exportFormatters.ts
 * Covers: secret sanitisation, platform formatting, smart export.
 */

import {
  formatForClaudeWithManifest,
  formatForPlatform,
  setScannerLevel,
} from '../utils/exportFormatters';
import type { ProjectMemory } from '../types/memphant-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<ProjectMemory> = {}): ProjectMemory {
  return {
    schema_version: 1,
    id: 'test_project',
    name: 'My SaaS App',
    summary: 'A SaaS product for project context management.',
    goals: ['Launch MVP', 'Get first 10 customers'],
    rules: ['Ship fast', 'Talk to users weekly'],
    decisions: [
      { decision: 'Use Tauri for desktop', rationale: 'Small bundle, native performance' },
    ],
    currentState: 'Pre-launch. MVP is 80% done.',
    nextSteps: ['Set up Stripe', 'Write landing page copy'],
    openQuestions: ['What pricing model?'],
    importantAssets: ['src/main.ts', 'src/store.ts'],
    aiInstructions: 'Help me think like a product founder.',
    changelog: [
      {
        timestamp: new Date().toISOString(),
        field: 'general',
        action: 'added',
        summary: 'Project created',
        source: 'app',
      },
    ],
    checkpoints: [],
    platformState: {},
    ...overrides,
  };
}

function joinParts(...parts: string[]): string {
  return parts.join('');
}

// Build secret-like strings at runtime so GitHub push protection
// does not flag the repository contents themselves.
function makeOpenAiKey(): string {
  return joinParts('sk-', 'AbCdEfGhIjKlMnOpQrStUv1234567890');
}

function makeAnthropicKey(): string {
  return joinParts(
    'sk-ant-api03-',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz012345',
  );
}

function makeGitHubToken(): string {
  return joinParts('ghp_', 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij');
}

function makeJwtToken(): string {
  return joinParts('eyJ', 'hbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig');
}

function makeStripeLiveKey(): string {
  return joinParts('sk', '_live_', '1234567890abcdefghijklmnop');
}

function makeGoogleApiKey(): string {
  return joinParts('AIza', 'SyABCDEFGHIJKLMNOPQRSTUVWXYZ12345678');
}

function makeHuggingFaceToken(): string {
  return joinParts('hf_', '1234567890abcdefghijklmnopqrstuv');
}

function makeSlackUserToken(): string {
  return joinParts('xoxp-', '123456789012-123456789012-abcdefghijklmnop');
}

function makeSendGridKey(): string {
  return joinParts(
    'SG.',
    'ABCDEFGHIJKLMNOPQRSTU',
    '.',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq',
  );
}

// ─── Secret sanitisation ──────────────────────────────────────────────────────

describe('secret sanitisation', () => {
  beforeEach(() => setScannerLevel('standard'));

  it('redacts OpenAI API keys in summary', () => {
    const secret = makeOpenAiKey();
    const project = makeProject({ summary: `Key: ${secret}` });
    const output = formatForPlatform(project, 'claude');
    expect(output).not.toContain(secret);
    expect(output).toContain('[REDACTED]');
  });

  it('redacts AWS access keys', () => {
    const secret = 'AKIAIOSFODNN7EXAMPLE';
    const project = makeProject({ currentState: `Using ${secret} in prod` });
    const output = formatForPlatform(project, 'chatgpt');
    expect(output).not.toContain(secret);
    expect(output).toContain('[REDACTED]');
  });

  it('redacts GitHub tokens', () => {
    const secret = makeGitHubToken();
    const project = makeProject({
      nextSteps: [`${secret} is the token`],
    });
    const output = formatForPlatform(project, 'gemini');
    expect(output).not.toContain(secret);
    expect(output).toContain('[REDACTED]');
  });

  it('redacts JWT tokens', () => {
    const secret = makeJwtToken();
    const project = makeProject({
      aiInstructions: `Bearer ${secret}`,
    });
    const output = formatForPlatform(project, 'claude');
    expect(output).not.toContain(secret);
    expect(output).toContain('[REDACTED]');
  });

  it('does not redact normal content', () => {
    const project = makeProject();
    const output = formatForPlatform(project, 'claude');
    expect(output).toContain('My SaaS App');
    expect(output).toContain('Launch MVP');
    expect(output).not.toContain('[REDACTED]');
  });

  it('redacts Anthropic API keys', () => {
    const secret = makeAnthropicKey();
    const project = makeProject({
      summary: `Key is ${secret}`,
    });
    const output = formatForPlatform(project, 'claude');
    expect(output).not.toContain(secret);
    expect(output).toContain('[REDACTED]');
  });

  it('redacts Stripe live secret keys', () => {
    const secret = makeStripeLiveKey();
    const project = makeProject({
      currentState: `Stripe key: ${secret}`,
    });
    const output = formatForPlatform(project, 'chatgpt');
    expect(output).not.toContain(secret);
    expect(output).toContain('[REDACTED]');
  });

  it('redacts Google API keys', () => {
    const secret = makeGoogleApiKey();
    const project = makeProject({
      aiInstructions: `Use ${secret} for Maps`,
    });
    const output = formatForPlatform(project, 'gemini');
    expect(output).not.toContain(secret);
    expect(output).toContain('[REDACTED]');
  });

  it('redacts HuggingFace tokens', () => {
    const secret = makeHuggingFaceToken();
    const project = makeProject({
      currentState: `HF token: ${secret}`,
    });
    const output = formatForPlatform(project, 'claude');
    expect(output).not.toContain(secret);
    expect(output).toContain('[REDACTED]');
  });

  it('redacts Slack user tokens', () => {
    const secret = makeSlackUserToken();
    const project = makeProject({
      currentState: `Slack user token: ${secret}`,
    });
    const output = formatForPlatform(project, 'claude');
    expect(output).not.toContain(secret);
    expect(output).toContain('[REDACTED]');
  });

  it('strict mode redacts database connection strings', () => {
    setScannerLevel('strict');
    const secret = 'postgres://user:pass@host:5432/mydb';
    const project = makeProject({
      currentState: `DB: ${secret}`,
    });
    const output = formatForPlatform(project, 'claude');
    expect(output).not.toContain(secret);
    expect(output).toContain('[REDACTED]');
    setScannerLevel('standard');
  });

  it('strict mode redacts SendGrid API keys', () => {
    setScannerLevel('strict');
    const secret = makeSendGridKey();
    const project = makeProject({
      currentState: secret,
    });
    const output = formatForPlatform(project, 'claude');
    expect(output).not.toContain(secret);
    expect(output).toContain('[REDACTED]');
    setScannerLevel('standard');
  });
});

// ─── Never includes linkedFolder path ─────────────────────────────────────────

describe('linkedFolder path exclusion', () => {
  it('never includes the linked folder path in any platform export', () => {
    const project = makeProject({
      linkedFolder: {
        path: '/Users/kris/secret/project-path',
        scanHash: 'abc',
        lastScannedAt: '',
      },
    });
    const platforms = ['claude', 'chatgpt', 'grok', 'perplexity', 'gemini', 'codex', 'cowork'] as const;
    for (const platform of platforms) {
      const output = formatForPlatform(project, platform);
      expect(output).not.toContain('/Users/kris/secret/project-path');
    }
  });
});

// ─── Platform-specific formatting ─────────────────────────────────────────────

describe('Memory Core export', () => {
  it('includes projectCharter in ChatGPT export when present', () => {
    const output = formatForPlatform(
      makeProject({ projectCharter: 'Prefer small safe changes and preview risky edits.' }),
      'chatgpt',
    );

    expect(output).toContain('## Memory Core');
    expect(output).toContain('Prefer small safe changes and preview risky edits.');
  });

  it('includes projectCharter in Claude export when present', () => {
    const output = formatForPlatform(
      makeProject({ projectCharter: 'Use careful, user-controlled AI collaboration.' }),
      'claude',
    );

    expect(output).toContain('<memory_core>');
    expect(output).toContain('Use careful, user-controlled AI collaboration.');
    expect(output).toContain('</memory_core>');
  });

  it('includes projectCharter in Codex export as AGENT_CHARTER', () => {
    const output = formatForPlatform(
      makeProject({ projectCharter: 'Inspect before editing and keep changes minimal.' }),
      'codex',
    );

    expect(output).toContain('AGENT_CHARTER:');
    expect(output).toContain('Inspect before editing and keep changes minimal.');
    expect(output).toContain('Follow this project charter unless the user explicitly overrides it.');
  });

  it('includes projectCharter in Cowork export as AGENT_CHARTER', () => {
    const output = formatForPlatform(
      makeProject({ projectCharter: 'Preserve continuity and call out architecture risks.' }),
      'cowork',
    );

    expect(output).toContain('AGENT_CHARTER:');
    expect(output).toContain('Preserve continuity and call out architecture risks.');
    expect(output).toContain('Follow this project charter unless the user explicitly overrides it.');
  });

  it('omits Memory Core sections when projectCharter is empty', () => {
    const platforms = ['claude', 'chatgpt', 'grok', 'perplexity', 'gemini', 'codex', 'cowork'] as const;

    for (const platform of platforms) {
      const output = formatForPlatform(makeProject({ projectCharter: '' }), platform);
      expect(output).not.toContain('Memory Core');
      expect(output).not.toContain('<memory_core>');
      expect(output).not.toContain('MEMORY_CORE');
      expect(output).not.toContain('AGENT_CHARTER');
    }
  });

  it('redacts secrets inside projectCharter', () => {
    const secret = makeOpenAiKey();
    const output = formatForPlatform(
      makeProject({ projectCharter: `Never expose ${secret}` }),
      'chatgpt',
    );

    expect(output).not.toContain(secret);
    expect(output).toContain('[REDACTED]');
  });

  it('redacts linkedFolder.path inside projectCharter', () => {
    const linkedPath = 'C:\\Users\\kris\\private\\memephant';
    const output = formatForPlatform(
      makeProject({
        projectCharter: `Do not expose ${linkedPath}`,
        linkedFolder: {
          path: linkedPath,
          scanHash: 'abc',
          lastScannedAt: '',
        },
      }),
      'codex',
    );

    expect(output).not.toContain(linkedPath);
    expect(output).toContain('[REDACTED]');
  });
});

describe('claude format', () => {
  it('wraps content in XML tags', () => {
    const output = formatForPlatform(makeProject(), 'claude');
    expect(output).toContain('<project_context>');
    expect(output).toContain('</project_context>');
    expect(output).toContain('<name>');
    expect(output).toContain('<goals>');
  });

  it('includes the task when provided', () => {
    const output = formatForPlatform(makeProject(), 'claude', 'Write the onboarding copy');
    expect(output).toContain('Write the onboarding copy');
    expect(output).toContain('<task>');
  });

  it('includes AI instructions', () => {
    const output = formatForPlatform(makeProject(), 'claude');
    expect(output).toContain('Help me think like a product founder.');
  });

  it('includes the response format prompt', () => {
    const output = formatForPlatform(makeProject(), 'claude');
    expect(output).toContain('memphant_update');
  });

  it('adds manifest text and guidance only in the explicit Claude manifest formatter', () => {
    const project = makeProject();
    const standard = formatForPlatform(project, 'claude');
    const withManifest = formatForClaudeWithManifest(
      project,
      'state_digest: sha256:abc123\n- id: G-001',
      'sha256:abc123',
      'Keep the launch plan grounded',
    );

    expect(standard).not.toContain('<vcp_state_manifest>');
    expect(withManifest).toContain('<project_context>');
    expect(withManifest).toContain('<vcp_state_manifest>');
    expect(withManifest).toContain('state_digest: sha256:abc123');
    expect(withManifest).toContain('Manifest digest: sha256:abc123');
    expect(withManifest).toContain('cite the matching manifest IDs');
    expect(withManifest).toContain('Keep the launch plan grounded');
  });
});

describe('chatgpt format', () => {
  it('uses markdown heading style', () => {
    const output = formatForPlatform(makeProject(), 'chatgpt');
    expect(output).toContain('# Project:');
    expect(output).toContain('## Goals');
    expect(output).toContain('## Current Status');
  });

  it('includes numbered goal list', () => {
    const output = formatForPlatform(makeProject(), 'chatgpt');
    expect(output).toContain('1. Launch MVP');
  });
});

describe('grok format', () => {
  it('produces non-empty output with project name', () => {
    const output = formatForPlatform(makeProject(), 'grok');
    expect(output.length).toBeGreaterThan(100);
    expect(output).toContain('My SaaS App');
  });
});

describe('perplexity format', () => {
  it('produces non-empty output with project name', () => {
    const output = formatForPlatform(makeProject(), 'perplexity');
    expect(output.length).toBeGreaterThan(100);
    expect(output).toContain('My SaaS App');
  });
});

describe('gemini format', () => {
  it('produces non-empty output with project name', () => {
    const output = formatForPlatform(makeProject(), 'gemini');
    expect(output.length).toBeGreaterThan(100);
    expect(output).toContain('My SaaS App');
  });
});

describe('agent handoff formats', () => {
  it('formats Codex handoff with repo verification instructions', () => {
    const project = makeProject({
      pendingGitCommits: [
        {
          hash: 'abc123',
          message: 'feat: add Prompt Guard preview actions',
          timestamp: '2026-04-30T10:00:00.000Z',
          author: 'Kris',
        },
      ],
      importantAssets: [
        'chrome-extension/prompt-guard/overlay.js',
        'chrome-extension/content.js',
      ],
    });

    const output = formatForPlatform(project, 'codex', 'Verify Prompt Guard changes');

    expect(output).toContain('PROJECT: My SaaS App');
    expect(output).toContain('STATUS: Pre-launch. MVP is 80% done.');
    expect(output).toContain('RECENT_GIT_COMMITS:');
    expect(output).toContain('abc123 2026-04-30: feat: add Prompt Guard preview actions');
    expect(output).toContain('IMPORTANT_ASSETS: chrome-extension/prompt-guard/overlay.js, chrome-extension/content.js');
    expect(output).toContain('TASK: Verify Prompt Guard changes');
    expect(output).toContain('Your task: verify the claims in the previous session against the actual codebase.');
    expect(output).toContain('VERIFIED, REFUTED, or UNVERIFIED');
    expect(output).toContain('Files you inspected');
    expect(output).toContain('memphant_update');
  });

  it('formats Cowork handoff with continuity and architecture review instructions', () => {
    const output = formatForPlatform(
      makeProject(),
      'cowork',
      'Review the agent handoff plan',
    );

    expect(output).toContain('PROJECT: My SaaS App');
    expect(output).toContain('STATUS: Pre-launch. MVP is 80% done.');
    expect(output).toContain('TASK: Review the agent handoff plan');
    expect(output).toContain('Your task: review continuity and architecture.');
    expect(output).toContain('Continuity check');
    expect(output).toContain('Architecture review');
    expect(output).toContain('Risks the previous session may have missed');
    expect(output).toContain('Recommended implementation plan as 3-5 ordered steps');
    expect(output).toContain('memphant_update');
  });
});

describe('custom platform format', () => {
  it('uses the selected platform config for custom platforms', () => {
    const output = formatForPlatform(
      makeProject(),
      'custom-team-ai',
      'Review the onboarding flow',
      'full',
      {
        id: 'custom-team-ai',
        name: 'Team AI',
        category: 'custom',
        exportStyle: 'code-heavy',
        promptPrefix: 'Use this team handoff and stay grounded in the project state.',
        enabled: true,
        builtIn: false,
        icon: '🧩',
        color: '#64748b',
      },
    );

    expect(output).toContain('Team AI project handoff');
    expect(output).toContain('Use this team handoff');
    expect(output).toContain('Review the onboarding flow');
  });
});

describe('response format guardrails', () => {
  it('tells AIs to fill changed fields and only add genuinely new items', () => {
    const output = formatForPlatform(makeProject(), 'chatgpt');

    expect(output).toContain('Fill in every field that changed');
    expect(output).toContain('Do not wait for the user to');
    expect(output).toContain('tell you what changed');
    expect(output).toContain('Only include goals and decisions if something genuinely new was decided this session');
  });

  it('uses schemaVersion 1.1.0 in the response format example', () => {
    const output = formatForPlatform(makeProject(), 'claude');
    expect(output).toContain('"schemaVersion": "1.1.0"');
  });

  it('includes continuity fields in the response format example', () => {
    const output = formatForPlatform(makeProject(), 'gemini');
    expect(output).toContain('"inProgress"');
    expect(output).toContain('"lastSessionSummary"');
    expect(output).toContain('"openQuestion"');
  });
});

// ─── Export modes ─────────────────────────────────────────────────────────────

describe('delta mode', () => {
  it('is shorter than full mode', () => {
    const project = makeProject();
    const full = formatForPlatform(project, 'claude', undefined, 'full');
    const delta = formatForPlatform(project, 'claude', undefined, 'delta');
    expect(delta.length).toBeLessThan(full.length);
  });

  it('includes current state and next steps', () => {
    const output = formatForPlatform(makeProject(), 'claude', undefined, 'delta');
    expect(output).toContain('Pre-launch. MVP is 80% done.');
    expect(output).toContain('Set up Stripe');
  });
});

describe('specialist mode', () => {
  it('includes rules and decisions', () => {
    const output = formatForPlatform(makeProject(), 'claude', 'Design pricing page', 'specialist');
    expect(output).toContain('Ship fast');
    expect(output).toContain('Use Tauri for desktop');
    expect(output).toContain('Design pricing page');
  });
});

describe('smart mode', () => {
  it('produces output for a fresh project (nothing dropped)', () => {
    const project = makeProject();
    const output = formatForPlatform(project, 'claude', undefined, 'smart');
    expect(output).toContain('My SaaS App');
    expect(output).toContain('Launch MVP');
  });

  it('condenses a project with many old decisions', () => {
    const manyDecisions = Array.from({ length: 10 }, (_, i) => ({
      decision: `Old decision ${i + 1}`,
      rationale: 'Outdated',
    }));
    const project = makeProject({ decisions: manyDecisions });
    const smart = formatForPlatform(project, 'claude', undefined, 'smart');
    const full = formatForPlatform(project, 'claude', undefined, 'full');
    expect(smart).toContain('[Smart Export');
    expect(smart.length).toBeLessThan(full.length);
  });

  it('does not include condensed notice for a small project', () => {
    const project = makeProject();
    const output = formatForPlatform(project, 'claude', undefined, 'smart');
    expect(output).not.toContain('[Smart Export');
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('quick mode', () => {
  const launchPadFallbackSummary =
    'LaunchPad CRM is a simple CRM for freelancers, solo founders, and small service businesses to track leads, follow-ups, customer notes, and deal status without needing a heavy CRM like Salesforce or HubSpot.';
  const aiToolingFallbackTask =
    'Help me continue improving onboarding, export flow, and cross-AI continuity.';
  const crmFallbackTask =
    'Help me design the follow-up reminder flow for this CRM.';
  const gameFallbackTask =
    'Help me continue gameplay, progression, and UX design.';
  const genericFallbackTask =
    'Help me continue from the current project state. Ask before assuming missing details.';
  const placeholderCurrentState =
    'Write 1-2 sentences describing what is true right now after this session. What was built, fixed, or decided?';
  const memephantCurrentState =
    'Memephant Desktop is live as a local-first cross-AI project handoff app. Recent work improved Memory Vault, Quick Start exports, export reliability, and fresh ChatGPT handoff compatibility.';
  const launchPadCurrentState =
    'LaunchPad CRM is at the early MVP design stage, focused on lead tracking, follow-up reminders, notes, and deal status.';
  const genericCurrentState =
    'The project does not yet have a reliable saved current state. Use the summary, goals, rules, and task below; ask before assuming missing details.';

  it('creates a compact fresh-chat handoff under the safe size threshold', () => {
    const project = makeProject({
      summary: 'A'.repeat(5000),
      currentState: 'B'.repeat(5000),
      goals: Array.from({ length: 20 }, (_, i) => `Goal ${i + 1} ${'x'.repeat(200)}`),
      rules: Array.from({ length: 20 }, (_, i) => `Rule ${i + 1} ${'y'.repeat(200)}`),
    });

    const output = formatForPlatform(
      project,
      'chatgpt',
      'Start by reviewing the payment flow.',
      'quick',
      undefined,
      'RECENT ACTIVITY SHOULD NOT APPEAR',
      '# AI Working Style\nAnswer Style: Balanced Builder\nTone: Direct',
    );

    expect(output.length).toBeLessThan(12000);
    expect(output).toContain('Fresh Chat Optimized');
    expect(output).not.toContain('RECENT ACTIVITY SHOULD NOT APPEAR');
  });

  it('replaces generic placeholder summaries with a neutral project-specific line in Quick Start Export', () => {
    const output = formatForPlatform(
      makeProject({
        name: 'Notebook Cleaner',
        summary: "Notebook Cleaner is a project. Add a brief description of what it does and who it's for.",
      }),
      'chatgpt',
      'Design the next screen.',
      'quick',
    );

    expect(output).toContain('Notebook Cleaner \u2014 summary not yet written.');
    expect(output).not.toContain('Add a brief description');
    // Must never describe this project using another project's sample text.
    expect(output).not.toContain('LaunchPad CRM');
    expect(output).not.toContain(launchPadFallbackSummary);
  });

  it('never leaks the LaunchPad sample summary into an unrelated project (Roblox practice)', () => {
    const output = formatForPlatform(
      makeProject({
        name: 'Roblox practice',
        summary: '(no summary yet)',
      }),
      'chatgpt',
      'Continue building the next feature.',
      'quick',
    );

    const summarySection = output.split('## Project Summary')[1]?.split('## Current State')[0] ?? '';
    expect(summarySection).toContain('Roblox practice \u2014 summary not yet written.');
    expect(summarySection).not.toContain('LaunchPad');
    expect(summarySection).not.toContain('CRM');
  });

  it('removes placeholder currentState from Quick Start Export', () => {
    const output = formatForPlatform(
      makeProject({
        name: 'Notebook Cleaner',
        summary: 'Organises scattered research notes into a calmer review queue.',
        currentState: placeholderCurrentState,
      }),
      'chatgpt',
      'Review the next interaction.',
      'quick',
    );

    expect(output).toContain(genericCurrentState);
    expect(output).not.toContain('Write 1-2 sentences');
    expect(output).not.toContain('What was built, fixed, or decided');
  });

  it('does not use the Memephant currentState fallback for projects mentioning Context Passport', () => {
    const output = formatForPlatform(
      makeProject({
        name: 'Context Passport Review Tool',
        summary: 'A helper for reviewing exported project context before sharing it.',
        currentState: placeholderCurrentState,
      }),
      'chatgpt',
      undefined,
      'quick',
    );

    expect(output).toContain(genericCurrentState);
    expect(output).not.toContain(memephantCurrentState);
  });

  it('uses the neutral currentState fallback for LaunchPad CRM when no reliable currentState exists', () => {
    const output = formatForPlatform(
      makeProject({
        name: 'LaunchPad CRM',
        currentState: '',
      }),
      'chatgpt',
      undefined,
      'quick',
    );

    expect(output).toContain(genericCurrentState);
    expect(output).not.toContain(launchPadCurrentState);
  });

  it('does not leak LaunchPad CRM currentState text into Roblox game Quick Start exports', () => {
    const output = formatForPlatform(
      makeProject({
        name: 'Roblox NPC Quest',
        summary: 'A Roblox game prototype with NPC quests, player rewards, and Luau systems.',
        currentState: placeholderCurrentState,
      }),
      'chatgpt',
      undefined,
      'quick',
    );

    expect(output).toContain(genericCurrentState);
    expect(output).not.toContain(launchPadCurrentState);
  });

  it('uses no hardcoded named-project currentState fallback in Quick Start output', () => {
    const projects = [
      makeProject({
        name: 'memephant-desktop',
        summary: 'Local-first AI memory and handoff tooling for cross-AI continuity.',
        currentState: placeholderCurrentState,
      }),
      makeProject({
        name: 'LaunchPad CRM',
        currentState: placeholderCurrentState,
      }),
      makeProject({
        name: 'Roblox NPC Quest',
        summary: 'A Roblox game prototype with NPC quests, player rewards, and Luau systems.',
        currentState: placeholderCurrentState,
      }),
    ];

    const outputs = projects.map((project) => formatForPlatform(project, 'chatgpt', undefined, 'quick'));

    for (const output of outputs) {
      expect(output).toContain(genericCurrentState);
      expect(output).not.toContain(memephantCurrentState);
      expect(output).not.toContain(launchPadCurrentState);
    }
  });

  it('uses the CRM fallback task for LaunchPad CRM', () => {
    const output = formatForPlatform(
      makeProject({ name: 'LaunchPad CRM' }),
      'chatgpt',
      'Help me continue from the current state.',
      'quick',
    );

    expect(output).toContain(crmFallbackTask);
    expect(output).not.toContain('Help me continue from the current state.');
  });

  it('uses the AI-tooling fallback task for Memephant', () => {
    const output = formatForPlatform(
      makeProject({
        name: 'memephant-desktop',
        summary: 'Local-first AI memory and handoff tooling for cross-AI continuity.',
      }),
      'chatgpt',
      undefined,
      'quick',
    );

    expect(output).toContain(aiToolingFallbackTask);
    expect(output).not.toContain(crmFallbackTask);
  });

  it('uses the game/dev fallback task for game projects', () => {
    const output = formatForPlatform(
      makeProject({
        name: 'Dungeon Runner',
        summary: 'A browser game with progression, quests, and player upgrades.',
      }),
      'chatgpt',
      undefined,
      'quick',
    );

    expect(output).toContain(gameFallbackTask);
  });

  it('does not leak CRM fallback tasks into unrelated projects', () => {
    const output = formatForPlatform(
      makeProject({
        name: 'InvoicePilot',
        summary: 'A lightweight invoicing workflow for designers.',
        goals: ['Improve payment reminders'],
      }),
      'chatgpt',
      undefined,
      'quick',
    );

    expect(output).toContain(genericFallbackTask);
    expect(output).not.toContain(crmFallbackTask);
  });

  it('keeps a safe generic fallback for uncategorised projects', () => {
    const output = formatForPlatform(
      makeProject({
        name: 'Notebook Cleaner',
        summary: 'Organises scattered research notes into a calmer review queue.',
        goals: ['Improve capture flow'],
      }),
      'chatgpt',
      '',
      'quick',
    );

    expect(output).toContain(genericFallbackTask);
  });

  it('preserves non-placeholder custom summaries', () => {
    const summary = 'A focused invoicing assistant for designers who need recurring client billing and payment reminders.';

    const output = formatForPlatform(
      makeProject({ name: 'InvoicePilot', summary }),
      'chatgpt',
      'Review onboarding.',
      'quick',
    );

    expect(output).toContain(summary);
    expect(output).not.toContain(launchPadFallbackSummary);
  });

  it('preserves non-placeholder user tasks', () => {
    const task = 'Help me simplify the lead import screen and identify the smallest useful MVP version.';

    const output = formatForPlatform(
      makeProject({ name: 'LaunchPad CRM' }),
      'chatgpt',
      task,
      'quick',
    );

    expect(output).toContain(task);
    expect(output).not.toContain(crmFallbackTask);
  });

  it('filters placeholder goals and rules while preserving real items', () => {
    const output = formatForPlatform(
      makeProject({
        goals: [
          'Only include if a genuinely new goal emerged this session',
          'Ship a calm Quick Start export',
        ],
        rules: [
          'List only things actively being worked on right now — not done, not future',
          'Keep exports beginner-friendly',
        ],
      }),
      'chatgpt',
      'Review the export shape.',
      'quick',
    );

    expect(output).toContain('Ship a calm Quick Start export');
    expect(output).toContain('Keep exports beginner-friendly');
    expect(output).not.toContain('Only include if');
    expect(output).not.toContain('not done, not future');
  });

  it('uses a safe rule fallback when all rules are placeholders', () => {
    const output = formatForPlatform(
      makeProject({
        rules: [
          'Only include genuinely new decisions made this session',
          'List only things actively being worked on right now — not done, not future',
        ],
      }),
      'chatgpt',
      'Review the export shape.',
      'quick',
    );

    expect(output).toContain('- Ask before assuming missing details.');
    expect(output).not.toContain('Only include genuinely');
  });

  it('does not mutate saved project data while filtering placeholders', () => {
    const project = makeProject({
      currentState: placeholderCurrentState,
      goals: ['Only include if a genuinely new goal emerged this session', 'Real goal'],
      rules: ['Only include genuinely new decisions made this session', 'Real rule'],
      nextSteps: ['List the immediate next actions that should happen after this session'],
      decisions: [{ decision: 'Only include genuinely new decisions made this session' }],
    });
    const before = JSON.stringify(project);

    formatForPlatform(project, 'chatgpt', undefined, 'quick');

    expect(JSON.stringify(project)).toBe(before);
  });

  it('includes AI Working Style only once', () => {
    const output = formatForPlatform(
      makeProject(),
      'chatgpt',
      undefined,
      'quick',
      undefined,
      undefined,
      '# AI Working Style\nAnswer Style: Straight Shooter\nTone: Direct',
    );

    expect(output.match(/AI Working Style/g)).toHaveLength(1);
  });

  it('includes British English language preference in condensed AI Working Style', () => {
    const output = formatForPlatform(
      makeProject(),
      'chatgpt',
      undefined,
      'quick',
      undefined,
      undefined,
      [
        '# AI Working Style',
        'Answer Style: Balanced Builder',
        'Language: British English',
        'Use British spelling and phrasing, e.g. centre, colour, organise, behaviour.',
      ].join('\n'),
    );

    expect(output).toContain('Language: British English');
    expect(output).toContain('Use British spelling and phrasing, e.g. centre, colour, organise, behaviour.');
  });

  it('does not include memphant_update instructions or giant response schema examples', () => {
    const output = formatForPlatform(makeProject(), 'chatgpt', undefined, 'quick');

    expect(output).not.toContain('memphant_update');
    expect(output).not.toContain('"schemaVersion"');
    expect(output).not.toContain('```json');
  });

  it('does not emit duplicate sections', () => {
    const output = formatForPlatform(makeProject(), 'chatgpt', undefined, 'quick');
    const headings = output.match(/^## .+$/gm) ?? [];

    expect(new Set(headings).size).toBe(headings.length);
  });
});

describe('Frontal Lobe append safety', () => {
  it('does not append a second AI Working Style block if one is already present', () => {
    const project = makeProject({
      aiInstructions: '# AI Working Style\nAlready included by project instructions.',
    });
    const block = '# AI Working Style\nUse this working style when helping me.';

    const output = formatForPlatform(
      project,
      'chatgpt',
      undefined,
      'full',
      undefined,
      undefined,
      block,
    );

    expect(output.match(/^# AI Working Style\s*$/gm)).toHaveLength(1);
  });
});

describe('edge cases', () => {
  it('handles a project with all empty fields gracefully', () => {
    const project = makeProject({
      summary: '',
      currentState: '',
      goals: [],
      rules: [],
      decisions: [],
      nextSteps: [],
      openQuestions: [],
      importantAssets: [],
      aiInstructions: '',
    });
    const platforms = ['claude', 'chatgpt', 'grok', 'perplexity', 'gemini', 'codex', 'cowork'] as const;
    for (const platform of platforms) {
      expect(() => formatForPlatform(project, platform)).not.toThrow();
    }
  });

  it('handles a project name with special characters', () => {
    const project = makeProject({ name: '<script>alert("xss")</script>' });
    const output = formatForPlatform(project, 'claude');
    expect(output).toBeDefined();
    expect(output.length).toBeGreaterThan(0);
  });

  it('handles a very long summary without crashing', () => {
    const project = makeProject({ summary: 'A'.repeat(5000) });
    expect(() => formatForPlatform(project, 'claude')).not.toThrow();
  });
});
