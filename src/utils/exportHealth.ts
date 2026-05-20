export type ExportHealthRiskLevel = 'safe' | 'warning' | 'high';
export type ExportHealthSuggestedAction = 'none' | 'inspect' | 'compress';

export interface ExportHealthResult {
  characterCount: number;
  approximateTokens: number;
  riskLevel: ExportHealthRiskLevel;
  warnings: string[];
  suggestedAction: ExportHealthSuggestedAction;
}

const WARNING_CHAR_THRESHOLD = 45000;
const HIGH_CHAR_THRESHOLD = 75000;
const EXCESSIVE_BLANK_LINE_PATTERN = /\n{5,}/;
const WINDOWS_PATH_PATTERN = /(?:[A-Za-z]:\\|\\\\)[^\n\r<>:"|?*]+/;
const UNIX_PATH_PATTERN = /(?:^|[\s(["'`])\/(?:Users|home|var|tmp|private|Volumes|mnt)\/[^\s"'`)]+/m;
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/,
  /sk-ant-[A-Za-z0-9_-]{20,}/,
  /sk_live_[A-Za-z0-9]{24,}/,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9]{36}/,
  /github_pat_[A-Za-z0-9_]{40,}/,
  /xox[baprs]-[A-Za-z0-9-]{20,}/,
  /(?:password|secret|token|api[_-]?key)\s*[=:]\s*["']?[A-Za-z0-9_./+=-]{16,}/i,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
];

function countOccurrences(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function hasRepeatedHeading(text: string): boolean {
  const headings = new Map<string, number>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^(#{1,3}\s+.+|[A-Z][A-Z0-9_ ]{3,}:)\s*$/.exec(line.trim());
    if (!match) continue;

    const key = match[1].toLowerCase();
    const nextCount = (headings.get(key) ?? 0) + 1;
    if (nextCount > 1) return true;
    headings.set(key, nextCount);
  }

  return false;
}

function isUnusualControlCharacter(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127;
}

function hasUnusualControlCharacters(text: string): boolean {
  return Array.from(text).some(isUnusualControlCharacter);
}

function removeUnusualControlCharacters(text: string): string {
  return Array.from(text).filter((char) => !isUnusualControlCharacter(char)).join('');
}

function getRiskLevel(warnings: string[], characterCount: number): ExportHealthRiskLevel {
  if (
    characterCount > HIGH_CHAR_THRESHOLD
    || warnings.some((warning) =>
      warning.includes('secret-looking')
      || warning.includes('local file path')
      || warning.includes('AI Working Style blocks')
      || warning.includes('memphant_update instructions'),
    )
  ) {
    return 'high';
  }

  if (warnings.length > 0) return 'warning';
  return 'safe';
}

export function analyzeExportHealth(exportText: string): ExportHealthResult {
  const warnings: string[] = [];
  const characterCount = exportText.length;
  const approximateTokens = Math.ceil(characterCount / 4);

  if (characterCount > HIGH_CHAR_THRESHOLD) {
    warnings.push(`Export is very large (${characterCount.toLocaleString()} characters).`);
  } else if (characterCount > WARNING_CHAR_THRESHOLD) {
    warnings.push(`Export is large (${characterCount.toLocaleString()} characters).`);
  }

  if (hasRepeatedHeading(exportText)) {
    warnings.push('Export contains repeated section headings.');
  }

  if (countOccurrences(exportText, /^memphant_update\s*$/gm) > 1) {
    warnings.push('Export contains repeated memphant_update instructions.');
  }

  if (countOccurrences(exportText, /^# AI Working Style\s*$/gm) > 1) {
    warnings.push('Export contains repeated AI Working Style blocks.');
  }

  if (WINDOWS_PATH_PATTERN.test(exportText) || UNIX_PATH_PATTERN.test(exportText)) {
    warnings.push('Export may contain a local file path.');
  }

  if (SECRET_PATTERNS.some((pattern) => pattern.test(exportText))) {
    warnings.push('Export may contain a secret-looking string.');
  }

  if (hasUnusualControlCharacters(exportText)) {
    warnings.push('Export contains unusual control characters.');
  }

  if (EXCESSIVE_BLANK_LINE_PATTERN.test(exportText)) {
    warnings.push('Export contains excessive blank lines.');
  }

  const riskLevel = getRiskLevel(warnings, characterCount);
  const suggestedAction =
    riskLevel === 'safe'
      ? 'none'
      : characterCount > WARNING_CHAR_THRESHOLD
        ? 'compress'
        : 'inspect';

  return {
    characterCount,
    approximateTokens,
    riskLevel,
    warnings,
    suggestedAction,
  };
}

export function compressExportForPaste(exportText: string): string {
  return removeUnusualControlCharacters(exportText)
    .replace(/[ \t]+\r?\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
