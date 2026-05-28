import type { ChangelogEntry, Decision } from '../types/memphant-types';
import { isMemphantPlaceholderValue } from './memphantPlaceholders';

const SECRET_PATTERNS = [
  /sk_live_[A-Za-z0-9_]+/g,
  /xox[baprs]-[A-Za-z0-9-]+/g,
  /ghp_[A-Za-z0-9_]+/g,
  /api[_-]?key\s*[=:]\s*\S+/gi,
  /token\s*[=:]\s*\S+/gi,
  /secret\s*[=:]\s*\S+/gi,
  /password\s*[=:]\s*\S+/gi,
];

const PLACEHOLDER_PATTERNS = [
  /write\s+\d+(?:\s*-\s*\d+)?\s+sentences/i,
  /list only things actively being worked on/i,
  /list the immediate next actions/i,
  /what is the top priority/i,
  /what needs to happen next/i,
  /what changed in this session/i,
  /describe what is true right now/i,
  /only include if a genuinely new/i,
  /only include genuinely new decisions/i,
  /why this decision was made/i,
  /single most important unresolved question/i,
  /project just created/i,
  /starter template/i,
  /template setup/i,
  /\bplaceholder\b/i,
  /\blorem ipsum\b/i,
  /\btodo:\b/i,
  /^\(?no .+ yet\)?$/i,
  /^\(?not set\)?$/i,
];

const NOISY_CHANGELOG_PATTERNS = [
  /copied project context/i,
  /copied .*context for/i,
  /copied .*export/i,
  /context passport copied/i,
  /export checkpoint/i,
  /checkpoint saved/i,
  /snapshot downloaded/i,
  /settings saved/i,
  /project created via guided setup/i,
  /demo project created/i,
];

const HIGH_SIGNAL_TERMS = [
  'add',
  'added',
  'build',
  'built',
  'context',
  'demo',
  'export',
  'feedback',
  'improve',
  'improved',
  'implemented',
  'launch',
  'mode',
  'onboarding',
  'passport',
  'polish',
  'refined',
  'release',
  'shipped',
  'user',
  'workflow',
];

function sanitizeSecrets(text: string): string {
  return SECRET_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, '[redacted]'),
    text,
  );
}

function normalizeForComparison(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPlaceholderText(value: string): boolean {
  const text = value.trim();
  if (!text) return true;

  return (
    isMemphantPlaceholderValue(text) ||
    PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text))
  );
}

export function isNoisyChangelogSummary(value: string): boolean {
  const text = value.trim();
  if (!text || isPlaceholderText(text)) return true;

  return NOISY_CHANGELOG_PATTERNS.some((pattern) => pattern.test(text));
}

export function cleanPublicText(value: string | undefined, fallback = ''): string {
  const preferred = typeof value === 'string' && value.trim() ? value : fallback;
  const cleaned = sanitizeSecrets(preferred).replace(/\s+/g, ' ').trim();

  if (!cleaned || isPlaceholderText(cleaned)) {
    const cleanedFallback = sanitizeSecrets(fallback).replace(/\s+/g, ' ').trim();
    return cleanedFallback && !isPlaceholderText(cleanedFallback) ? cleanedFallback : '';
  }

  return cleaned;
}

export function uniqueStable(items: string[]): string[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = normalizeForComparison(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function cleanPublicList(items: string[] | undefined, fallback: string[] = []): string[] {
  const source = items && items.length > 0 ? items : fallback;
  const cleaned = uniqueStable(
    source.map((item) => cleanPublicText(item)).filter(Boolean),
  );

  if (cleaned.length > 0) return cleaned;

  return uniqueStable(fallback.map((item) => cleanPublicText(item)).filter(Boolean));
}

export function publicAssetName(asset: string): string {
  const cleaned = cleanPublicText(asset);
  const parts = cleaned.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] ?? cleaned;
}

function highSignalScore(text: string): number {
  const normalized = normalizeForComparison(text);

  return HIGH_SIGNAL_TERMS.reduce(
    (score, term) => score + (normalized.includes(term) ? 1 : 0),
    0,
  );
}

export function filterPublicChangelog(
  changelog: ChangelogEntry[] | undefined,
  limit = 4,
): string[] {
  const candidates = (changelog ?? [])
    .map((entry, index) => ({
      index,
      text: cleanPublicText(entry.summary),
    }))
    .filter((entry) => entry.text && !isNoisyChangelogSummary(entry.text));

  const unique = uniqueStable(candidates.map((entry) => entry.text))
    .map((text) => {
      const candidate = candidates.find((entry) => entry.text === text);
      return {
        index: candidate?.index ?? 0,
        text,
        score: highSignalScore(text),
      };
    });

  return unique
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, limit)
    .map((entry) => entry.text);
}

export function filterPublicDecisions(decisions: Decision[], limit = 2): string[] {
  return cleanPublicList(decisions.map((decision) => decision.decision)).slice(-limit);
}
