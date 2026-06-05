import type { JobFitScore, JobItem, JobRemoteType } from './types';

const URL_PATTERN = /https?:\/\/[^\s)>\]]+/i;
const SALARY_PATTERN = /(?:£|\$|€)\s?\d[\d,]*(?:\s?[-–]\s?(?:£|\$|€)?\s?\d[\d,]*)?(?:\s?(?:k|K))?(?:\s?(?:per year|pa|p\/a|annum|hour|day))?/i;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeEntryLine(line: string): string {
  return line
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitJobEntries(input: string): string[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const entries: string[] = [];
  let current: string[] = [];

  const startsEntry = (line: string) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line);

  for (const line of lines) {
    if (startsEntry(line) && current.length > 0) {
      entries.push(current.join(' '));
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) entries.push(current.join(' '));
  if (entries.length > 0) return entries;
  return input.trim() ? [input.trim()] : [];
}

function detectRemoteType(text: string): JobRemoteType {
  if (/\bhybrid\b/i.test(text)) return 'hybrid';
  if (/\b(remote|work from home|wfh)\b/i.test(text)) return 'remote';
  if (/\b(on[-\s]?site|office based|office-based|in office)\b/i.test(text)) return 'onsite';
  return 'unknown';
}

function detectFitScore(text: string): JobFitScore {
  if (/\b(high fit|strong fit|great fit)\b/i.test(text)) return 'high';
  if (/\b(medium fit|possible fit|okay fit)\b/i.test(text)) return 'medium';
  if (/\b(low fit|poor fit|weak fit)\b/i.test(text)) return 'low';
  return 'unknown';
}

function stripMetadata(text: string): string {
  return text
    .replace(URL_PATTERN, '')
    .replace(SALARY_PATTERN, '')
    .replace(/\b(remote|hybrid|onsite|on-site|work from home|wfh)\b/gi, '')
    .replace(/\b(high|medium|low|unknown)\s+fit\b/gi, '')
    .replace(/\s*[,;|]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanNamePart(value: string): string {
  const firstSegment = value.split(/\s+[-–|]\s+/)[0] ?? value;
  return firstSegment
    .replace(/^[|,;:\-\s]+|[|,;:\-\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLocation(text: string): string | undefined {
  const match =
    text.match(/\b(?:location|based in)\s*[:\-]\s*([^.;|]+)/i) ||
    text.match(/\b(?:remote|hybrid|onsite|on-site)\s*(?:in|,)?\s*([A-Z][A-Za-z\s,]+)?/);
  const location = match?.[1]?.trim().replace(/\s+/g, ' ');
  return location || undefined;
}

function extractTitleAndCompany(text: string): { title: string; company?: string } {
  const clean = stripMetadata(text);
  const firstSentence = clean.split(/(?:\.|\s+-\s+Salary|\s+Salary:)/i)[0]?.trim() || clean;
  const separators = [
    /\s+at\s+/i,
    /\s+@\s+/,
    /\s+-\s+/,
    /\s+–\s+/,
    /\s+\|\s+/,
  ];

  for (const separator of separators) {
    const parts = firstSentence.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return {
        title: cleanNamePart(parts[0]) || 'Untitled role',
        company: cleanNamePart(parts[1]?.replace(/^(company|employer)\s*:\s*/i, '') ?? '') || undefined,
      };
    }
  }

  const titleMatch = firstSentence.match(/(?:title|role|job)\s*:\s*([^.;|]+)/i);
  const companyMatch = firstSentence.match(/company\s*:\s*([^.;|]+)/i);
  return {
    title: titleMatch?.[1]?.trim() || firstSentence || 'Untitled role',
    company: companyMatch?.[1]?.trim(),
  };
}

export function parseJobsFromText(input: string): JobItem[] {
  try {
    const createdAt = nowIso();
    return splitJobEntries(input).map((entry, index) => {
      const cleanedEntry = normalizeEntryLine(entry);
      const { title, company } = extractTitleAndCompany(cleanedEntry);
      const url = cleanedEntry.match(URL_PATTERN)?.[0];
      const salary = cleanedEntry.match(SALARY_PATTERN)?.[0]?.trim();

      return {
        id: `job-${Date.now().toString(36)}-${index}`,
        title: title || 'Untitled role',
        company,
        location: extractLocation(cleanedEntry),
        remoteType: detectRemoteType(cleanedEntry),
        salary,
        url,
        source: 'Pasted job list',
        fitScore: detectFitScore(cleanedEntry),
        status: 'not_applied',
        notes: '',
        pastedText: cleanedEntry,
        createdAt,
        updatedAt: createdAt,
      };
    });
  } catch {
    const createdAt = nowIso();
    return input.trim()
      ? [{
          id: `job-${Date.now().toString(36)}-fallback`,
          title: 'Untitled role',
          remoteType: 'unknown',
          fitScore: 'unknown',
          status: 'not_applied',
          pastedText: input,
          createdAt,
          updatedAt: createdAt,
        }]
      : [];
  }
}
