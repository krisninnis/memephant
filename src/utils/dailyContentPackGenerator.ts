import type { Decision, ProjectMemory } from '../types/memphant-types';
import {
  cleanPublicList,
  cleanPublicText,
  filterPublicDecisions,
  publicAssetName,
} from './contextQuality';
import { getContentQualityWarning } from './contentReadiness';
import { getPublicPostContext } from './publicPostQuality';
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
  progressWarning: string | null;
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
  const openQuestions = cleanList(project.openQuestions);
  const assets = cleanList(project.importantAssets).map(publicAssetName);
  const publicPost = getPublicPostContext(project, 5);
  const workflowMode = getWorkflowModeConfig(project.workflowMode);
  const qualityWarning = getContentQualityWarning(project);
  const progressWarning = publicPost.recentProgressWarning;
  const positioningSummary = publicPost.positioningSummary || summary;
  const dailySignals = firstItems(publicPost.recentHighlights, 5);
  const primaryRecentHighlight = publicPost.primaryRecentHighlight;
  const primaryPublicTopic = primaryRecentHighlight ?? positioningSummary;
  const primaryGoal = goals[0] ?? 'make the project more useful';
  const feedbackAsk = openQuestions[0] ?? publicPost.feedbackAsk;
  const workflowLine = workflowMode
    ? `Working lens: ${workflowMode.label} (${workflowMode.focus}).`
    : '';
  const shippedItems = dailySignals;
  const shippedList = shippedItems.length > 0
    ? bulletList(shippedItems)
    : progressWarning ?? 'No meaningful shipped updates found yet.';
  const visualCue = assets[0] ?? `${name} in its current state`;

  const sections: DailyContentPackSection[] = [
    {
      id: 'xPost',
      title: 'X post',
      bestFor: 'X',
      content: [
        `Today on ${name}: ${primaryPublicTopic}`,
        '',
        `The goal is still simple: ${primaryGoal}.`,
        `Why it matters: ${positioningSummary}`,
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
        positioningSummary,
        '',
        primaryRecentHighlight
          ? `Today the work moved forward with: ${primaryRecentHighlight}`
          : `No recent shipped update was found yet. The project is still positioned around: ${positioningSummary}`,
        workflowLine,
        '',
        'What matters right now:',
        bulletList(firstItems(goals, 3)),
        '',
        `I am looking for feedback on ${feedbackAsk}.`,
      ].filter(Boolean).join('\n'),
    },
    {
      id: 'redditPost',
      title: 'Reddit post',
      bestFor: 'Reddit',
      content: [
        `I am working on ${name}: ${positioningSummary}`,
        '',
        `Current state: ${currentState}`,
        '',
        'What changed today:',
        shippedList,
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
        `Panel 1: Someone trying to explain ${positioningSummary.toLowerCase()} from scratch every day.`,
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
        primaryRecentHighlight
          ? `Today that progress was: ${primaryRecentHighlight}`
          : `No recent shipped update was found yet, so I am tightening how the project is explained: ${positioningSummary}`,
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
        primaryRecentHighlight
          ? `The newest thing to react to is ${primaryRecentHighlight}.`
          : `The clearest current topic is ${positioningSummary}.`,
        `The part I am most curious about is ${feedbackAsk}.`,
        `The trade-off behind it is ${decisionSummary(project.decisions)}.`,
        `The reason it matters is ${positioningSummary}`,
      ]),
    },
    {
      id: 'demoClipCaption',
      title: 'Demo clip caption',
      bestFor: 'Short video',
      content: [
        `${name} demo clip: ${primaryPublicTopic}`,
        `Watch for: ${visualCue}`,
        `Why it matters: ${positioningSummary}`,
        `Feedback wanted: ${feedbackAsk}`,
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
        shippedList,
        '',
        `Feedback wanted: ${feedbackAsk}`,
      ].join('\n'),
    },
    {
      id: 'problemSolutionPost',
      title: 'Problem/solution post',
      bestFor: 'Positioning',
      content: [
        `Problem: ${positioningSummary}`,
        '',
        `Solution: ${name} is moving toward ${primaryGoal}.`,
        '',
        primaryRecentHighlight
          ? `Proof from today: ${primaryRecentHighlight}`
          : `Recent proof: ${progressWarning ?? 'No meaningful shipped updates found yet.'}`,
        `Feedback wanted: ${feedbackAsk}`,
      ].join('\n'),
    },
  ];

  const markdown = [
    `# Daily Content Pack: ${name}`,
    '',
    `Generated: ${generatedAt}`,
    '',
    ...(qualityWarning ? [`> ${qualityWarning}`, ''] : []),
    ...(progressWarning ? [`> ${progressWarning}`, ''] : []),
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
    progressWarning,
    sections,
    markdown,
  };
}
