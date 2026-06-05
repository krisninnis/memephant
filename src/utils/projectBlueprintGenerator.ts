import type {
  Decision,
  ProjectBlueprint,
  ProjectBlueprintInput,
  ProjectBlueprintPreference,
  ProjectBlueprintPrimaryAI,
  ProjectBlueprintProjectType,
  ProjectBlueprintWorkingStyle,
  ProjectMemory,
} from '../types/memphant-types';
import { SCHEMA_VERSION } from '../types/memphant-types';
import {
  createDefaultGameContext,
  getGamePlatformLabel,
} from './gameProjectTypes';

const PROJECT_TYPE_LABELS: Record<ProjectBlueprintProjectType, string> = {
  saas: 'SaaS',
  'desktop-app': 'Desktop App',
  'mobile-app': 'Mobile App',
  'ai-tool': 'AI Tool',
  'browser-extension': 'Browser Extension',
  api: 'API',
  'internal-tool': 'Internal Tool',
  game: 'Game',
  'content-business': 'Content Business',
  other: 'Other',
};

const WORKING_STYLE_LABELS: Record<ProjectBlueprintWorkingStyle, string> = {
  'solo-founder': 'Solo founder',
  'small-team': 'Small team',
  agency: 'Agency',
  'hobby-project': 'Hobby project',
};

const PRIMARY_AI_LABELS: Record<ProjectBlueprintPrimaryAI, string> = {
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  codex: 'Codex',
  cursor: 'Cursor',
  gemini: 'Gemini',
  grok: 'Grok',
  other: 'Other',
};

const DEFAULT_INPUT: ProjectBlueprintInput = {
  projectName: '',
  idea: '',
  problem: '',
  targetAudience: '',
  desiredOutcome: '',
  projectType: 'saas',
  gamePlatform: 'roblox',
  quality: 'beginner-friendly',
  preferredStack: '',
  localFirst: 'unsure',
  authentication: 'unsure',
  payments: 'unsure',
  database: 'unsure',
  aiIntegrations: 'unsure',
  workingStyle: 'solo-founder',
  primaryAI: 'chatgpt',
};

function clean(value: string | undefined, fallback = ''): string {
  const text = value?.replace(/\s+/g, ' ').trim() ?? '';
  return text || fallback;
}

function sentence(value: string): string {
  const text = clean(value);
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function slug(value: string): string {
  const safe = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return safe || 'project';
}

function yesNo(value: ProjectBlueprintPreference): string {
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  return 'Unsure';
}

function labelProjectType(input: ProjectBlueprintInput): string {
  if (input.projectType === 'other') {
    return clean(input.otherProjectType, 'Other');
  }

  return PROJECT_TYPE_LABELS[input.projectType];
}

function labelGamePlatform(input: ProjectBlueprintInput): string {
  return getGamePlatformLabel(input.gamePlatform, input.otherGamePlatform);
}

function labelPrimaryAI(input: ProjectBlueprintInput): string {
  if (input.primaryAI === 'other') {
    return clean(input.otherPrimaryAI, 'Other');
  }

  return PRIMARY_AI_LABELS[input.primaryAI];
}

function preferenceDecision(label: string, value: ProjectBlueprintPreference): Decision | null {
  if (value === 'unsure') {
    return {
      decision: `${label}: decide later after validating the MVP scope.`,
      rationale: 'Keeping this open avoids premature technical commitment.',
      source: 'project-blueprint',
    };
  }

  return {
    decision: `${label}: ${yesNo(value)}.`,
    rationale: value === 'yes'
      ? 'The founder expects this to matter for the first usable version.'
      : 'This is intentionally outside the first version unless requirements change.',
    source: 'project-blueprint',
  };
}

function typeSpecificScope(projectType: ProjectBlueprintProjectType): string {
  switch (projectType) {
    case 'desktop-app':
      return 'A local desktop workflow with project creation, saved state, and one complete user action.';
    case 'mobile-app':
      return 'A focused mobile flow that solves the core problem on one primary screen.';
    case 'ai-tool':
      return 'A deterministic AI-assisted workflow with clear inputs, outputs, and user review before action.';
    case 'browser-extension':
      return 'A browser extension that works on one target site or workflow first.';
    case 'api':
      return 'A small API with documented inputs, outputs, errors, and one reliable integration path.';
    case 'internal-tool':
      return 'A private tool that makes one repeated internal workflow faster or less error-prone.';
    case 'game':
      return 'A playable game loop with one map or level, one core mechanic, and a clear win or progress state.';
    case 'content-business':
      return 'A repeatable content production and publishing workflow with one clear audience promise.';
    case 'saas':
      return 'A narrow SaaS workflow that lets a target user reach one valuable outcome.';
    case 'other':
      return 'A narrow first version that proves the core workflow before expanding scope.';
  }
}

function typeSpecificStack(input: ProjectBlueprintInput): string {
  switch (input.projectType) {
    case 'desktop-app':
      return 'Desktop shell, local project storage, and a small UI layer before any online services.';
    case 'mobile-app':
      return 'Mobile UI, local state, and a minimal backend only if sharing or accounts are required.';
    case 'ai-tool':
      return 'Clear prompt/input contracts, deterministic fallbacks, and manual user approval for outputs.';
    case 'browser-extension':
      return 'Extension manifest, content script, options page, and local settings storage.';
    case 'api':
      return 'HTTP API, schema validation, predictable errors, and a small persistence layer if needed.';
    case 'internal-tool':
      return 'Simple authenticated UI, audit-friendly actions, and conservative data access.';
    case 'game':
      return 'Game loop, scripts, map/scene structure, UI prompts, progression, playtest notes, and local save state.';
    case 'content-business':
      return 'Content database or spreadsheet, publishing checklist, and lightweight analytics later.';
    case 'saas':
      return 'Web app, server-side API, database, and billing only after the value path is clear.';
    case 'other':
      return 'Start with the smallest runtime that can prove the project promise.';
  }
}

function recommendedStack(input: ProjectBlueprintInput): string[] {
  const items = [
    clean(input.preferredStack)
      ? `Preferred stack to consider: ${clean(input.preferredStack)}.`
      : typeSpecificStack(input),
    input.quality === 'production-grade'
      ? 'Use production-grade defaults: typed data boundaries, tests for core flows, and clear error states.'
      : 'Use beginner-friendly defaults: fewer moving parts, readable structure, and manual setup steps.',
  ];

  if (input.localFirst === 'yes') {
    items.push('Keep core project data local first; add sync only after local behavior is trustworthy.');
  } else if (input.localFirst === 'unsure') {
    items.push('Decide whether core data should work offline before choosing hosted storage.');
  }

  if (input.authentication === 'yes') {
    items.push('Plan authentication after the core unauthenticated workflow is understandable.');
  }

  if (input.payments === 'yes') {
    items.push('Treat payments as a launch milestone after the value proposition is validated.');
  }

  if (input.database === 'yes') {
    items.push('Use a small database schema centered on the main user object and the primary workflow state.');
  }

  if (input.aiIntegrations === 'yes') {
    items.push('Keep AI integrations behind user-reviewed actions with deterministic saved context.');
  }

  return items;
}

function folderStructure(input: ProjectBlueprintInput): string {
  const appFolder = input.projectType === 'api' ? 'api' : 'app';
  return [
    '```text',
    `${slug(input.projectName)}/`,
    `  ${appFolder}/`,
    '    README.md',
    '    src/',
    '      components-or-modules/',
    '      data/',
    '      workflows/',
    '    tests/',
    '  docs/',
    '    blueprint.md',
    '    decisions.md',
    '    launch-checklist.md',
    '  assets/',
    '  .memephant/',
    '    context-passport-seed.md',
    '```',
  ].join('\n');
}

function buildAiInstructions(input: ProjectBlueprintInput): string {
  const ai = labelPrimaryAI(input);
  const lines = [
    `You are helping build ${clean(input.projectName, 'this project')} from a Project Blueprint.`,
    `Primary AI workflow: ${ai}.`,
    `Project type: ${labelProjectType(input)}.`,
    `Working style: ${WORKING_STYLE_LABELS[input.workingStyle]}.`,
    `Start from context and product clarity before suggesting implementation details.`,
    `Do not generate application code unless the user explicitly asks for code.`,
    `Keep recommendations grounded in the stated problem: ${clean(input.problem, 'the user problem is still being clarified')}.`,
    `Preserve local-first and user-approved decisions when they appear in the project memory.`,
  ];

  if (input.projectType === 'game') {
    lines.push(`Game platform: ${labelGamePlatform(input)}.`);
    lines.push('Preserve gameplay loop, systems, scripts, bugs, maps, progression, monetisation, and playtest context across AI handoffs.');
    if (input.gamePlatform === 'roblox') {
      lines.push('For Roblox, track Roblox Studio hierarchy, Luau scripts, LocalScripts, ModuleScripts, RemoteEvents, DataStores, StarterGui, Workspace, ServerScriptService, ReplicatedStorage, gamepasses, and thumbnails/icons.');
    }
  }

  return lines.join('\n');
}

function buildContextPassportSeed(input: ProjectBlueprintInput): string {
  return [
    `# Context Passport Seed: ${clean(input.projectName, 'Untitled Project')}`,
    '',
    `## Idea`,
    sentence(input.idea),
    '',
    `## Problem`,
    sentence(input.problem),
    '',
    `## Target Users`,
    sentence(input.targetAudience),
    '',
    `## Desired Outcome`,
    sentence(input.desiredOutcome),
    '',
    `## Project Type`,
    labelProjectType(input),
    '',
    ...(input.projectType === 'game' ? [
      '## Game Platform',
      labelGamePlatform(input),
      '',
    ] : []),
    `## Technical Preferences`,
    `- Quality level: ${input.quality}`,
    `- Preferred stack: ${clean(input.preferredStack, 'Not decided yet')}`,
    `- Local-first: ${yesNo(input.localFirst)}`,
    `- Authentication: ${yesNo(input.authentication)}`,
    `- Payments: ${yesNo(input.payments)}`,
    `- Database: ${yesNo(input.database)}`,
    `- AI integrations: ${yesNo(input.aiIntegrations)}`,
  ].join('\n');
}

function buildBlueprintMarkdown(blueprint: ProjectBlueprint): string {
  const roadmap = blueprint.roadmap;
  return [
    `# Project Blueprint: ${blueprint.input.projectName}`,
    '',
    `Generated: ${blueprint.generatedAt}`,
    '',
    '## Project Summary',
    `- Vision: ${blueprint.projectSummary.vision}`,
    `- Purpose: ${blueprint.projectSummary.purpose}`,
    `- Target users: ${blueprint.projectSummary.targetUsers}`,
    '',
    '## Product Definition',
    '### MVP scope',
    blueprint.productDefinition.mvpScope.map((item) => `- ${item}`).join('\n'),
    '',
    '### Non-goals',
    blueprint.productDefinition.nonGoals.map((item) => `- ${item}`).join('\n'),
    '',
    '### Risks',
    blueprint.productDefinition.risks.map((item) => `- ${item}`).join('\n'),
    '',
    '## Recommended Stack',
    blueprint.recommendedStack.map((item) => `- ${item}`).join('\n'),
    '',
    '## Suggested Folder Structure',
    blueprint.folderStructureMarkdown,
    '',
    '## Roadmap',
    '### Phase 1',
    roadmap.phase1.map((item) => `- ${item}`).join('\n'),
    '',
    '### Phase 2',
    roadmap.phase2.map((item) => `- ${item}`).join('\n'),
    '',
    '### Phase 3',
    roadmap.phase3.map((item) => `- ${item}`).join('\n'),
    '',
    '## First 10 Tasks',
    blueprint.firstTenTasks.map((item, index) => `${index + 1}. ${item}`).join('\n'),
    '',
    '## AI Instructions',
    blueprint.aiInstructions,
    '',
    '## Context Passport Seed',
    blueprint.contextPassportSeed,
    '',
    '## Launch Checklist',
    blueprint.launchChecklist.map((item) => `- ${item}`).join('\n'),
  ].join('\n');
}

export function createDefaultProjectBlueprintInput(): ProjectBlueprintInput {
  return { ...DEFAULT_INPUT };
}

export function generateProjectBlueprint(
  rawInput: ProjectBlueprintInput,
  generatedAt = new Date(0).toISOString(),
): ProjectBlueprint {
  const input: ProjectBlueprintInput = {
    ...DEFAULT_INPUT,
    ...rawInput,
    projectName: clean(rawInput.projectName, 'Untitled Project'),
    idea: clean(rawInput.idea, 'A project idea that needs clearer context before implementation.'),
    problem: clean(rawInput.problem, 'The user problem still needs to be clarified.'),
    targetAudience: clean(rawInput.targetAudience, 'The target audience still needs to be clarified.'),
    desiredOutcome: clean(rawInput.desiredOutcome, 'The desired outcome still needs to be clarified.'),
    preferredStack: clean(rawInput.preferredStack),
    otherProjectType: clean(rawInput.otherProjectType),
    gamePlatform: rawInput.projectType === 'game'
      ? rawInput.gamePlatform ?? DEFAULT_INPUT.gamePlatform
      : undefined,
    otherGamePlatform: rawInput.projectType === 'game'
      ? clean(rawInput.otherGamePlatform)
      : undefined,
    otherPrimaryAI: clean(rawInput.otherPrimaryAI),
  };
  const name = input.projectName;
  const typeLabel = labelProjectType(input);

  return {
    version: '1.0',
    generatedAt,
    input,
    projectSummary: {
      vision: `${name} is a ${typeLabel} that helps ${input.targetAudience} ${input.desiredOutcome}`,
      purpose: `Solve this problem: ${input.problem}`,
      targetUsers: input.targetAudience,
    },
    productDefinition: {
      mvpScope: [
        typeSpecificScope(input.projectType),
        `Make the core outcome obvious: ${input.desiredOutcome}`,
        `Create enough context for ${labelPrimaryAI(input)} to continue without re-explaining the project.`,
        ...(input.projectType === 'game'
          ? [`Capture the game loop, key systems, important scripts, known bugs, and playtest plan for ${labelGamePlatform(input)}.`]
          : []),
      ],
      nonGoals: [
        'Do not generate application code from the blueprint itself.',
        'Do not add automation, payments, or integrations before the MVP path is clear.',
        'Do not optimize for scale before the first complete user workflow exists.',
        ...(input.projectType === 'game'
          ? ['Do not add game engine plugins, parsers, platform APIs, or publishing automation from the blueprint.']
          : []),
      ],
      risks: [
        `The audience may still be too broad: ${input.targetAudience}`,
        `The problem may need sharper evidence: ${input.problem}`,
        input.preferredStack
          ? `The preferred stack may add complexity if it does not fit the MVP: ${input.preferredStack}`
          : 'The stack is undecided, so implementation choices could drift without a decision log.',
      ],
    },
    recommendedStack: recommendedStack(input),
    folderStructureMarkdown: folderStructure(input),
    roadmap: {
      phase1: [
        'Confirm the target user and the painful workflow.',
        'Write the simplest product promise in one sentence.',
        'Build or sketch the smallest workflow that proves the outcome.',
        ...(input.projectType === 'game'
          ? ['Define the core gameplay loop, key systems, playable state, and first playtest target.']
          : []),
      ],
      phase2: [
        'Add persistence for the core workflow.',
        'Test the flow with a small number of real users.',
        'Tighten onboarding around the strongest user outcome.',
      ],
      phase3: [
        'Add optional integrations only after the core loop works.',
        'Prepare launch copy, demo assets, and feedback questions.',
        'Use Context Passport updates to keep future AI sessions aligned.',
      ],
    },
    firstTenTasks: [
      'Rewrite the idea as a one-sentence promise.',
      'Describe the target user in plain English.',
      'Write the top three pain points this project should remove.',
      input.projectType === 'game'
        ? 'Choose the single gameplay loop the MVP must prove.'
        : 'Choose the single workflow the MVP must prove.',
      'List the inputs and outputs for that workflow.',
      'Decide what data must be stored locally or remotely.',
      'Create a rough folder plan before adding files.',
      'Write a first Context Passport seed from this blueprint.',
      'Ask one target user whether the problem statement feels real.',
      'Pick the first implementation task only after the context feels complete.',
    ],
    aiInstructions: buildAiInstructions(input),
    contextPassportSeed: buildContextPassportSeed(input),
    launchChecklist: [
      input.projectType === 'game'
        ? 'Write the public game description in plain English.'
        : 'Write the public problem statement in plain English.',
      input.projectType === 'game'
        ? 'Prepare a short playtest clip of the core loop.'
        : 'Prepare a short demo of the core workflow.',
      input.projectType === 'game'
        ? 'Ask playtesters about fun, confusion, retention, bugs, and monetisation fit before broad launch.'
        : 'Ask for feedback from the target audience before broad launch.',
      'Track what changed recently so Launch Studio can generate specific updates.',
      'Keep launch content tied to real shipped progress.',
    ],
  };
}

export function projectBlueprintToMarkdown(blueprint: ProjectBlueprint): string {
  return buildBlueprintMarkdown(blueprint);
}

export function createProjectFromBlueprint(
  input: ProjectBlueprintInput,
  generatedAt = new Date(0).toISOString(),
): ProjectMemory {
  const blueprint = generateProjectBlueprint(input, generatedAt);
  const timestamp = Date.parse(generatedAt);
  const idSuffix = Number.isFinite(timestamp) ? String(timestamp) : generatedAt.replace(/[^0-9]/g, '');
  const decisions = [
    {
      decision: `Project type: ${labelProjectType(blueprint.input)}.`,
      rationale: 'Selected in Project Blueprint before implementation.',
      source: 'project-blueprint',
      timestamp: generatedAt,
    },
    {
      decision: blueprint.input.projectType === 'game'
        ? `Game platform: ${labelGamePlatform(blueprint.input)}.`
        : `Project category: ${labelProjectType(blueprint.input)}.`,
      rationale: blueprint.input.projectType === 'game'
        ? 'Selected so game-specific context fields and exports can stay aligned.'
        : 'Selected in Project Blueprint before implementation.',
      source: 'project-blueprint',
      timestamp: generatedAt,
    },
    {
      decision: `Build quality: ${blueprint.input.quality}.`,
      rationale: blueprint.input.quality === 'production-grade'
        ? 'The project should start with more durable defaults.'
        : 'The project should stay approachable while the idea is being shaped.',
      source: 'project-blueprint',
      timestamp: generatedAt,
    },
    preferenceDecision('Local-first', blueprint.input.localFirst),
    preferenceDecision('Authentication needed', blueprint.input.authentication),
    preferenceDecision('Payments needed', blueprint.input.payments),
    preferenceDecision('Database needed', blueprint.input.database),
    preferenceDecision('AI integrations needed', blueprint.input.aiIntegrations),
  ].filter((decision): decision is Decision => Boolean(decision));

  return {
    schema_version: SCHEMA_VERSION,
    id: `${slug(blueprint.input.projectName)}_${idSuffix || 'blueprint'}`,
    name: blueprint.input.projectName,
    updatedAt: generatedAt,
    summary: `${sentence(blueprint.input.idea)} ${sentence(blueprint.projectSummary.vision)}`.trim(),
    goals: [
      blueprint.input.desiredOutcome,
      'Create a complete Context Passport before implementation work expands.',
      'Validate the MVP scope with the target audience.',
    ],
    rules: [
      'Start from context before writing code.',
      'Do not generate application code from the Project Blueprint alone.',
      'Keep decisions inspectable and update project memory as the plan changes.',
    ],
    decisions,
    currentState: 'Project Blueprint created. The project has planning context but no implementation has been generated.',
    nextSteps: blueprint.firstTenTasks.slice(0, 5),
    openQuestions: [
      `Is the target audience specific enough: ${blueprint.input.targetAudience}?`,
      `Is the pain statement sharp enough: ${blueprint.input.problem}?`,
      'What is the smallest workflow that proves the desired outcome?',
    ],
    importantAssets: [],
    projectCharter: projectBlueprintToMarkdown(blueprint),
    aiInstructions: blueprint.aiInstructions,
    projectReason: blueprint.input.problem,
    projectBlueprint: blueprint,
    checkpoints: [],
    restorePoints: [],
    changelog: [
      {
        timestamp: generatedAt,
        field: 'projectBlueprint',
        action: 'added',
        summary: 'Project Blueprint created',
        source: 'app',
      },
    ],
    platformState: {},
    workflowMode: 'build',
    projectCategory:
      blueprint.input.projectType === 'game'
        ? 'game'
        : blueprint.input.projectType === 'saas'
          ? 'saas'
          : blueprint.input.projectType === 'desktop-app'
            ? 'desktop-app'
            : blueprint.input.projectType === 'mobile-app'
              ? 'mobile-app'
              : blueprint.input.projectType === 'content-business'
                ? 'content-project'
                : 'general-software',
    gamePlatform: blueprint.input.projectType === 'game' ? blueprint.input.gamePlatform : undefined,
    gamePlatformOther: blueprint.input.projectType === 'game' ? blueprint.input.otherGamePlatform : undefined,
    gameContext: blueprint.input.projectType === 'game'
      ? createDefaultGameContext(blueprint.input.gamePlatform ?? 'roblox')
      : undefined,
  };
}
