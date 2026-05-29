import type { ChangelogEntry, ProjectMemory } from '../types/memphant-types';
import {
  cleanPublicList,
  cleanPublicText,
  isNoisyChangelogSummary,
  uniqueStable,
} from './contextQuality';
import { assessPublicSignal, isMaintenanceOnlySignal } from './publicSignal';

export type ShippingHighlight = {
  text: string;
  source: 'changelog' | 'inProgress' | 'currentState';
  score: number;
};

const LOW_SIGNAL_PATTERNS = [
  /\b\d+\s+(decisions?|items?|goals?|rules?|questions?|assets?)\s+(added|updated|removed)\s+by\s+ai\b/i,
  /\b\d+\s+(decisions?|items?|goals?|rules?|questions?|assets?)\s+(added|updated|removed)\b/i,
  /\b(decisions?|items?|goals?|rules?|questions?|assets?)\s+(added|updated|removed)\s+by\s+ai\b/i,
  /\badded\s+\d+\s+(decisions?|items?|goals?|rules?|questions?|assets?)\b/i,
  /\bcopied project context\b/i,
  /\bcopied .*context for\b/i,
  /\bcopied .*export\b/i,
  /\bexport checkpoint\b/i,
  /\bcheckpoint (saved|created)\b/i,
  /\bsnapshot downloaded\b/i,
  /\bsettings saved\b/i,
  /\bproject created\b/i,
  /\bupdated project memory\b/i,
  /\bmemphant_update\b/i,
  /\bprepared next step\b/i,
  /\bnext up\b/i,
  /\blast session summary updated\b/i,
  /\bproject updated\b/i,
  /\bmetadata changed\b/i,
  /\bnotes synced\b/i,
  /\bsession state saved\b/i,
  /\bdecisions? updated\b/i,
];

const PRIORITY_TERMS = [
  'launch',
  'studio',
  'passport',
  'content',
  'readiness',
  'clarity',
  'kit',
  'daily',
  'demo',
  'onboarding',
  'workflow',
  'export',
  'auth',
  'oauth',
  'session',
  'privacy',
  'trust',
  'local-first',
  'copy',
  'ux',
  'timeline',
  'feedback',
];

const ACTION_TERMS = [
  'add',
  'added',
  'improve',
  'improved',
  'fix',
  'fixed',
  'ship',
  'shipped',
  'build',
  'built',
  'refine',
  'refined',
  'polish',
  'polished',
  'separate',
  'separated',
];

function normalizeForComparison(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentenceCase(value: string): string {
  const text = value.trim();
  if (!text) return '';
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function stripTrailingPunctuation(value: string): string {
  return value.replace(/[.!?]+$/g, '').trim();
}

function hasTerm(text: string, terms: string[]): boolean {
  const normalized = normalizeForComparison(text);
  return terms.some((term) => normalized.includes(term));
}

export function isLowSignalShippingEntry(summary: string): boolean {
  const text = cleanPublicText(summary);
  if (!text) return true;
  if (isNoisyChangelogSummary(text)) return true;
  if (isMaintenanceOnlySignal(text)) return true;
  return LOW_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));
}

export function summarizeShippingChange(summary: string): string {
  let text = stripTrailingPunctuation(cleanPublicText(summary));
  if (!text) return '';

  text = text
    .replace(/\s+by\s+AI\b/gi, '')
    .replace(/\bImplemented\b/i, 'Added')
    .replace(/\bBuilt\b/i, 'Added')
    .replace(/\bCreated\b/i, 'Added')
    .replace(/\bRefined\b/i, 'Improved')
    .replace(/\bPolished\b/i, 'Improved')
    .replace(/\bFixed\b/i, 'Improved')
    .replace(/\bSeparated\b/i, 'Improved')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^(launch|studio|passport|kit|content|readiness|clarity|daily|demo|onboarding|workflow|export|auth|oauth|privacy|trust|ux)\b/i.test(text)) {
    text = `Improved ${text}`;
  }

  return sentenceCase(text);
}

function scoreHighlight(text: string, source: ShippingHighlight['source']): number {
  const normalized = normalizeForComparison(text);
  const publicSignal = assessPublicSignal(text);
  const priorityScore = PRIORITY_TERMS.reduce(
    (score, term) => score + (normalized.includes(term) ? 3 : 0),
    0,
  );
  const actionScore = ACTION_TERMS.reduce(
    (score, term) => score + (normalized.includes(term) ? 2 : 0),
    0,
  );
  const sourceScore = source === 'changelog' ? 4 : source === 'inProgress' ? 2 : 1;
  const specificityScore = text.split(/\s+/).length >= 4 ? 2 : 0;

  return publicSignal.score + priorityScore + actionScore + sourceScore + specificityScore;
}

function makeHighlight(text: string, source: ShippingHighlight['source']): ShippingHighlight | null {
  if (isLowSignalShippingEntry(text)) return null;
  const summary = summarizeShippingChange(text);
  if (!summary || isLowSignalShippingEntry(summary)) return null;
  const publicSignal = assessPublicSignal(summary);
  if (!hasTerm(summary, [...PRIORITY_TERMS, ...ACTION_TERMS]) && publicSignal.level !== 'high') return null;
  if (publicSignal.level === 'low') return null;

  return {
    text: summary,
    source,
    score: scoreHighlight(summary, source),
  };
}

function dedupeHighlights<T extends ShippingHighlight>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  items.forEach((item) => {
    const key = normalizeForComparison(item.text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });

  return result;
}

export function getShippingHighlights(
  project: ProjectMemory,
  limit = 5,
): string[] {
  const changelogHighlights = (project.changelog ?? [])
    .map((entry: ChangelogEntry, index) => {
      const highlight = makeHighlight(entry.summary, 'changelog');
      return highlight ? { ...highlight, index } : null;
    })
    .filter((item): item is ShippingHighlight & { index: number } => Boolean(item));

  const inProgressHighlights = cleanPublicList(project.inProgress)
    .map((item, index) => {
      const highlight = makeHighlight(item, 'inProgress');
      return highlight ? { ...highlight, index: index - 1000 } : null;
    })
    .filter((item): item is ShippingHighlight & { index: number } => Boolean(item));

  const currentStateHighlight = makeHighlight(project.currentState, 'currentState');
  const currentStateHighlights = currentStateHighlight
    ? [{ ...currentStateHighlight, index: -2000 }]
    : [];

  const sourceHighlights = changelogHighlights.length > 0
    ? changelogHighlights
    : inProgressHighlights.length > 0
      ? inProgressHighlights
      : currentStateHighlights;

  const sorted = dedupeHighlights(sourceHighlights)
    .sort((a, b) => b.score - a.score || b.index - a.index);

  return uniqueStable(sorted.map((item) => item.text)).slice(0, limit);
}
