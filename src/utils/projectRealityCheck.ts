import type { ProjectMemory } from '../types/memphant-types';
import {
  cleanPublicText,
  filterPublicChangelog,
  filterPublicDecisions,
  isNoisyChangelogSummary,
  isPlaceholderText,
  uniqueStable,
} from './contextQuality';

export type ProjectRealityCheck = {
  bestSummary: string;
  bestCurrentState: string;
  activeTask: string;
  maturity: 'Active implementation' | 'Early implementation' | 'Not confidently detected';
  detectedSignals: string[];
  activeAreas: string[];
  recentProgress: string[];
  keyDecisions: string[];
  nextSteps: string[];
  importantAreas: string[];
  staleFields: string[];
};

type FileArea = {
  label: string;
  pattern: RegExp;
};

const FILE_AREAS: FileArea[] = [
  { label: 'Billing', pattern: /(?:^|\/)(?:stripe|billing|checkout|subscription|pricing)(?:[\/.\-_]|$)/i },
  { label: 'Auth and data', pattern: /(?:^|\/)(?:supabase|auth|oauth|login|database|prisma)(?:[\/.\-_]|$)/i },
  { label: 'Outreach', pattern: /(?:^|\/)(?:outreach|campaign|resend|email)(?:[\/.\-_]|$)/i },
  { label: 'Lead Finder', pattern: /(?:^|\/)(?:lead|prospect|scraper)(?:[\/.\-_]|$)/i },
  { label: 'Landing Builder', pattern: /(?:^|\/)(?:landing|template|builder|editor)(?:[\/.\-_]|$)/i },
  { label: 'Sales workspace', pattern: /(?:^|\/)(?:sales|crm|pipeline)(?:[\/.\-_]|$)/i },
  { label: 'Website audit', pattern: /(?:^|\/)(?:website[-_]?audit|audit|lighthouse|seo)(?:[\/.\-_]|$)/i },
  { label: 'AI visibility', pattern: /(?:^|\/)(?:ai[-_]?visibility|llm[-_]?visibility|visibility)(?:[\/.\-_]|$)/i },
  { label: 'Tests', pattern: /(?:^|\/)(?:__tests__|tests?|specs?|jest|playwright|cypress)(?:[\/.\-_]|$)/i },
  { label: 'Deployment', pattern: /(?:^|\/)(?:\.github\/workflows|vercel|deploy|docker|ci)(?:[\/.\-_]|$)/i },
  { label: 'Privacy and compliance', pattern: /(?:^|\/)(?:pecr|gdpr|consent|privacy)(?:[\/.\-_]|$)/i },
  { label: 'API routes', pattern: /(?:^|\/)(?:api|routes?)(?:[\/.\-_]|$)/i },
  { label: 'Game systems', pattern: /(?:^|\/)(?:scripts?|game|roblox|unity|unreal|godot)(?:[\/.\-_]|$)/i },
];

const STALE_FIELD_PATTERNS = [
  /summary not yet written/i,
  /\bis a project\b/i,
  /add a brief description/i,
  /what it does and who it'?s for/i,
  /\(no summary yet\)/i,
  /just getting started/i,
  /defining scope and goals/i,
  /help me continue from the current (?:project )?state/i,
  /^define the scope and core features[.!]?$/i,
  /^build the first working version[.!]?$/i,
  /^test with real users[.!]?$/i,
  /^ship and iterate[.!]?$/i,
  /project just created/i,
  /starter template/i,
];

const SENSITIVE_FILE_PATTERN = /(?:^|\/)(?:\.env(?:\.|$)|secrets?|credentials?|id_rsa|private[-_]?key)(?:[\/.\-_]|$)/i;

function isStaleField(value: string | undefined | null): boolean {
  const text = value?.trim() ?? '';
  return !text || isPlaceholderText(text) || STALE_FIELD_PATTERNS.some((pattern) => pattern.test(text));
}

function normalizeAsset(project: ProjectMemory, value: string): string | null {
  let path = value.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (!path || SENSITIVE_FILE_PATTERN.test(path)) return null;

  const linkedRoot = project.linkedFolder?.path?.trim().replace(/\\/g, '/').replace(/\/$/, '');
  if (linkedRoot && path.toLowerCase().startsWith(`${linkedRoot.toLowerCase()}/`)) {
    path = path.slice(linkedRoot.length + 1);
  }

  if (/^[A-Za-z]:\//.test(path) || /^\/(?:Users|home|private|var|tmp)\//i.test(path)) {
    path = path.split('/').filter(Boolean).pop() ?? '';
  }

  const clean = cleanPublicText(path);
  return clean && !SENSITIVE_FILE_PATTERN.test(clean) ? clean : null;
}

function collectAssets(project: ProjectMemory): string[] {
  return uniqueStable([
    ...(project.importantAssets ?? []),
    ...(project.scanInfo?.keyFilesFound ?? []),
  ].map((asset) => normalizeAsset(project, asset)).filter((asset): asset is string => Boolean(asset)));
}

function groupImportantAreas(assets: string[]): { activeAreas: string[]; importantAreas: string[] } {
  const groups = FILE_AREAS.map((area) => ({ ...area, files: [] as string[] }));

  for (const asset of assets) {
    const infrastructureGroup = groups.find(
      (candidate) => (candidate.label === 'Tests' || candidate.label === 'Deployment')
        && candidate.pattern.test(asset),
    );
    const group = infrastructureGroup ?? groups.find((candidate) => candidate.pattern.test(asset));
    if (group && group.files.length < 2) group.files.push(asset);
  }

  const populated = groups.filter((group) => group.files.length > 0).slice(0, 12);
  const importantAreas = populated.map((group) => `${group.label}: ${group.files.join(', ')}`);

  if (importantAreas.length < 6) {
    const groupedFiles = new Set(populated.flatMap((group) => group.files));
    const otherFiles = assets.filter((asset) => !groupedFiles.has(asset)).slice(0, 4);
    if (otherFiles.length > 0) importantAreas.push(`Other important files: ${otherFiles.join(', ')}`);
  }

  return {
    activeAreas: populated.map((group) => group.label),
    importantAreas,
  };
}

function splitProgressNote(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((item) => cleanPublicText(item))
    .filter(Boolean);
}

function meaningfulStrings(items: string[] | undefined): string[] {
  return uniqueStable(
    (items ?? [])
      .map((item) => cleanPublicText(item))
      .filter((item) => item && !isStaleField(item)),
  );
}

function filterProgressItems(items: string[]): string[] {
  return uniqueStable(items.filter((item) => !isNoisyChangelogSummary(item)));
}

function projectKind(project: ProjectMemory): string {
  if (project.projectCategory === 'saas') return 'SaaS project';
  if (project.projectCategory === 'game' || project.workspaceType === 'game') return 'game project';
  if (
    project.workspaceType === 'software'
    || project.linkedFolder
    || project.githubRepo
    || project.scanInfo
    || (project.detectedStack?.length ?? 0) > 0
  ) return 'software project';
  return 'project';
}

function buildEvidenceSummary(
  project: ProjectMemory,
  maturity: ProjectRealityCheck['maturity'],
  stack: string[],
  activeAreas: string[],
): string {
  if (maturity === 'Not confidently detected') {
    return `${project.name.trim()} — summary not yet written, and no reliable implementation evidence is stored.`;
  }

  const evidence = [
    stack.length > 0 ? stack.slice(0, 4).join(', ') : '',
    activeAreas.length > 0 ? activeAreas.slice(0, 4).join(', ') : '',
  ].filter(Boolean).join(' with ');

  return `${project.name.trim()} appears to be an active ${projectKind(project)}${evidence ? ` using ${evidence}` : ''}. The saved summary is missing or stale; confirm this evidence-based description before relying on it.`;
}

function buildEvidenceState(
  maturity: ProjectRealityCheck['maturity'],
  activeAreas: string[],
  recentProgress: string[],
): string {
  if (maturity === 'Not confidently detected') {
    return 'The project does not yet have a reliable saved current state. Ask the user to update project status before assuming missing details.';
  }

  const evidence = activeAreas.length > 0
    ? `Stored file signals show work across ${activeAreas.slice(0, 5).join(', ')}.`
    : recentProgress.length > 0
      ? 'Stored recent progress indicates active implementation.'
      : 'Stored repository metadata indicates implementation work exists.';

  return `${evidence} The saved Current State appears stale; update it before making broad changes.`;
}

export function buildProjectRealityCheck(
  project: ProjectMemory,
  requestedTask?: string,
): ProjectRealityCheck {
  const assets = collectAssets(project);
  const stack = uniqueStable((project.detectedStack ?? []).map((item) => cleanPublicText(item)).filter(Boolean)).slice(0, 8);
  const { activeAreas, importantAreas } = groupImportantAreas(assets);
  const recentProgress = filterProgressItems([
    ...splitProgressNote(project.recentProgressNote),
    ...(project.pendingGitCommits ?? []).map((commit) => cleanPublicText(commit.message)).filter(Boolean),
    ...filterPublicChangelog(project.changelog, 6),
  ]).slice(0, 5);
  const keyDecisions = filterPublicDecisions(project.decisions, 4);
  const nextSteps = meaningfulStrings(project.nextSteps).slice(0, 5);
  const inProgress = meaningfulStrings(project.inProgress);
  const openQuestion = !isStaleField(project.openQuestion) ? cleanPublicText(project.openQuestion) : '';

  const evidenceScore = Math.min(assets.length, 8)
    + Math.min(stack.length, 4)
    + Math.min(activeAreas.length * 2, 8)
    + Math.min(recentProgress.length * 2, 6)
    + (project.githubRepo || project.scanInfo ? 2 : 0)
    + (project.linkedFolder?.scanHash || project.linkedFolder?.lastScannedAt ? 2 : 0);
  const maturity: ProjectRealityCheck['maturity'] = evidenceScore >= 8
    ? 'Active implementation'
    : evidenceScore >= 3
      ? 'Early implementation'
      : 'Not confidently detected';

  const staleFields: string[] = [];
  if (isStaleField(project.summary)) staleFields.push('Project Summary is missing or appears stale.');
  if (isStaleField(project.currentState)) staleFields.push('Current State is missing or appears stale.');

  const explicitTask = !isStaleField(requestedTask) ? cleanPublicText(requestedTask) : '';
  const activeTask = explicitTask
    || inProgress[0]
    || openQuestion
    || 'Active task is not clearly recorded. Ask the user what they want to work on next before editing files.';

  const stackText = stack.join(' ');
  const hasArea = (label: string) => activeAreas.includes(label);
  const detectedSignals = uniqueStable([
    /next(?:\.js)?|react/i.test(stackText)
      ? 'Next.js/React application files or stack metadata are present.'
      : stack.length > 0
        ? `Detected stack: ${stack.join(', ')}.`
        : '',
    hasArea('Auth and data') || /supabase|auth|prisma|database/i.test(stackText)
      ? 'Supabase/auth or application data files are present.'
      : '',
    hasArea('Billing') || /stripe|billing/i.test(stackText)
      ? 'Stripe/billing files or routes are present.'
      : '',
    hasArea('Outreach') || /resend|email/i.test(stackText)
      ? 'Outreach/email files, routes, or stack metadata are present.'
      : '',
    hasArea('Lead Finder') ? 'Lead Finder files or routes are present.' : '',
    hasArea('Landing Builder') ? 'Landing Builder files or routes are present.' : '',
    hasArea('Sales workspace') ? 'Sales workspace files or routes are present.' : '',
    hasArea('Website audit') ? 'Website audit files or routes are present.' : '',
    hasArea('AI visibility') ? 'AI visibility files or routes are present.' : '',
    hasArea('Privacy and compliance') ? 'PECR/privacy classification files are present.' : '',
    hasArea('Tests') && hasArea('Deployment')
      ? 'Tests and deployment workflows are present.'
      : hasArea('Tests')
        ? 'Tests are present.'
        : hasArea('Deployment')
          ? 'Deployment workflows or configuration are present.'
          : '',
    project.githubRepo || project.scanInfo ? 'Repository scan metadata is available.' : '',
  ].filter(Boolean)).slice(0, 12);

  return {
    bestSummary: isStaleField(project.summary)
      ? buildEvidenceSummary(project, maturity, stack, activeAreas)
      : project.summary.trim(),
    bestCurrentState: isStaleField(project.currentState)
      ? buildEvidenceState(maturity, activeAreas, recentProgress)
      : project.currentState.trim(),
    activeTask,
    maturity,
    detectedSignals,
    activeAreas,
    recentProgress,
    keyDecisions,
    nextSteps,
    importantAreas,
    staleFields,
  };
}
