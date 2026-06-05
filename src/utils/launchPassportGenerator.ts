import type { ProjectMemory } from '../types/memphant-types';
import {
  cleanPublicList,
  cleanPublicText,
  filterPublicDecisions,
  publicAssetName,
} from './contextQuality';
import { getContentQualityWarning } from './contentReadiness';
import { getPublicPostContext } from './publicPostQuality';
import { getWorkflowModeConfigForProject } from './workflowModes';
import {
  getGamePlatformLabel,
  isGameProject,
} from './gameProjectTypes';

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
  | 'feedbackRequest'
  | 'gameDescription'
  | 'gameUpdateLog'
  | 'gamePlaytestRequest'
  | 'gameDevlogPost'
  | 'gameDiscordAnnouncement'
  | 'gameThumbnailChecklist'
  | 'gameFeedbackQuestions'
  | 'gameMonetisationChecklist'
  | 'gameRetentionQuestions';

export type LaunchPassportSection = {
  id: LaunchPassportSectionId;
  title: string;
  content: string;
};

export type LaunchPassport = {
  projectName: string;
  generatedAt: string;
  qualityWarning: string | null;
  progressWarning: string | null;
  sections: LaunchPassportSection[];
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

function sentenceList(items: string[]): string {
  if (items.length === 0) return 'the current project milestones';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function sentenceFragment(value: string): string {
  return value.replace(/[.!?]+$/g, '').trim();
}

function bulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

function numberedList(items: string[]): string {
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

const NO_RECENT_TITLE = 'No recent shipped updates found yet.';
const NO_RECENT_HELP = 'Add what changed recently to generate better posts.';
const RECENT_CHANGE_EXAMPLE =
  'Tell Memephant what changed recently, such as: Added Social Bridge, improved onboarding, fixed sign-in, shipped demo video.';

const TECHNICAL_STACK_DECISION_PATTERN =
  /\b(supabase|stripe|firebase|postgres|database|backend|frontend|api|auth provider|storage bucket|hosting|framework)\b/i;

export function generateLaunchPassport(
  project: ProjectMemory,
  generatedAt = new Date().toISOString(),
): LaunchPassport {
  const name = cleanText(project.name, 'This project');
  const summary = cleanText(project.summary, `${name} is preparing for launch.`);
  const projectReason = cleanText(project.projectReason);
  const currentState = cleanText(project.currentState, 'The project is ready for user feedback.');
  const goals = cleanList(project.goals, ['help users understand the product quickly']);
  const rules = cleanList(project.rules);
  const nextSteps = cleanList(project.nextSteps, ['share the launch draft', 'collect feedback']);
  const inProgress = cleanList(project.inProgress);
  const openQuestions = cleanList(project.openQuestions);
  const assets = cleanList(project.importantAssets).map(publicAssetName);
  const instructions = cleanText(project.aiInstructions);
  const workflowMode = getWorkflowModeConfigForProject(project.workflowMode, project);
  const qualityWarning = getContentQualityWarning(project);
  const publicPost = getPublicPostContext(project, 5);
  const publicDecisions = filterPublicDecisions(project.decisions, 2)
    .filter((decision) => !TECHNICAL_STACK_DECISION_PATTERN.test(decision));
  const progressWarning = publicPost.recentProgressWarning;
  const positioningSummary = publicPost.positioningSummary || summary;
  const problemFrame = projectReason || positioningSummary;
  const problemSentence = sentenceFragment(problemFrame);
  const recentHighlights = publicPost.recentHighlights;
  const keyGoal = goals[0] ?? 'help users get value faster';
  const keyNextStep = nextSteps[0] ?? 'collect feedback';
  const contextSignals = firstItems([
    ...recentHighlights.map((item) => `Shipped: ${item}`),
    ...publicDecisions.map((decision) => `Decision: ${decision}`),
    ...goals.map((goal) => `Goal: ${goal}`),
    ...inProgress.map((item) => `In progress: ${item}`),
    ...nextSteps.map((step) => `Next: ${step}`),
  ], 5);
  const gameContext = project.gameContext;
  const gameOverview = gameContext?.overview ?? {};
  const isGame = isGameProject(project);
  const gamePlatform = getGamePlatformLabel(project.gamePlatform, project.gamePlatformOther);
  const gameGenre = cleanText(gameOverview.genre, 'game');
  const gameCoreLoop = cleanText(gameOverview.coreLoop, positioningSummary);
  const playableState = cleanText(gameOverview.currentPlayableState, currentState);
  const monetisationPlan = cleanText(gameOverview.monetisationPlan, 'Review monetisation after playtest feedback');
  const scriptNames = cleanList(gameContext?.scriptVault?.map((script) => script.scriptName), []);
  const knownBugTitles = cleanList(gameContext?.knownBugs?.map((bug) => bug.title), []);
  const isRobloxGame = project.gamePlatform === 'roblox';

  const sections: LaunchPassportSection[] = [
    {
      id: 'positioning',
      title: 'One-line positioning',
      content: [
        `${name}: ${positioningSummary}`,
        `Why it exists: ${problemFrame}`,
      ].join('\n'),
    },
    {
      id: 'xLaunch',
      title: 'X/Twitter launch post',
      content: [
        `Launching ${name}.`,
        '',
        positioningSummary,
        '',
        `Why it exists: ${problemFrame}`,
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
      content: `${name} is live: ${positioningSummary} Why it exists: ${problemFrame} Feedback welcome.`,
    },
    {
      id: 'reddit',
      title: 'Reddit launch version',
      content: [
        `I built ${name} to solve this problem: ${problemFrame}`,
        '',
        `What it does: ${positioningSummary}`,
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
        `Show HN: ${name} - ${positioningSummary}`,
        '',
        `I built this because ${problemSentence}.`,
        '',
        `Current state: ${currentState}`,
        recentHighlights.length > 0 ? `What shipped: ${sentenceList(firstItems(recentHighlights, 2))}.` : '',
        recentHighlights.length === 0 ? `${NO_RECENT_TITLE} ${NO_RECENT_HELP}` : '',
        recentHighlights.length === 0 ? RECENT_CHANGE_EXAMPLE : '',
        '',
        'Useful context:',
        bulletList(contextSignals.length > 0 ? contextSignals : [`Next: ${keyNextStep}`]),
      ].join('\n'),
    },
    {
      id: 'founderStory',
      title: 'Founder story / why I built this',
      content: [
        `I built ${name} because ${problemSentence}.`,
        '',
        recentHighlights.length > 0
          ? `The latest visible progress: ${sentenceList(firstItems(recentHighlights, 2))}.`
          : `The product is currently here: ${currentState}`,
        '',
        `The launch goal now is to make that problem and outcome obvious quickly.`,
        instructions ? `\nWorking style note: ${instructions}` : '',
      ].filter(Boolean).join('\n'),
    },
    {
      id: 'demoVideo',
      title: 'Demo video outline',
      content: numberedList([
        `Open ${name} and state why it exists: ${problemSentence}`,
        `Show the product promise: ${positioningSummary}`,
        recentHighlights.length > 0
          ? `Show what recently changed: ${sentenceList(firstItems(recentHighlights, 2))}`
          : `Show the current product state: ${currentState}`,
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
        positioningSummary,
        '',
        `If you try it, I would love one specific note: where did the value become clear, and where did it feel confusing?`,
      ].join('\n'),
    },
    ...(isGame ? [
      {
        id: 'gameDescription' as const,
        title: isRobloxGame ? 'Roblox game description' : 'Game description',
        content: [
          `${name} is a ${gameGenre} for ${gamePlatform}.`,
          '',
          `Core loop: ${gameCoreLoop}`,
          `Playable state: ${playableState}`,
          `Target player: ${cleanText(gameOverview.targetPlayer, 'players who enjoy the core loop')}`,
          `Art style: ${cleanText(gameOverview.artStyle, 'still being refined')}`,
        ].join('\n'),
      },
      {
        id: 'gameUpdateLog' as const,
        title: 'Update log',
        content: bulletList([
          ...firstItems(recentHighlights, 4),
          ...firstItems(nextSteps, 3).map((step) => `Next: ${step}`),
          ...(knownBugTitles.length > 0 ? firstItems(knownBugTitles, 3).map((bug) => `Known issue: ${bug}`) : []),
        ].length > 0
          ? [
              ...firstItems(recentHighlights, 4),
              ...firstItems(nextSteps, 3).map((step) => `Next: ${step}`),
              ...(knownBugTitles.length > 0 ? firstItems(knownBugTitles, 3).map((bug) => `Known issue: ${bug}`) : []),
            ]
          : ['Document the next playable update before posting.']),
      },
      {
        id: 'gamePlaytestRequest' as const,
        title: 'Playtest request',
        content: [
          `I am looking for playtesters for ${name}.`,
          '',
          `Platform: ${gamePlatform}`,
          `Current playable state: ${playableState}`,
          `Please focus on whether this loop is clear and fun: ${gameCoreLoop}`,
          '',
          'Useful feedback:',
          bulletList([
            'Where did you understand what to do?',
            'Where did you get stuck or bored?',
            'Did any script, UI, saving, event, or progression issue appear?',
            'What would make you play another round?',
          ]),
        ].join('\n'),
      },
      {
        id: 'gameDevlogPost' as const,
        title: 'X/Twitter devlog post',
        content: [
          `Devlog for ${name}:`,
          '',
          `Core loop: ${gameCoreLoop}`,
          `Current state: ${playableState}`,
          scriptNames.length > 0 ? `Scripts in focus: ${sentenceList(firstItems(scriptNames, 3))}` : '',
          knownBugTitles.length > 0 ? `Known bug I am chasing: ${knownBugTitles[0]}` : '',
          '',
          'Playtest feedback welcome.',
        ].filter(Boolean).join('\n'),
      },
      {
        id: 'gameDiscordAnnouncement' as const,
        title: 'Discord announcement',
        content: [
          `New ${name} playtest/update is ready.`,
          '',
          `What to try: ${gameCoreLoop}`,
          `Current state: ${playableState}`,
          '',
          'Please share:',
          bulletList([
            'first confusing moment',
            'best/funniest moment',
            'bugs or broken scripts',
            'what you wanted to do next',
          ]),
        ].join('\n'),
      },
      {
        id: 'gameThumbnailChecklist' as const,
        title: isRobloxGame ? 'Thumbnail/icon checklist' : 'Game visual checklist',
        content: bulletList([
          isRobloxGame ? 'Roblox icon clearly shows the main fantasy or mechanic' : 'Store/header image clearly shows the main fantasy or mechanic',
          'Thumbnail shows the player goal, obstacle, or reward',
          'Image reads clearly on mobile',
          'Title text is short enough to scan',
          'Screenshots show live gameplay, UI, and progress/reward state',
        ]),
      },
      {
        id: 'gameFeedbackQuestions' as const,
        title: 'Feedback questions',
        content: bulletList([
          'What did you think the goal was in the first 30 seconds?',
          'What felt fun enough to repeat?',
          'What felt confusing, slow, unfair, or broken?',
          'Which system should be improved next?',
          'Would the monetisation feel optional and fair?',
        ]),
      },
      {
        id: 'gameMonetisationChecklist' as const,
        title: 'Monetisation checklist',
        content: bulletList([
          `Current plan: ${monetisationPlan}`,
          isRobloxGame ? 'Gamepasses or developer products support the fun instead of blocking it' : 'Paid items support the fun instead of blocking it',
          'No paid item is required to understand the core loop',
          'Prices and rewards are understandable before purchase',
          'Playtesters can explain what feels worth paying for',
        ]),
      },
      {
        id: 'gameRetentionQuestions' as const,
        title: 'Retention questions',
        content: bulletList([
          'What makes a player start a second round/session?',
          'What progress persists between sessions?',
          'What unlock, quest, collection, or social goal pulls players back?',
          'Where does the game become repetitive?',
          'Which bug would most damage trust if left unfixed?',
        ]),
      },
    ] satisfies LaunchPassportSection[] : []),
  ];

  const markdown = [
    `# Launch Passport: ${name}`,
    '',
    `Generated: ${generatedAt}`,
    '',
    ...(qualityWarning ? [`> ${qualityWarning}`, ''] : []),
    ...(progressWarning ? [`> ${progressWarning}`, ''] : []),
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
    qualityWarning,
    progressWarning,
    sections,
    markdown,
  };
}
