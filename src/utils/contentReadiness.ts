import type { ProjectMemory } from '../types/memphant-types';
import {
  cleanPublicList,
  cleanPublicText,
  filterPublicChangelog,
  isPlaceholderText,
  uniqueStable,
} from './contextQuality';
import { getWorkflowModeConfig } from './workflowModes';

export type ContentReadinessStatus = 'strong' | 'weak' | 'missing';

export type ContentReadinessSignalId =
  | 'targetAudience'
  | 'problemStatement'
  | 'outcomeStatement'
  | 'differentiator'
  | 'tractionProgress'
  | 'specificGoals'
  | 'projectSummary'
  | 'workflowClarity'
  | 'founderSignal'
  | 'lowSignalRepetition';

export type ContentReadinessSignal = {
  id: ContentReadinessSignalId;
  label: string;
  status: ContentReadinessStatus;
  score: number;
  evidence: string;
  suggestion: string;
};

export type ContentReadinessReport = {
  score: number;
  strengths: string[];
  weakAreas: string[];
  suggestedImprovements: string[];
  missingSignals: string[];
  signals: ContentReadinessSignal[];
  warning: string | null;
};

const AUDIENCE_PATTERNS = [
  /\bfor\s+(people|users|teams|founders|builders|developers|designers|makers|creators|customers|students|agencies)\b/i,
  /\b(people|users|teams|founders|builders|developers|designers|makers|creators|customers|students|agencies)\s+who\b/i,
  /\bearly users\b/i,
  /\btarget audience\b/i,
];

const PROBLEM_PATTERNS = [
  /\bproblem\b/i,
  /\bpain\b/i,
  /\bfriction\b/i,
  /\bstruggle\b/i,
  /\bhard to\b/i,
  /\bdifficult\b/i,
  /\bconfusing\b/i,
  /\bslow\b/i,
  /\bwaste\b/i,
  /\bre-explain\b/i,
  /\bwithout having to\b/i,
  /\blosing momentum\b/i,
  /\brebuilding context\b/i,
  /\brebuild context\b/i,
  /\bfrom scratch\b/i,
  /\brepeating yourself\b/i,
  /\brepeat yourself\b/i,
  /\bevery AI\b/i,
  /\bswitching tools without continuity\b/i,
  /\blosing project state\b/i,
  /\brestarting conversations\b/i,
  /\brestart conversations\b/i,
];

const OUTCOME_PATTERNS = [
  /\bso (people|users|teams|founders|builders|developers|customers) can\b/i,
  /\bhelps?\b/i,
  /\benables?\b/i,
  /\bturns?\b/i,
  /\bsaves?\b/i,
  /\breduces?\b/i,
  /\bimproves?\b/i,
  /\bget\b/i,
  /\bship\b/i,
  /\bunderstand\b/i,
  /\bmove your project between AI tools\b/i,
  /\bbetween AI tools without\b/i,
  /\bwithout ever rebuilding context\b/i,
  /\bwithout rebuilding context\b/i,
  /\bmaintain continuity\b/i,
  /\bkeep continuity\b/i,
  /\bkeep project state\b/i,
];

const EMOTIONAL_PAIN_PATTERNS = [
  /\blosing momentum\b/i,
  /\brebuilding context from scratch\b/i,
  /\brebuilding context\b/i,
  /\brepeating yourself to every AI\b/i,
  /\brepeating yourself\b/i,
  /\bswitching tools without continuity\b/i,
  /\blosing project state\b/i,
  /\brestarting conversations\b/i,
];

const DIFFERENTIATOR_PATTERNS = [
  /\blocal-first\b/i,
  /\bdeterministic\b/i,
  /\bcopy-only\b/i,
  /\bprivate\b/i,
  /\bwithout\b/i,
  /\bunlike\b/i,
  /\bcompared\b/i,
  /\binstead of\b/i,
  /\bseparate from\b/i,
  /\bnot\b.+\b(api|oauth|cloud|telemetry|automation)\b/i,
];

const FOUNDER_PATTERNS = [
  /\bi (built|am building|made|shipped|learned)\b/i,
  /\bwe (built|are building|made|shipped|learned)\b/i,
  /\bfounder\b/i,
  /\bbuild in public\b/i,
  /\bbuilding in public\b/i,
  /\bshipped\b/i,
];

const LOW_SIGNAL_PHRASES = [
  'make the project better',
  'make the product better',
  'make it useful',
  'improve the experience',
  'help users',
  'get feedback',
  'ship safely',
  'launch mvp',
  'make progress',
  'easy to use',
  'user friendly',
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function textHas(patterns: RegExp[], text: string): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function listText(items: string[] | undefined): string {
  return cleanPublicList(items).join(' ');
}

function hasSpecificText(value: string, minWords = 7): boolean {
  const cleaned = cleanPublicText(value);
  if (!cleaned || isPlaceholderText(cleaned)) return false;
  return cleaned.split(/\s+/).length >= minWords;
}

function statusFromScore(score: number): ContentReadinessStatus {
  if (score >= 8) return 'strong';
  if (score >= 4) return 'weak';
  return 'missing';
}

function makeSignal(
  id: ContentReadinessSignalId,
  label: string,
  score: number,
  evidence: string,
  suggestion: string,
): ContentReadinessSignal {
  return {
    id,
    label,
    status: statusFromScore(score),
    score,
    evidence,
    suggestion,
  };
}

function hasMeasurableOrConcreteGoal(goal: string): boolean {
  const cleaned = cleanPublicText(goal);
  if (!cleaned || isPlaceholderText(cleaned)) return false;
  const words = cleaned.split(/\s+/);
  return (
    words.length >= 5 &&
    (
      /\b\d+[%x]?\b/.test(cleaned) ||
      /\b(first|daily|weekly|demo|launch|content|copy|users|customers|feedback|local|workflow|passport|export|clip|post)\b/i.test(cleaned)
    )
  );
}

function lowSignalRepetitions(project: ProjectMemory): string[] {
  const values = [
    project.summary,
    project.currentState,
    project.lastSessionSummary,
    ...(project.goals ?? []),
    ...(project.nextSteps ?? []),
    ...(project.openQuestions ?? []),
  ].map((value) => normalize(cleanPublicText(value))).filter(Boolean);

  const repeatedKnown = LOW_SIGNAL_PHRASES.filter((phrase) => {
    const normalizedPhrase = normalize(phrase);
    const matches = values.filter((value) => value.includes(normalizedPhrase));
    return matches.length >= 2;
  });

  const seen = new Map<string, number>();
  values.forEach((value) => {
    if (value.split(/\s+/).length <= 8) {
      seen.set(value, (seen.get(value) ?? 0) + 1);
    }
  });
  const repeatedExact = [...seen.entries()]
    .filter(([value, count]) => count >= 2 && value.length > 0)
    .map(([value]) => value);

  return uniqueStable([...repeatedKnown, ...repeatedExact]).slice(0, 4);
}

export function evaluateContentReadiness(project: ProjectMemory): ContentReadinessReport {
  const summary = cleanPublicText(project.summary);
  const currentState = cleanPublicText(project.currentState);
  const goals = cleanPublicList(project.goals);
  const nextSteps = cleanPublicList(project.nextSteps);
  const inProgress = cleanPublicList(project.inProgress);
  const openQuestions = cleanPublicList(project.openQuestions);
  const decisions = cleanPublicList(project.decisions.map((decision) => decision.decision));
  const workflowMode = getWorkflowModeConfig(project.workflowMode);
  const changelog = filterPublicChangelog(project.changelog, 3);
  const combined = [
    summary,
    currentState,
    listText(project.goals),
    listText(project.nextSteps),
    listText(project.openQuestions),
    listText(project.inProgress),
    decisions.join(' '),
  ].join(' ');
  const repeated = lowSignalRepetitions(project);
  const concreteGoals = goals.filter(hasMeasurableOrConcreteGoal);
  const hasSummary = hasSpecificText(summary, 8);
  const hasProgress = changelog.length > 0 || inProgress.length > 0 || hasSpecificText(currentState, 7);
  const hasAudienceSignal = textHas(AUDIENCE_PATTERNS, combined);
  const hasAudienceTerm = /\b(user|customer|people|team|founder|developer|builder|ai tools?)\b/i.test(combined);
  const hasProblemSignal = textHas(PROBLEM_PATTERNS, combined);
  const hasEmotionalPain = textHas(EMOTIONAL_PAIN_PATTERNS, combined);
  const hasOutcomeSignal = textHas(OUTCOME_PATTERNS, combined);

  const signals: ContentReadinessSignal[] = [
    makeSignal(
      'targetAudience',
      'Clear target audience',
      hasAudienceSignal ? 10 : hasAudienceTerm ? 5 : 0,
      hasAudienceSignal ? 'Audience language is present.' : 'No clear audience phrase found.',
      'Describe who this is for.',
    ),
    makeSignal(
      'problemStatement',
      'Problem statement',
      hasEmotionalPain ? 10 : hasProblemSignal ? 9 : openQuestions.length > 0 ? 5 : 0,
      hasEmotionalPain ? 'Emotional pain language is present.' : hasProblemSignal ? 'Pain or problem language is present.' : 'The user pain is not explicit.',
      'Add a clearer pain statement.',
    ),
    makeSignal(
      'outcomeStatement',
      'Outcome statement',
      hasOutcomeSignal && hasSummary ? 10 : hasOutcomeSignal ? 7 : 0,
      hasOutcomeSignal ? 'Outcome-oriented wording is present.' : 'The user outcome is not clear yet.',
      'Explain the outcome users get.',
    ),
    makeSignal(
      'differentiator',
      'Differentiator',
      textHas(DIFFERENTIATOR_PATTERNS, combined) ? 10 : decisions.length > 0 ? 5 : 0,
      textHas(DIFFERENTIATOR_PATTERNS, combined) ? 'Differentiating language is present.' : 'The project does not say why this approach is different.',
      'Explain what makes this different from alternatives.',
    ),
    makeSignal(
      'tractionProgress',
      'Current traction/progress',
      hasProgress ? 10 : nextSteps.length > 0 ? 5 : 0,
      hasProgress ? 'Current state, changelog, or in-progress work gives fresh progress.' : 'Recent progress is light or missing.',
      'Add one concrete thing that changed recently.',
    ),
    makeSignal(
      'specificGoals',
      'Specific goals',
      concreteGoals.length >= 2 ? 10 : concreteGoals.length === 1 ? 6 : goals.length > 0 ? 3 : 0,
      concreteGoals.length > 0 ? 'At least one goal is specific.' : 'Goals are missing or broad.',
      'Your goals are broad; make one measurable.',
    ),
    makeSignal(
      'projectSummary',
      'Clear project summary',
      hasSummary ? 10 : summary ? 4 : 0,
      hasSummary ? 'Summary has usable detail.' : summary ? 'Summary exists but reads thin or generic.' : 'Summary is missing or placeholder text.',
      isPlaceholderText(project.summary || '') ? 'Replace placeholder setup text.' : 'Your current summary is too generic.',
    ),
    makeSignal(
      'workflowClarity',
      'Workflow clarity',
      workflowMode ? 10 : nextSteps.length > 0 || inProgress.length > 0 ? 5 : 0,
      workflowMode ? `${workflowMode.label} is selected.` : 'No workflow mode is selected.',
      'Choose a workflow mode or add clearer next steps.',
    ),
    makeSignal(
      'founderSignal',
      'Founder/build-in-public signal',
      textHas(FOUNDER_PATTERNS, combined) || project.lastSessionSummary ? 10 : hasProgress ? 5 : 0,
      textHas(FOUNDER_PATTERNS, combined) ? 'Build-in-public language is present.' : 'The builder perspective is not very visible.',
      'Add a short founder note about what changed or what you learned.',
    ),
    makeSignal(
      'lowSignalRepetition',
      'Low-signal repetition',
      repeated.length === 0 ? 10 : repeated.length === 1 ? 5 : 0,
      repeated.length === 0 ? 'No repeated low-signal phrases found.' : `Repeated phrase: ${repeated[0]}`,
      'Remove repeated generic phrases and make each field do a different job.',
    ),
  ];

  const readinessBoost = Math.min(
    5,
    (hasEmotionalPain ? 2 : 0) +
      (hasOutcomeSignal ? 1 : 0) +
      (hasAudienceTerm && hasProblemSignal && hasOutcomeSignal ? 2 : 0),
  );
  const score = Math.min(100, Math.round(signals.reduce((sum, signal) => sum + signal.score, 0) + readinessBoost));
  const strengths = signals
    .filter((signal) => signal.status === 'strong')
    .map((signal) => `${signal.label}: ${signal.evidence}`);
  const weakAreas = signals
    .filter((signal) => signal.status !== 'strong')
    .map((signal) => `${signal.label}: ${signal.evidence}`);
  const suggestedImprovements = uniqueStable(
    signals
      .filter((signal) => signal.status !== 'strong')
      .map((signal) => signal.suggestion),
  );
  const missingSignals = signals
    .filter((signal) => signal.status === 'missing')
    .map((signal) => signal.label);

  return {
    score,
    strengths,
    weakAreas,
    suggestedImprovements,
    missingSignals,
    signals,
    warning: getContentQualityWarningFromSignals(signals, project),
  };
}

function getContentQualityWarningFromSignals(
  signals: ContentReadinessSignal[],
  project: ProjectMemory,
): string | null {
  const summarySignal = signals.find((signal) => signal.id === 'projectSummary');
  if (!project.summary || isPlaceholderText(project.summary) || summarySignal?.status === 'missing') {
    return 'Content quality may be limited because the project summary is incomplete.';
  }

  const audienceSignal = signals.find((signal) => signal.id === 'targetAudience');
  if (audienceSignal?.status === 'missing') {
    return 'Content quality may be limited because the target audience is unclear.';
  }

  const problemSignal = signals.find((signal) => signal.id === 'problemStatement');
  if (problemSignal?.status === 'missing') {
    return 'Content quality may be limited because the pain statement is unclear.';
  }

  const score = Math.round(signals.reduce((sum, signal) => sum + signal.score, 0));
  if (score < 60) {
    return 'Content quality may be limited because the project positioning needs more detail.';
  }

  return null;
}

export function getContentQualityWarning(project: ProjectMemory): string | null {
  return evaluateContentReadiness(project).warning;
}
