import type { Decision, ProjectMemory } from '../types/memphant-types';
import {
  cleanPublicList,
  cleanPublicText,
  filterPublicDecisions,
  publicAssetName,
} from './contextQuality';
import { getContentQualityWarning } from './contentReadiness';
import { getShippingHighlights } from './shippingHighlights';
import { getWorkflowModeConfig } from './workflowModes';

export type BuildUpdateSectionId =
  | 'xUpdate'
  | 'shortUpdate'
  | 'linkedIn'
  | 'reddit'
  | 'indieHackers'
  | 'releaseNotes'
  | 'feedbackRequest'
  | 'shippedThisWeek'
  | 'founderReflection'
  | 'demoCaption';

export type BuildUpdateSection = {
  id: BuildUpdateSectionId;
  title: string;
  bestFor: string;
  content: string;
};

export type BuildUpdate = {
  projectName: string;
  generatedAt: string;
  qualityWarning: string | null;
  sections: BuildUpdateSection[];
  markdown: string;
};

function cleanText(value: string | undefined, fallback = ''): string {
  return cleanPublicText(value, fallback);
}

function cleanList(items: string[] | undefined, fallback: string[] = []): string[] {
  return cleanPublicList(items, fallback);
}

function firstItems(items: string[], count: number): string[] {
  return items.slice(0, count);
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

function sentenceList(items: string[]): string {
  if (items.length === 0) return 'the current project work';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function decisionSummary(decisions: Decision[]): string {
  const useful = filterPublicDecisions(decisions, 2);

  return useful.length > 0 ? sentenceList(useful) : 'the latest product decisions';
}

export function generateBuildUpdate(
  project: ProjectMemory,
  generatedAt = new Date().toISOString(),
): BuildUpdate {
  const name = cleanText(project.name, 'This project');
  const summary = cleanText(project.summary, `${name} is moving forward.`);
  const currentState = cleanText(project.currentState, 'The project has made visible progress.');
  const goals = cleanList(project.goals, ['make the product clearer and more useful']);
  const nextSteps = cleanList(project.nextSteps, ['collect feedback and decide what to improve next']);
  const inProgress = cleanList(project.inProgress);
  const openQuestions = cleanList(project.openQuestions);
  const assets = cleanList(project.importantAssets).map(publicAssetName);
  const changes = getShippingHighlights(project, 5);
  const workflowMode = getWorkflowModeConfig(project.workflowMode);
  const qualityWarning = getContentQualityWarning(project);
  const shippedItems = firstItems([
    ...changes,
    ...(changes.length > 0 ? [] : inProgress.map((item) => `Worked on ${item}`)),
    ...nextSteps.map((step) => `Prepared next step: ${step}`),
  ], 5);
  const primaryProgress = shippedItems[0] ?? currentState;
  const primaryGoal = goals[0] ?? 'make the project more useful';
  const primaryNextStep = nextSteps[0] ?? 'collect feedback';
  const feedbackAsk = openQuestions[0] ?? 'where the value is clear and where it still feels confusing';
  const workflowNote = workflowMode
    ? `Current working lens: ${workflowMode.label} - ${workflowMode.guidance}`
    : '';

  const sections: BuildUpdateSection[] = [
    {
      id: 'xUpdate',
      title: 'X/Twitter build update',
      bestFor: 'X/Twitter',
      content: [
        `Build update for ${name}:`,
        '',
        primaryProgress,
        '',
        `Why it matters: ${summary}`,
        `Next: ${primaryNextStep}`,
        '',
        `Feedback welcome, especially on ${feedbackAsk}.`,
      ].join('\n'),
    },
    {
      id: 'shortUpdate',
      title: 'Short what changed update',
      bestFor: 'Quick status',
      content: `${name}: ${primaryProgress} Next up: ${primaryNextStep}.`,
    },
    {
      id: 'linkedIn',
      title: 'LinkedIn-style update',
      bestFor: 'LinkedIn',
      content: [
        `I have been working on ${name}.`,
        '',
        summary,
        '',
        `Latest progress: ${currentState}`,
        workflowNote,
        '',
        'What changed:',
        bulletList(shippedItems.length > 0 ? shippedItems : [primaryProgress]),
        '',
        `The next focus is ${primaryNextStep}.`,
      ].filter(Boolean).join('\n'),
    },
    {
      id: 'reddit',
      title: 'Reddit-style progress update',
      bestFor: 'Reddit',
      content: [
        `Progress update on ${name}: ${summary}`,
        '',
        `Current state: ${currentState}`,
        '',
        'What changed recently:',
        bulletList(shippedItems.length > 0 ? shippedItems : [primaryProgress]),
        '',
        'What I am trying to improve:',
        bulletList(firstItems(goals, 3)),
        '',
        `Question for you: ${feedbackAsk}?`,
      ].join('\n'),
    },
    {
      id: 'indieHackers',
      title: 'Indie Hackers style update',
      bestFor: 'Indie Hackers',
      content: [
        `Tiny build update: ${name}`,
        '',
        `Problem: ${summary}`,
        `Progress: ${primaryProgress}`,
        `Decision: ${decisionSummary(project.decisions)}`,
        `Next experiment: ${primaryNextStep}`,
        '',
        `I am looking for feedback on ${feedbackAsk}.`,
      ].join('\n'),
    },
    {
      id: 'releaseNotes',
      title: 'Changelog/release note summary',
      bestFor: 'Release notes',
      content: [
        `## ${name} update`,
        '',
        `Status: ${currentState}`,
        '',
        'Changed:',
        bulletList(shippedItems.length > 0 ? shippedItems : [primaryProgress]),
        '',
        'Next:',
        bulletList(firstItems(nextSteps, 4)),
      ].join('\n'),
    },
    {
      id: 'feedbackRequest',
      title: 'Feedback request post',
      bestFor: 'Early users',
      content: [
        `I am looking for a few people to sanity-check ${name}.`,
        '',
        summary,
        '',
        `The latest progress is: ${primaryProgress}`,
        '',
        `If you take a look, I would value one specific note: ${feedbackAsk}.`,
      ].join('\n'),
    },
    {
      id: 'shippedThisWeek',
      title: 'What shipped this week',
      bestFor: 'Weekly update',
      content: [
        `What shipped this week on ${name}:`,
        '',
        bulletList(shippedItems.length > 0 ? shippedItems : [primaryProgress]),
        '',
        `Next week: ${primaryNextStep}`,
      ].join('\n'),
    },
    {
      id: 'founderReflection',
      title: 'Founder reflection / progress note',
      bestFor: 'Build in public',
      content: [
        `A useful lesson from building ${name}: the project keeps coming back to ${primaryGoal}.`,
        '',
        `This week the work moved to: ${currentState}`,
        '',
        `The decision I am carrying forward: ${decisionSummary(project.decisions)}.`,
        '',
        `Next I need to learn: ${feedbackAsk}.`,
      ].join('\n'),
    },
    {
      id: 'demoCaption',
      title: 'Demo clip caption',
      bestFor: 'Short video',
      content: [
        `${name} demo: ${summary}`,
        `In this clip: ${primaryProgress}`,
        assets.length > 0 ? `Visual to show: ${sentenceList(firstItems(assets, 2))}` : '',
        `Next: ${primaryNextStep}`,
      ].filter(Boolean).join('\n'),
    },
  ];

  const markdown = [
    `# Build Update: ${name}`,
    '',
    `Generated: ${generatedAt}`,
    '',
    ...(qualityWarning ? [`> ${qualityWarning}`, ''] : []),
    ...sections.flatMap((section) => [
      `## ${section.title}`,
      '',
      `Best for: ${section.bestFor}`,
      '',
      section.content,
      '',
    ]),
  ].join('\n').trim();

  return {
    projectName: name,
    generatedAt,
    qualityWarning,
    sections,
    markdown,
  };
}
