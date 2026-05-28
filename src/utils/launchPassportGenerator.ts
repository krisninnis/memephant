import type { Decision, ProjectMemory } from '../types/memphant-types';
import { getWorkflowModeConfig } from './workflowModes';

export type LaunchPassportSectionId =
  | 'positioning'
  | 'xLaunch'
  | 'shortX'
  | 'reddit'
  | 'showHn'
  | 'founderStory'
  | 'demoVideo'
  | 'screenshotChecklist'
  | 'launchChecklist'
  | 'feedbackRequest';

export type LaunchPassportSection = {
  id: LaunchPassportSectionId;
  title: string;
  content: string;
};

export type LaunchPassport = {
  projectName: string;
  generatedAt: string;
  sections: LaunchPassportSection[];
  markdown: string;
};

const SECRET_PATTERNS = [
  /sk_live_[A-Za-z0-9_]+/g,
  /xox[baprs]-[A-Za-z0-9-]+/g,
  /ghp_[A-Za-z0-9_]+/g,
  /api[_-]?key\s*[=:]\s*\S+/gi,
  /token\s*[=:]\s*\S+/gi,
  /secret\s*[=:]\s*\S+/gi,
  /password\s*[=:]\s*\S+/gi,
];

function cleanText(value: string | undefined, fallback = ''): string {
  const text = (value || fallback).replace(/\s+/g, ' ').trim();
  return SECRET_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, '[redacted]'),
    text,
  );
}

function cleanList(items: string[] | undefined, fallback: string[] = []): string[] {
  return (items && items.length > 0 ? items : fallback)
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function publicAssetName(asset: string): string {
  const cleaned = cleanText(asset);
  const parts = cleaned.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] ?? cleaned;
}

function firstItems(items: string[], count: number): string[] {
  return items.slice(0, count);
}

function sentenceList(items: string[]): string {
  if (items.length === 0) return 'the current project milestones';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function decisionSummary(decisions: Decision[]): string {
  const useful = decisions
    .map((decision) => cleanText(decision.decision))
    .filter(Boolean)
    .slice(-2);

  return useful.length > 0 ? sentenceList(useful) : 'the decisions already captured in the project';
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

function numberedList(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

export function generateLaunchPassport(
  project: ProjectMemory,
  generatedAt = new Date().toISOString(),
): LaunchPassport {
  const name = cleanText(project.name, 'This project');
  const summary = cleanText(project.summary, `${name} is preparing for launch.`);
  const currentState = cleanText(project.currentState, 'The project is ready for user feedback.');
  const goals = cleanList(project.goals, ['help users understand the product quickly']);
  const rules = cleanList(project.rules);
  const nextSteps = cleanList(project.nextSteps, ['share the launch draft', 'collect feedback']);
  const inProgress = cleanList(project.inProgress);
  const openQuestions = cleanList(project.openQuestions);
  const assets = cleanList(project.importantAssets).map(publicAssetName);
  const instructions = cleanText(project.aiInstructions);
  const workflowMode = getWorkflowModeConfig(project.workflowMode);
  const keyGoal = goals[0] ?? 'help users get value faster';
  const keyNextStep = nextSteps[0] ?? 'collect feedback';
  const contextSignals = firstItems([
    ...goals.map((goal) => `Goal: ${goal}`),
    ...inProgress.map((item) => `In progress: ${item}`),
    ...nextSteps.map((step) => `Next: ${step}`),
  ], 5);

  const sections: LaunchPassportSection[] = [
    {
      id: 'positioning',
      title: 'One-line positioning',
      content: `${name}: ${summary}`,
    },
    {
      id: 'xLaunch',
      title: 'X/Twitter launch post',
      content: [
        `Launching ${name}.`,
        '',
        summary,
        '',
        `Current focus: ${currentState}`,
        ...(workflowMode ? [`Workflow mode: ${workflowMode.label} (${workflowMode.focus}).`] : []),
        `Built for people who need to ${keyGoal}.`,
        '',
        `I would love feedback on whether this makes the value obvious quickly.`,
      ].join('\n'),
    },
    {
      id: 'shortX',
      title: 'Short X version',
      content: `${name} is live: ${summary} Current focus: ${keyNextStep}. Feedback welcome.`,
    },
    {
      id: 'reddit',
      title: 'Reddit launch version',
      content: [
        `I built ${name} to solve this problem: ${summary}`,
        '',
        `Current state: ${currentState}`,
        ...(workflowMode ? [`Current working lens: ${workflowMode.label} - ${workflowMode.guidance}`] : []),
        '',
        'What it is trying to do:',
        bulletList(firstItems(goals, 4)),
        '',
        'What I am working on next:',
        bulletList(firstItems(nextSteps, 4)),
        '',
        openQuestions.length > 0
          ? `I would especially value feedback on: ${sentenceList(firstItems(openQuestions, 2))}.`
          : 'I would especially value feedback on whether the positioning is clear and useful.',
      ].join('\n'),
    },
    {
      id: 'showHn',
      title: 'Show HN draft',
      content: [
        `Show HN: ${name} - ${summary}`,
        '',
        `I built this because ${decisionSummary(project.decisions)}.`,
        '',
        `Current state: ${currentState}`,
        '',
        'Useful context:',
        bulletList(contextSignals.length > 0 ? contextSignals : [`Next: ${keyNextStep}`]),
      ].join('\n'),
    },
    {
      id: 'founderStory',
      title: 'Founder story / why I built this',
      content: [
        `I built ${name} because the project context kept pointing to the same need: ${keyGoal}.`,
        '',
        `The product is currently here: ${currentState}`,
        '',
        `The most important decision so far: ${decisionSummary(project.decisions)}.`,
        instructions ? `\nWorking style note: ${instructions}` : '',
      ].filter(Boolean).join('\n'),
    },
    {
      id: 'demoVideo',
      title: 'Demo video outline',
      content: numberedList([
        `Open ${name} and state the problem in one sentence.`,
        `Show the current project state: ${currentState}`,
        `Point to the core goal: ${keyGoal}`,
        `Show the next action: ${keyNextStep}`,
        'End by asking viewers for one concrete piece of feedback.',
      ]),
    },
    {
      id: 'screenshotChecklist',
      title: 'Screenshot checklist',
      content: bulletList([
        'First screen showing the project name and summary',
        'Current state or progress view',
        'The primary action users should notice first',
        ...firstItems(assets, 3).map((asset) => `Relevant asset visible: ${asset}`),
        'A final screenshot that makes the launch promise obvious',
      ]),
    },
    {
      id: 'launchChecklist',
      title: 'Launch checklist',
      content: bulletList([
        'Confirm the one-line positioning matches the current project',
        'Review launch copy for private details before posting',
        ...firstItems(rules, 3).map((rule) => `Respect project rule: ${rule}`),
        ...firstItems(nextSteps, 4).map((step) => `Prepare: ${step}`),
        'Save feedback themes back into the project after launch',
      ]),
    },
    {
      id: 'feedbackRequest',
      title: 'Follow-up / feedback request post',
      content: [
        `I am testing ${name} with a few early users.`,
        '',
        summary,
        '',
        `If you try it, I would love one specific note: where did the value become clear, and where did it feel confusing?`,
      ].join('\n'),
    },
  ];

  const markdown = [
    `# Launch Passport: ${name}`,
    '',
    `Generated: ${generatedAt}`,
    '',
    ...sections.flatMap((section) => [
      `## ${section.title}`,
      '',
      section.content,
      '',
    ]),
  ].join('\n').trim();

  return {
    projectName: name,
    generatedAt,
    sections,
    markdown,
  };
}
