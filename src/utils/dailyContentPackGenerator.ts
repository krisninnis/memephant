import type { ChangelogEntry, Decision, ProjectMemory } from '../types/memphant-types';
import {
  cleanPublicList,
  cleanPublicText,
  filterPublicChangelog,
  filterPublicDecisions,
  publicAssetName,
} from './contextQuality';
import { getContentQualityWarning } from './contentReadiness';
import { getWorkflowModeConfig } from './workflowModes';

export type DailyContentPackSectionId =
  | 'xPost'
  | 'linkedInPost'
  | 'redditPost'
  | 'memeIdea'
  | 'founderReflection'
  | 'replyIdeas'
  | 'demoClipCaption'
  | 'feedbackQuestion'
  | 'whatShippedToday'
  | 'problemSolutionPost';

export type DailyContentPackSection = {
  id: DailyContentPackSectionId;
  title: string;
  bestFor: string;
  content: string;
};

export type DailyContentPack = {
  projectName: string;
  generatedAt: string;
  qualityWarning: string | null;
  sections: DailyContentPackSection[];
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

function recentChangeSummary(changelog: ChangelogEntry[] | undefined): string[] {
  return filterPublicChangelog(changelog, 5);
}

function decisionSummary(decisions: Decision[]): string {
  const useful = filterPublicDecisions(decisions, 2);

  return useful.length > 0 ? sentenceList(useful) : 'the product should stay clear, useful, and honest';
}

export function generateDailyContentPack(
  project: ProjectMemory,
  generatedAt = new Date().toISOString(),
): DailyContentPack {
  const name = cleanText(project.name, 'This project');
  const summary = cleanText(project.summary, `${name} helps users make progress.`);
  const currentState = cleanText(project.currentState, 'The project has visible progress today.');
  const goals = cleanList(project.goals, ['make the project easier to understand']);
  const nextSteps = cleanList(project.nextSteps, ['collect feedback and decide the next improvement']);
  const inProgress = cleanList(project.inProgress);
  const openQuestions = cleanList(project.openQuestions);
  const assets = cleanList(project.importantAssets).map(publicAssetName);
  const changes = recentChangeSummary(project.changelog);
  const workflowMode = getWorkflowModeConfig(project.workflowMode);
  const qualityWarning = getContentQualityWarning(project);
  const dailySignals = firstItems([
    ...changes,
    ...inProgress.map((item) => `Worked on ${item}`),
    ...nextSteps.map((step) => `Prepared next step: ${step}`),
  ], 5);
  const primaryProgress = dailySignals[0] ?? currentState;
  const primaryGoal = goals[0] ?? 'make the project more useful';
  const primaryNextStep = nextSteps[0] ?? 'collect feedback';
  const feedbackAsk = openQuestions[0] ?? 'where the value is clearest and where it still feels confusing';
  const workflowLine = workflowMode
    ? `Working lens: ${workflowMode.label} (${workflowMode.focus}).`
    : '';
  const shippedItems = dailySignals.length > 0 ? dailySignals : [primaryProgress];
  const visualCue = assets[0] ?? `${name} in its current state`;

  const sections: DailyContentPackSection[] = [
    {
      id: 'xPost',
      title: 'X post',
      bestFor: 'X',
      content: [
        `Today on ${name}: ${primaryProgress}`,
        '',
        `The goal is still simple: ${primaryGoal}.`,
        `Next: ${primaryNextStep}.`,
        '',
        `Feedback welcome on ${feedbackAsk}.`,
      ].join('\n'),
    },
    {
      id: 'linkedInPost',
      title: 'LinkedIn post',
      bestFor: 'LinkedIn',
      content: [
        `I am building ${name}.`,
        '',
        summary,
        '',
        `Today the work moved forward with: ${primaryProgress}`,
        workflowLine,
        '',
        'What matters right now:',
        bulletList(firstItems(goals, 3)),
        '',
        `The next useful step is ${primaryNextStep}.`,
      ].filter(Boolean).join('\n'),
    },
    {
      id: 'redditPost',
      title: 'Reddit post',
      bestFor: 'Reddit',
      content: [
        `I am working on ${name}: ${summary}`,
        '',
        `Current state: ${currentState}`,
        '',
        'What changed today:',
        bulletList(shippedItems),
        '',
        `Question: ${feedbackAsk}?`,
      ].join('\n'),
    },
    {
      id: 'memeIdea',
      title: 'Meme idea',
      bestFor: 'Visual prompt',
      content: [
        `Format: two-panel meme.`,
        `Panel 1: Someone trying to explain ${summary.toLowerCase()} from scratch every day.`,
        `Panel 2: ${name} calmly turning the current context into the next useful post.`,
        `Caption: "When the project finally remembers what shipped today."`,
      ].join('\n'),
    },
    {
      id: 'founderReflection',
      title: 'Founder reflection',
      bestFor: 'Build in public',
      content: [
        `A small lesson from building ${name}: ${primaryGoal} only matters if the latest progress is easy to explain.`,
        '',
        `Today that progress was: ${primaryProgress}`,
        '',
        `The decision guiding the work: ${decisionSummary(project.decisions)}.`,
        `Next I need to learn: ${feedbackAsk}.`,
      ].join('\n'),
    },
    {
      id: 'replyIdeas',
      title: 'Reply/comment ideas',
      bestFor: 'Comments',
      content: bulletList([
        `The newest thing to react to is ${primaryProgress}.`,
        `The part I am most curious about is ${feedbackAsk}.`,
        `The trade-off behind it is ${decisionSummary(project.decisions)}.`,
        `The next thing I am testing is ${primaryNextStep}.`,
      ]),
    },
    {
      id: 'demoClipCaption',
      title: 'Demo clip caption',
      bestFor: 'Short video',
      content: [
        `${name} demo clip: ${primaryProgress}`,
        `Watch for: ${visualCue}`,
        `Why it matters: ${summary}`,
        `Next: ${primaryNextStep}`,
      ].join('\n'),
    },
    {
      id: 'feedbackQuestion',
      title: 'Feedback question',
      bestFor: 'User research',
      content: `If you saw ${name} today, what would make ${feedbackAsk} easier to answer?`,
    },
    {
      id: 'whatShippedToday',
      title: 'What shipped today',
      bestFor: 'Daily update',
      content: [
        `What shipped today on ${name}:`,
        '',
        bulletList(shippedItems),
        '',
        `Next up: ${primaryNextStep}`,
      ].join('\n'),
    },
    {
      id: 'problemSolutionPost',
      title: 'Problem/solution post',
      bestFor: 'Positioning',
      content: [
        `Problem: ${summary}`,
        '',
        `Solution: ${name} is moving toward ${primaryGoal}.`,
        '',
        `Proof from today: ${primaryProgress}`,
        `Next: ${primaryNextStep}`,
      ].join('\n'),
    },
  ];

  const markdown = [
    `# Daily Content Pack: ${name}`,
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
