import type { Decision, ProjectMemory } from '../types/memphant-types';
import {
  cleanPublicList,
  cleanPublicText,
  filterPublicDecisions,
  publicAssetName,
} from './contextQuality';
import { getContentQualityWarning } from './contentReadiness';
import { getPublicPostContext } from './publicPostQuality';
import { getWorkflowModeConfigForProject } from './workflowModes';
import { getGamePlatformLabel, isGameProject } from './gameProjectTypes';

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
  | 'demoCaption'
  | 'gameplayProgress'
  | 'playtestUpdate';

export type BuildUpdateSection = {
  id: BuildUpdateSectionId;
  title: string;
  bestFor: string;
  content: string;
  shareable: boolean;
  shareDisabledReason?: string;
};

export type BuildUpdate = {
  projectName: string;
  generatedAt: string;
  qualityWarning: string | null;
  progressWarning: string | null;
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

const NO_RECENT_TITLE = 'No recent shipped updates found yet.';
const NO_RECENT_HELP = 'Add what changed recently to generate better posts.';
const RECENT_CHANGE_EXAMPLE =
  'Tell Memephant what changed recently, such as: Added Social Bridge, improved onboarding, fixed sign-in, shipped demo video.';

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
  const openQuestions = cleanList(project.openQuestions);
  const assets = cleanList(project.importantAssets).map(publicAssetName);
  const publicPost = getPublicPostContext(project, 5);
  const workflowMode = getWorkflowModeConfigForProject(project.workflowMode, project);
  const qualityWarning = getContentQualityWarning(project);
  const progressWarning = publicPost.recentProgressWarning;
  const positioningSummary = publicPost.positioningSummary || summary;
  const shippedItems = firstItems(publicPost.recentHighlights, 5);
  const primaryRecentHighlight = publicPost.primaryRecentHighlight;
  const primaryPublicTopic = primaryRecentHighlight ?? positioningSummary;
  const primaryGoal = goals[0] ?? 'make the project more useful';
  const primaryNextStep = nextSteps[0] ?? 'collect feedback';
  const feedbackAsk = openQuestions[0] ?? publicPost.feedbackAsk;
  const workflowNote = workflowMode
    ? `Current working lens: ${workflowMode.label} - ${workflowMode.guidance}`
    : '';
  const changedList = shippedItems.length > 0
    ? bulletList(shippedItems)
    : bulletList([NO_RECENT_TITLE, NO_RECENT_HELP, RECENT_CHANGE_EXAMPLE]);
  const hasRecentProgress = shippedItems.length > 0;
  const shareDisabledReason = hasRecentProgress ? undefined : NO_RECENT_HELP;
  const isGame = isGameProject(project);
  const gameOverview = project.gameContext?.overview ?? {};
  const gamePlatform = getGamePlatformLabel(project.gamePlatform, project.gamePlatformOther);
  const gameCoreLoop = cleanText(gameOverview.coreLoop, positioningSummary);
  const playableState = cleanText(gameOverview.currentPlayableState, currentState);
  const scriptNames = cleanList(project.gameContext?.scriptVault?.map((script) => script.scriptName), []);
  const knownBugTitles = cleanList(project.gameContext?.knownBugs?.map((bug) => bug.title), []);

  const sections: BuildUpdateSection[] = [
    {
      id: 'xUpdate',
      title: 'X/Twitter build update',
      bestFor: 'X/Twitter',
      content: [
        `Build update for ${name}:`,
        '',
        hasRecentProgress ? primaryPublicTopic : NO_RECENT_TITLE,
        '',
        `Why it matters: ${positioningSummary}`,
        ...(hasRecentProgress ? [] : ['', RECENT_CHANGE_EXAMPLE]),
        '',
        `Feedback welcome, especially on ${feedbackAsk}.`,
      ].join('\n'),
      shareable: hasRecentProgress,
      shareDisabledReason,
    },
    {
      id: 'shortUpdate',
      title: 'Short what changed update',
      bestFor: 'Quick status',
      content: hasRecentProgress
        ? `${name}: ${primaryPublicTopic}`
        : `${name}: ${NO_RECENT_TITLE} ${NO_RECENT_HELP}`,
      shareable: hasRecentProgress,
      shareDisabledReason,
    },
    {
      id: 'linkedIn',
      title: 'LinkedIn-style update',
      bestFor: 'LinkedIn',
      content: [
        `I have been working on ${name}.`,
        '',
        positioningSummary,
        '',
        `Latest progress: ${currentState}`,
        workflowNote,
        '',
        'What changed:',
        changedList,
        '',
        `The next focus is ${primaryNextStep}.`,
      ].filter(Boolean).join('\n'),
      shareable: hasRecentProgress,
      shareDisabledReason,
    },
    {
      id: 'reddit',
      title: 'Reddit-style progress update',
      bestFor: 'Reddit',
      content: [
        `Progress update on ${name}: ${positioningSummary}`,
        '',
        `Current state: ${currentState}`,
        '',
        'What changed recently:',
        changedList,
        '',
        'What I am trying to improve:',
        bulletList(firstItems(goals, 3)),
        '',
        `Question for you: ${feedbackAsk}?`,
      ].join('\n'),
      shareable: hasRecentProgress,
      shareDisabledReason,
    },
    {
      id: 'indieHackers',
      title: 'Indie Hackers style update',
      bestFor: 'Indie Hackers',
      content: [
        `Tiny build update: ${name}`,
        '',
        `Problem: ${positioningSummary}`,
        `Progress: ${primaryPublicTopic}`,
        `Decision: ${decisionSummary(project.decisions)}`,
        `Next experiment: ${primaryNextStep}`,
        '',
        `I am looking for feedback on ${feedbackAsk}.`,
      ].join('\n'),
      shareable: hasRecentProgress,
      shareDisabledReason,
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
        changedList,
        '',
        'Next:',
        bulletList(firstItems(nextSteps, 4)),
      ].join('\n'),
      shareable: hasRecentProgress,
      shareDisabledReason,
    },
    {
      id: 'feedbackRequest',
      title: 'Feedback request post',
      bestFor: 'Early users',
      content: [
        `I am looking for a few people to sanity-check ${name}.`,
        '',
        positioningSummary,
        '',
        `The latest progress is: ${primaryPublicTopic}`,
        '',
        `If you take a look, I would value one specific note: ${feedbackAsk}.`,
      ].join('\n'),
      shareable: hasRecentProgress,
      shareDisabledReason,
    },
    {
      id: 'shippedThisWeek',
      title: 'What shipped this week',
      bestFor: 'Weekly update',
      content: [
        `What shipped this week on ${name}:`,
        '',
        changedList,
        '',
        `Feedback wanted: ${feedbackAsk}`,
      ].join('\n'),
      shareable: hasRecentProgress,
      shareDisabledReason,
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
      shareable: hasRecentProgress,
      shareDisabledReason,
    },
    {
      id: 'demoCaption',
      title: 'Demo clip caption',
      bestFor: 'Short video',
      content: [
        `${name} demo: ${positioningSummary}`,
        `In this clip: ${hasRecentProgress ? primaryPublicTopic : NO_RECENT_TITLE}`,
        ...(hasRecentProgress ? [] : [RECENT_CHANGE_EXAMPLE]),
        assets.length > 0 ? `Visual to show: ${sentenceList(firstItems(assets, 2))}` : '',
        `Feedback wanted: ${feedbackAsk}`,
      ].filter(Boolean).join('\n'),
      shareable: hasRecentProgress,
      shareDisabledReason,
    },
    ...(isGame ? [
      {
        id: 'gameplayProgress' as const,
        title: 'Gameplay progress update',
        bestFor: 'Devlog',
        content: [
          `Gameplay update for ${name} (${gamePlatform}):`,
          '',
          `Core loop: ${gameCoreLoop}`,
          `Playable state: ${playableState}`,
          scriptNames.length > 0 ? `Scripts in focus: ${sentenceList(firstItems(scriptNames, 3))}` : '',
          knownBugTitles.length > 0 ? `Known bug in focus: ${knownBugTitles[0]}` : '',
          '',
          `Next: ${primaryNextStep}`,
        ].filter(Boolean).join('\n'),
        shareable: hasRecentProgress,
        shareDisabledReason,
      },
      {
        id: 'playtestUpdate' as const,
        title: 'Playtest update',
        bestFor: 'Playtesters',
        content: [
          `I am testing ${name} on ${gamePlatform}.`,
          '',
          `Please try this loop: ${gameCoreLoop}`,
          `Current build state: ${playableState}`,
          '',
          'Feedback wanted:',
          bulletList([
            'what felt fun or confusing',
            'bugs, broken scripts, event issues, or saving problems',
            'what made you want to keep playing or stop',
          ]),
        ].join('\n'),
        shareable: hasRecentProgress,
        shareDisabledReason,
      },
    ] satisfies BuildUpdateSection[] : []),
  ];

  const markdown = [
    `# Build Update: ${name}`,
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
