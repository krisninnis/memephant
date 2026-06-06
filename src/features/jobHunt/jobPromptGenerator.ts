import type { JobHuntProfile, JobItem, JobPromptType } from './types';

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9]{20,}/g,
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /ghp_[A-Za-z0-9]{36}/g,
  /github_pat_[A-Za-z0-9_]{82}/g,
  /xoxb-[A-Za-z0-9-]+/g,
  /xoxp-[A-Za-z0-9-]+/g,
  /sk_live_[A-Za-z0-9]{24,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /hf_[A-Za-z0-9]{30,}/g,
  /-----BEGIN [A-Z ]+ KEY-----/g,
  /eyJ[A-Za-z0-9+/=]{20,}/g,
  /(postgres|postgresql|mysql|mongodb|redis|mongodb\+srv):\/\/[^\s"']+/gi,
  /password\s*[=:]\s*\S+/gi,
  /secret\s*[=:]\s*\S+/gi,
  /token\s*[=:]\s*["']?[A-Za-z0-9_-]{20,}["']?/gi,
  /api[_-]?key\s*[=:]\s*["']?[A-Za-z0-9_-]{16,}["']?/gi,
];

const LOCAL_PATH_PATTERNS: RegExp[] = [
  /[A-Za-z]:\\(?:Users|Documents|Downloads|Desktop|Repos|Projects)\\[^\s]+/g,
  /\/(?:Users|home|var|tmp|private|Volumes)\/[^\s]+/g,
  /\\\\[A-Za-z0-9_.-]+\\[^\s]+/g,
];

const PROMPT_INSTRUCTIONS: Record<JobPromptType, string> = {
  tailor_cv: 'Using my job hunt profile and this job advert, suggest how to tailor my CV honestly without inventing experience.',
  cover_message: 'Write a short, natural UK-style cover message for this role.',
  interview_prep: 'Prepare me for a first interview for this role, based on my profile and the job advert.',
  fit_analysis: 'Analyse whether this role is worth applying for. Be honest about gaps and strengths.',
};

function sanitize(text: string | undefined): string {
  if (!text) return '';
  let output = text.replace(/\bmemphant_update\b/gi, '[removed]');
  for (const pattern of SECRET_PATTERNS) output = output.replace(pattern, '[REDACTED]');
  for (const pattern of LOCAL_PATH_PATTERNS) output = output.replace(pattern, '[local-path-redacted]');
  return output;
}

function list(items: string[]): string {
  const safe = items.map((item) => sanitize(item).trim()).filter(Boolean);
  return safe.length ? safe.map((item) => `- ${item}`).join('\n') : '- Not specified';
}

function field(label: string, value: string | undefined): string {
  return `${label}: ${sanitize(value).trim() || 'Not specified'}`;
}

export function generateJobPrompt(
  type: JobPromptType,
  profile: JobHuntProfile,
  job: JobItem,
): string {
  const lines = [
    '# Job Hunt Passport Prompt',
    '',
    PROMPT_INSTRUCTIONS[type],
    '',
    'Important boundaries:',
    '- Do not invent experience, employers, qualifications, metrics, or projects.',
    '- Be honest about gaps, strengths, and whether this role is worth pursuing.',
    '- Keep the advice practical and suitable for a UK job application unless the advert says otherwise.',
    '- Safe export note: exclude secrets, API keys, .env values, and local folder paths.',
    '',
    '## Job Hunt Profile',
    '',
    'Target roles:',
    list(profile.targetRoles),
    '',
    'Target locations:',
    list(profile.targetLocations),
    '',
    field('Preferred remote type', profile.preferredRemoteType),
    '',
    field('Experience level', profile.experienceLevel),
    '',
    field('CV summary', profile.cvSummary),
    '',
    'Key skills:',
    list(profile.keySkills),
    '',
    'Projects:',
    list(profile.projects),
    '',
    field('Constraints', profile.constraints),
    '',
    '## Selected Job',
    '',
    field('Title', job.title || 'Untitled role'),
    field('Company', job.company),
    field('Location', job.location),
    field('Remote type', job.remoteType),
    field('Salary', job.salary),
    field('URL', job.url),
    field('Source', job.source),
    field('Fit score', job.fitScore),
    field('Status', job.status),
    field('Notes', job.notes),
    '',
    '## Source Job Text',
    '',
    sanitize(job.pastedText || 'No pasted source text stored.'),
  ];

  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

export function getJobPromptLabel(type: JobPromptType): string {
  switch (type) {
    case 'tailor_cv':
      return 'Tailor CV';
    case 'cover_message':
      return 'Cover message';
    case 'interview_prep':
      return 'Interview prep';
    case 'fit_analysis':
      return 'Job fit analysis';
    default:
      return 'Job prompt';
  }
}
