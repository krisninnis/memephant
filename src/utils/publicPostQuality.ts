import type { ProjectMemory } from '../types/memphant-types';
import { cleanPublicList, cleanPublicText, uniqueStable } from './contextQuality';
import { assessPublicSignal } from './publicSignal';
import { getShippingHighlights } from './shippingHighlights';

export type PublicPostSignal = {
  text: string;
  score: number;
  reasons: string[];
};

export type PublicPostContext = {
  positioningSummary: string;
  recentHighlights: string[];
  primaryRecentHighlight: string | null;
  primaryPublicTopic: string;
  feedbackAsk: string;
  recentProgressWarning: string | null;
};

const LOW_VALUE_PATTERNS = [
  /\bprepared next step\b/i,
  /\bnext up\b/i,
  /\blast session summary updated\b/i,
  /\bproject updated\b/i,
  /\bmetadata changed\b/i,
  /\bnotes updated\b/i,
  /\bnotes synced\b/i,
  /\bitems? added by ai\b/i,
  /\bdecisions? added by ai\b/i,
  /\bexport checkpoint\b/i,
  /\bsync event\b/i,
  /\bsession state saved\b/i,
  /\bpost on indie hackers\b/i,
];

const HIGH_VALUE_PATTERNS: Array<[RegExp, number, string]> = [
  [/\b(add|added|ship|shipped|built|launched)\b/i, 10, 'new work shipped'],
  [/\b(feature|capability|generation|composer|bridge|scoring|compare)\b/i, 8, 'new capability'],
  [/\b(improve|improved|fix|fixed|polish|polished|refine|refined)\b/i, 8, 'visible improvement'],
  [/\b(ux|demo|onboarding|mobile)\b/i, 8, 'user experience'],
  [/\b(auth|oauth|sign-in|session|privacy|trust|security)\b/i, 10, 'trust or authentication'],
  [/\b(launch studio|content readiness|daily content pack|social bridge|context passport)\b/i, 12, 'Memephant launch capability'],
  [/\b(outcome|helps?|so users can|without|directly|opened|continue)\b/i, 6, 'user outcome'],
  [/\b(beta|demo|launch|milestone|feedback)\b/i, 6, 'launch momentum'],
];

function normalizePostKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isLowValuePublicPostSignal(value: string): boolean {
  const text = cleanPublicText(value);
  if (!text) return true;
  return LOW_VALUE_PATTERNS.some((pattern) => pattern.test(text));
}

export function humanizePublicPostSignal(value: string): string {
  const text = cleanPublicText(value).replace(/[.!?]+$/g, '').trim();
  if (!text) return '';

  if (/\bsocial bridge\b/i.test(text)) {
    return 'Added Social Bridge so generated content can be opened directly in X, LinkedIn, Reddit, and Facebook.';
  }

  if (/\boauth\b/i.test(text) && /\bsession|sign-in|signin|login|persistence|reliability\b/i.test(text)) {
    return 'Improved OAuth session persistence and sign-in reliability.';
  }

  if (/\bcontent readiness\b/i.test(text) && /\bscor/i.test(text)) {
    return 'Added Content Readiness scoring so launch content starts from clearer project context.';
  }

  if (/\bdaily content pack\b/i.test(text)) {
    return 'Added Daily Content Pack generation for copy-ready social ideas.';
  }

  if (/\bcontext passport\b/i.test(text) && /\bexport|flow|handoff|continuity\b/i.test(text)) {
    return 'Improved Context Passport export flow for clearer cross-AI continuity.';
  }

  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

export function scorePublicPostSignal(value: string): PublicPostSignal {
  const text = humanizePublicPostSignal(value);
  if (!text || isLowValuePublicPostSignal(text)) {
    return { text, score: 0, reasons: ['low-value planning or bookkeeping'] };
  }

  const publicSignal = assessPublicSignal(text);
  const reasons = [...publicSignal.reasons];
  let score = publicSignal.score;

  HIGH_VALUE_PATTERNS.forEach(([pattern, weight, reason]) => {
    if (pattern.test(text)) {
      score += weight;
      reasons.push(reason);
    }
  });

  if (text.split(/\s+/).length >= 8) {
    score += 4;
    reasons.push('specific enough to post');
  }

  return {
    text,
    score,
    reasons: uniqueStable(reasons),
  };
}

export function getPublicPostContext(project: ProjectMemory, limit = 5): PublicPostContext {
  const positioningSummary = cleanPublicText(project.summary, `${project.name} is making public progress.`);
  const positioningKey = normalizePostKey(positioningSummary);
  const shippingHighlights = getShippingHighlights(project, limit * 2);
  const candidates = [
    ...shippingHighlights.map((text) => ({ text, sourceBonus: 30, vetted: true })),
    ...cleanPublicList(project.inProgress).map((text) => ({ text, sourceBonus: 10, vetted: false })),
    { text: cleanPublicText(project.currentState), sourceBonus: 0, vetted: false },
  ].filter((candidate) => Boolean(candidate.text));

  const seen = new Set<string>();
  const scored = candidates
    .filter((candidate) => {
      const key = normalizePostKey(candidate.text);
      if (!key || key === positioningKey || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((candidate) => {
      const signal = scorePublicPostSignal(candidate.text);
      const lowValue = signal.reasons.includes('low-value planning or bookkeeping');
      return {
        ...signal,
        score: signal.score > 0
          ? signal.score + candidate.sourceBonus
          : candidate.vetted && !lowValue
            ? candidate.sourceBonus
            : 0,
      };
    })
    .filter((signal) => signal.score > 0)
    .sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));

  const recentHighlights = uniqueStable(scored.map((signal) => signal.text)).slice(0, limit);
  const feedbackAsk = cleanPublicList(project.openQuestions)[0] ??
    'where the value is clearest and what still feels confusing';
  const primaryRecentHighlight = recentHighlights[0] ?? null;

  return {
    positioningSummary,
    recentHighlights,
    primaryRecentHighlight,
    primaryPublicTopic: primaryRecentHighlight ?? positioningSummary,
    feedbackAsk,
    recentProgressWarning: recentHighlights.length === 0
      ? 'Recent progress may be limited because no meaningful shipped updates were found.'
      : null,
  };
}
