/**
 * Platform-specific export formatters.
 * Each formatter takes a ProjectMemory + optional task + mode and returns a string.
 * CRITICAL: linkedFolder.path is NEVER included in any output.
 */
import type {
  AIPlatformConfig,
  ProjectMemory,
  Platform,
  ExportMode,
  GitCommit,
  Decision,
} from '../types/memphant-types';
import { getPlatformConfig } from './platformRegistry';
import { isMemphantPlaceholderValue } from './memphantPlaceholders';
import { getWorkflowModeExportBlock } from './workflowModes';
import { formatGameContextMarkdown } from './gameContextFormatter';

const STANDARD_PATTERNS = [
  // OpenAI
  /sk-[A-Za-z0-9]{20,}/g,
  // Anthropic (sk-ant-api03-... or any sk-ant- variant)
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  // AWS access key IDs
  /AKIA[0-9A-Z]{16}/g,
  // GitHub personal access tokens (classic + fine-grained)
  /ghp_[A-Za-z0-9]{36}/g,
  /github_pat_[A-Za-z0-9_]{82}/g,
  // Slack bot tokens
  /xoxb-[A-Za-z0-9-]+/g,
  // Slack user tokens
  /xoxp-[A-Za-z0-9-]+/g,
  // Stripe live secret keys (test keys are generally safe, live keys must be redacted)
  /sk_live_[A-Za-z0-9]{24,}/g,
  // Google API keys
  /AIza[0-9A-Za-z_-]{35}/g,
  // HuggingFace tokens
  /hf_[A-Za-z0-9]{30,}/g,
  // PEM private key headers
  /-----BEGIN [A-Z ]+ KEY-----/g,
  // JWT tokens (base64url header prefix)
  /eyJ[A-Za-z0-9+/=]{20,}/g,
];

const STRICT_EXTRA_PATTERNS = [
  // Database connection strings (any protocol)
  /(postgres|postgresql|mysql|mongodb|redis|mongodb\+srv):\/\/[^\s"']+/gi,
  // SendGrid API keys
  /SG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{40,}/g,
  // Databricks / Spark tokens
  /dapi[a-f0-9]{32}/g,
  // Azure storage / connection strings
  /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{44,}/gi,
  // password= / secret= / token= / api_key= patterns
  /password\s*[=:]\s*\S+/gi,
  /secret\s*[=:]\s*\S+/gi,
  /token\s*[=:]\s*["']?[A-Za-z0-9_-]{20,}["']?/gi,
  /api[_-]?key\s*[=:]\s*["']?[A-Za-z0-9_-]{16,}["']?/gi,
];

let scannerLevel: 'standard' | 'strict' = 'standard';

export function setScannerLevel(level: 'standard' | 'strict'): void {
  scannerLevel = level;
}

function sanitize(text: string): string {
  let out = text;

  for (const pattern of STANDARD_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }

  if (scannerLevel === 'strict') {
    for (const pattern of STRICT_EXTRA_PATTERNS) {
      out = out.replace(pattern, '[REDACTED]');
    }
  }

  return out;
}

function sanitizeList(items: string[]): string[] {
  return items.map(sanitize);
}

function bulletList(items: string[], indent = '  '): string {
  if (!items.length) return `${indent}(none)`;
  return items.map((i) => `${indent}- ${sanitize(i)}`).join('\n');
}

function numberedList(items: string[], indent = ''): string {
  if (!items.length) return `${indent}(none)`;
  return items.map((i, idx) => `${indent}${idx + 1}. ${sanitize(i)}`).join('\n');
}

/** Returns true only if the string is non-null, non-undefined, and non-whitespace. */
function hasContent(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Returns true only if the array is non-empty (after filtering blank entries). */
function hasItems(arr: string[] | undefined | null): arr is string[] {
  return Array.isArray(arr) && arr.some((s) => typeof s === 'string' && s.trim().length > 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redactProjectLinkedFolderPath(project: ProjectMemory, text: string): string {
  const path = project.linkedFolder?.path;
  if (!path) return text;

  const variants = new Set([
    path,
    path.replace(/\\/g, '/'),
    path.replace(/\//g, '\\'),
  ]);

  return Array.from(variants).reduce(
    (out, variant) =>
      variant ? out.replace(new RegExp(escapeRegExp(variant), 'g'), '[REDACTED]') : out,
    text,
  );
}

function sanitizeProjectCharter(project: ProjectMemory): string | null {
  if (!hasContent(project.projectCharter)) return null;
  return redactProjectLinkedFolderPath(project, sanitize(project.projectCharter.trim()));
}

function pushMarkdownMemoryCore(lines: string[], project: ProjectMemory): void {
  const charter = sanitizeProjectCharter(project);
  if (!charter) return;

  lines.push('## Memory Core');
  lines.push(charter);
  lines.push('');
}

function pushAgentCharter(lines: string[], project: ProjectMemory): void {
  const charter = sanitizeProjectCharter(project);
  if (!charter) return;

  lines.push('AGENT_CHARTER:');
  lines.push(charter);
  lines.push('Follow this project charter unless the user explicitly overrides it.');
}

function decisionsBlock(decisions: ProjectMemory['decisions'], indent = '  '): string {
  if (!decisions.length) return `${indent}(none)`;

  return decisions
    .map((d) => {
      const lines = [`${indent}- ${sanitize(d.decision)}`];
      if (d.rationale) {
        lines.push(`${indent}  Rationale: ${sanitize(d.rationale)}`);
      }
      return lines.join('\n');
    })
    .join('\n');
}

function recentGitCommitsBlock(commits: GitCommit[] | undefined, indent = '  '): string | null {
  if (!Array.isArray(commits) || commits.length === 0) return null;

  return commits
    .slice(0, 5)
    .map((commit) => {
      const dateOnly = commit.timestamp?.slice(0, 10) || '';
      return `${indent}- ${sanitize(commit.hash)} ${sanitize(dateOnly)}: ${sanitize(commit.message)}`;
    })
    .join('\n');
}

// Current protocol version — increment MAJOR for breaking schema changes,
// MINOR for new optional fields, PATCH for doc-only fixes.
export const MEMPHANT_UPDATE_SCHEMA_VERSION = '1.1.0';

export const RESPONSE_FORMAT = `
---
When you finish your response, you MUST include a project update
block. This is not optional — Memephant uses it to automatically
sync what changed in this session back into the app.

Fill in every field that changed. Do not wait for the user to
tell you what changed — you just worked on this project, so you
know what changed.

The update block must begin with the exact word \`memphant_update\`
on its own line (plain text only — no asterisks, no backticks, no
other text on that line), followed immediately by the fenced
\`\`\`json block on the very next line. Do not add any text
between the label and the code fence.

memphant_update
\`\`\`json
{
  "schemaVersion": "1.1.0",
  "currentState": "Write 1-2 sentences describing what is true right now after this session. What was built, fixed, or decided?",
  "lastSessionSummary": "Write 2-4 sentences recapping exactly what happened in this session. Be specific — mention file names, decisions made, problems solved.",
  "inProgress": ["List only things actively being worked on right now — not done, not future"],
  "nextSteps": ["List the immediate next actions that should happen after this session"],
  "openQuestion": "The single most important unresolved question or decision needed to move forward",
  "goals": ["Only include if a genuinely new goal emerged this session"],
  "decisions": [{"decision": "Only include genuinely new decisions made this session", "rationale": "Why this decision was made"}]
}
\`\`\`

Rules:
- currentState and lastSessionSummary are ALWAYS required — fill them in based on what you just did
- nextSteps should reflect what logically comes next, not a copy of what was already listed
- Only include goals and decisions if something genuinely new was decided this session
- Never include duplicate nextSteps — if it was already listed, omit it
- Keep all values concise — one sentence per item maximum
- The JSON must be valid — no trailing commas, no comments inside the JSON`;

function formatForClaude(project: ProjectMemory, task?: string, recentActivity?: string): string {
  const lines: string[] = [];

  lines.push(`<project_context>`);
  lines.push(`  <name>${sanitize(project.name)}</name>`);
  if (project.githubRepo) {
    lines.push(`  <github_repo>${project.githubRepo}</github_repo>`);
    lines.push(`  <!-- The GitHub repo above is public — you can browse the code directly -->`);
  }
  if (project.detectedStack && project.detectedStack.length > 0) {
    lines.push(`  <tech_stack>${sanitize(project.detectedStack.join(', '))}</tech_stack>`);
  }
  lines.push(`  <summary>${sanitize(project.summary || '(no summary yet)')}</summary>`);
  lines.push(`  <current_state>${sanitize(project.currentState || '(not set)')}</current_state>`);
  const projectCharter = sanitizeProjectCharter(project);
  if (projectCharter) {
    lines.push(`  <memory_core>`);
    lines.push(projectCharter);
    lines.push(`  </memory_core>`);
  }

  const gitBlock = recentGitCommitsBlock(project.pendingGitCommits);
  if (gitBlock) {
    lines.push(`  <recent_git_commits>`);
    lines.push(gitBlock);
    lines.push(`  </recent_git_commits>`);
  }

  if (hasItems(project.inProgress)) {
    lines.push(`  <in_progress>`);
    lines.push(bulletList(project.inProgress));
    lines.push(`  </in_progress>`);
  }

  if (hasContent(project.lastSessionSummary)) {
    lines.push(`  <last_session_summary>${sanitize(project.lastSessionSummary)}</last_session_summary>`);
  }

  if (hasContent(project.openQuestion)) {
    lines.push(`  <open_question>${sanitize(project.openQuestion)}</open_question>`);
  }

  lines.push(`  <goals>`);
  lines.push(bulletList(project.goals));
  lines.push(`  </goals>`);

  lines.push(`  <rules>`);
  lines.push(bulletList(project.rules));
  lines.push(`  </rules>`);

  lines.push(`  <key_decisions>`);
  lines.push(decisionsBlock(project.decisions));
  lines.push(`  </key_decisions>`);

  lines.push(`  <next_steps>`);
  lines.push(bulletList(project.nextSteps));
  lines.push(`  </next_steps>`);

  lines.push(`  <open_questions>`);
  lines.push(bulletList(project.openQuestions));
  lines.push(`  </open_questions>`);

  const safeAssets = sanitizeList(project.importantAssets);
  if (safeAssets.length > 0) {
    lines.push(`  <important_assets>`);
    lines.push(bulletList(safeAssets));
    lines.push(`  </important_assets>`);
  }

  if (recentActivity) {
    lines.push('');
    lines.push(recentActivity);
  }

  if (task && task.trim()) {
    lines.push(`  <task>`);
    lines.push(`    <description>${sanitize(task)}</description>`);
    lines.push(
      `    <boundaries>Focus only on this task. Do not modify anything outside the scope of this task.</boundaries>`,
    );
    lines.push(`  </task>`);
  }

  if (project.aiInstructions) {
    lines.push(`  <ai_instructions>${sanitize(project.aiInstructions)}</ai_instructions>`);
  }

  lines.push(`</project_context>`);
  lines.push(RESPONSE_FORMAT);

  return lines.join('\n');
}

export function formatForClaudeWithManifest(
  project: ProjectMemory,
  manifestText: string,
  manifestDigest: string,
  task?: string,
  recentActivity?: string,
  frontalLobeBlock?: string,
): string {
  const parts = [
    formatForClaude(project, task, recentActivity),
    '',
    '<vcp_state_manifest>',
    sanitize(manifestText),
    '</vcp_state_manifest>',
    '',
    '<vcp_guidance>',
    `Manifest digest: ${sanitize(manifestDigest)}`,
    'Use the state manifest as the stable-ID index for project facts.',
    'When referencing goals, rules, decisions, next steps, or open questions, cite the matching manifest IDs.',
    'Do not invent IDs or claims; if the project context and manifest do not support something, say so.',
    '</vcp_guidance>',
  ].join('\n');

  return appendFrontalLobe(parts, frontalLobeBlock);
}

function formatForChatGPT(project: ProjectMemory, task?: string, recentActivity?: string): string {
  const lines: string[] = [];

  lines.push(`# Project: ${sanitize(project.name)}`);
  lines.push('');
  if (project.githubRepo) {
    lines.push(`**GitHub Repo:** ${project.githubRepo}`);
    lines.push(`*(Public repo — you can browse the code directly at the link above)*`);
    lines.push('');
  }
  if (project.detectedStack && project.detectedStack.length > 0) {
    lines.push(`**Tech Stack:** ${sanitize(project.detectedStack.join(' · '))}`);
    lines.push('');
  }
  lines.push(`Here's where we are with this project:`);
  lines.push('');
  lines.push(sanitize(project.summary || '(no summary yet)'));
  lines.push('');

  pushMarkdownMemoryCore(lines, project);

  lines.push(`## Current Status`);
  lines.push(sanitize(project.currentState || '(not set)'));
  lines.push('');

  const gitBlock = recentGitCommitsBlock(project.pendingGitCommits, '');
  if (gitBlock) {
    lines.push(`## Recent Git Commits`);
    lines.push(gitBlock);
    lines.push('');
  }

  if (hasItems(project.inProgress)) {
    lines.push(`## In Progress`);
    lines.push(bulletList(project.inProgress));
    lines.push('');
  }

  if (hasContent(project.lastSessionSummary)) {
    lines.push(`## Last Session`);
    lines.push(sanitize(project.lastSessionSummary));
    lines.push('');
  }

  if (hasContent(project.openQuestion)) {
    lines.push(`## Open Question`);
    lines.push(sanitize(project.openQuestion));
    lines.push('');
  }

  lines.push(`## Goals`);
  lines.push(numberedList(project.goals));
  lines.push('');

  lines.push(`## Rules to Follow`);
  lines.push(bulletList(project.rules));
  lines.push('');

  lines.push(`## Key Decisions Made`);
  lines.push(decisionsBlock(project.decisions, ''));
  lines.push('');

  lines.push(`## What's Next`);
  lines.push(numberedList(project.nextSteps));
  lines.push('');

  lines.push(`## Open Questions`);
  lines.push(bulletList(project.openQuestions));
  lines.push('');

  const safeAssets = sanitizeList(project.importantAssets);
  if (safeAssets.length > 0) {
    lines.push(`## Important Files & Assets`);
    lines.push(bulletList(safeAssets));
    lines.push('');
  }

  if (recentActivity) {
    lines.push('');
    lines.push(recentActivity);
  }

  if (task && task.trim()) {
    lines.push(`---`);
    lines.push(`## Your Task`);
    lines.push(sanitize(task));
    lines.push('');
    lines.push(`Please focus only on this task. Don't modify anything outside its scope.`);
    lines.push('');
  }

  if (project.aiInstructions) {
    lines.push(sanitize(project.aiInstructions));
    lines.push('');
  }

  lines.push(RESPONSE_FORMAT);

  return lines.join('\n');
}

function truncateText(value: string, maxLength: number): string {
  const clean = sanitize(value.trim());
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}...`;
}

function compactList(
  items: string[],
  maxItems: number,
  indent = '',
  emptyLabel = '(none yet)',
): string {
  const cleanItems = sanitizeList(items.map((item) => item.trim()).filter(Boolean)).slice(0, maxItems);
  if (!cleanItems.length) return `${indent}- ${emptyLabel}`;
  return cleanItems.map((item) => `${indent}- ${truncateText(item, 180)}`).join('\n');
}

const LAUNCHPAD_QUICK_START_SUMMARY =
  'LaunchPad CRM is a simple CRM for freelancers, solo founders, and small service businesses to track leads, follow-ups, customer notes, and deal status without needing a heavy CRM like Salesforce or HubSpot.';

const QUICK_START_FALLBACK_TASKS = {
  aiTooling: 'Help me continue improving onboarding, export flow, and cross-AI continuity.',
  crm: 'Help me design the follow-up reminder flow for this CRM.',
  gameDev: 'Help me continue gameplay, progression, and UX design.',
  generic: 'Help me continue from the current project state. Ask before assuming missing details.',
} as const;

type QuickStartProjectCategory = keyof typeof QUICK_START_FALLBACK_TASKS;

const MEMEPHANT_QUICK_START_CURRENT_STATE =
  'Memephant Desktop is live as a local-first cross-AI project handoff app. Recent work improved Memory Vault, Quick Start exports, export reliability, and fresh ChatGPT handoff compatibility.';

const LAUNCHPAD_QUICK_START_CURRENT_STATE =
  'LaunchPad CRM is at the early MVP design stage, focused on lead tracking, follow-up reminders, notes, and deal status.';

const GENERIC_QUICK_START_CURRENT_STATE =
  'The project is ready to continue from the available saved context.';

const QUICK_START_EXTRA_PLACEHOLDER_PATTERNS = [
  /add a brief description/i,
  /what was built, fixed, or decided/i,
  /only include if/i,
  /only include genuinely/i,
  /not done, not future/i,
];

function isLaunchPadProject(project: ProjectMemory): boolean {
  return /launchpad\s+crm/i.test(project.name);
}

function isGenericSummary(value: string | undefined | null): boolean {
  const clean = value?.trim() ?? '';
  if (clean.length < 24) return true;

  return [
    /\bis a project\b/i,
    /add a brief description/i,
    /what it does and who it'?s for/i,
    /\(no summary yet\)/i,
  ].some((pattern) => pattern.test(clean));
}

function isGenericTask(value: string | undefined | null): boolean {
  const clean = value?.trim() ?? '';
  if (clean.length < 12) return true;

  return [
    /help me continue from the current state/i,
    /\(not set\)/i,
    /\(none\)/i,
  ].some((pattern) => pattern.test(clean));
}

function isQuickStartPlaceholder(value: string | undefined | null): boolean {
  const clean = value?.trim() ?? '';
  if (!clean) return true;

  return (
    isMemphantPlaceholderValue(clean)
    || QUICK_START_EXTRA_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(clean))
  );
}

function getProjectCategoryText(project: ProjectMemory): string {
  const maybeTags = (project as ProjectMemory & { tags?: unknown }).tags;
  const tags = Array.isArray(maybeTags)
    ? maybeTags.filter((tag): tag is string => typeof tag === 'string')
    : [];

  return [
    project.name,
    project.summary,
    project.currentState,
    ...project.goals,
    ...tags,
  ].filter(Boolean).join(' ').toLowerCase();
}

function getQuickStartProjectCategory(project: ProjectMemory): QuickStartProjectCategory {
  const text = getProjectCategoryText(project);

  if (/\b(memephant|ai tooling|ai handoff|handoff export|cross-ai|memory vault|context passport)\b/i.test(text)) {
    return 'aiTooling';
  }

  if (/\b(crm|customer relationship|leads?|follow-?ups?|deal status|pipeline)\b/i.test(text)) {
    return 'crm';
  }

  if (/\b(game|gameplay|progression|level design|player|quest|unity|godot|unreal)\b/i.test(text)) {
    return 'gameDev';
  }

  return 'generic';
}

function getQuickStartSummary(project: ProjectMemory): string {
  if (isLaunchPadProject(project) || isGenericSummary(project.summary)) {
    return LAUNCHPAD_QUICK_START_SUMMARY;
  }

  return project.summary;
}

function getQuickStartTask(project: ProjectMemory, task?: string): string {
  if (isGenericTask(task)) {
    return QUICK_START_FALLBACK_TASKS[getQuickStartProjectCategory(project)];
  }

  return task!.trim();
}

function getQuickStartCurrentState(project: ProjectMemory): string {
  if (!isQuickStartPlaceholder(project.currentState) && project.currentState.trim().length >= 12) {
    return project.currentState;
  }

  if (getQuickStartProjectCategory(project) === 'aiTooling') {
    return MEMEPHANT_QUICK_START_CURRENT_STATE;
  }

  if (isLaunchPadProject(project)) {
    return LAUNCHPAD_QUICK_START_CURRENT_STATE;
  }

  return GENERIC_QUICK_START_CURRENT_STATE;
}

function filterQuickStartStrings(items: string[]): string[] {
  return items.map((item) => item.trim()).filter((item) => !isQuickStartPlaceholder(item));
}

function filterQuickStartDecisions(decisions: Decision[]): Decision[] {
  return decisions.filter((decision) => !isQuickStartPlaceholder(decision.decision));
}

function condensedFrontalLobeBlock(block?: string): string | null {
  if (!block?.trim()) return null;

  const usefulLines = block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) =>
      /^Answer Style:/i.test(line)
      || /^Challenge Level:/i.test(line)
      || /^Tone:/i.test(line)
      || /^Language:/i.test(line)
      || /^Use .+ English spelling and phrasing/i.test(line)
      || /^Use British spelling and phrasing/i.test(line)
      || /^Code Instruction Style:/i.test(line),
    )
    .slice(0, 6);

  if (!usefulLines.length) return null;
  return usefulLines.map((line) => `- ${sanitize(line)}`).join('\n');
}

function formatQuickStart(
  project: ProjectMemory,
  task?: string,
  frontalLobeBlock?: string,
): string {
  const lines: string[] = [];
  const workingStyle = condensedFrontalLobeBlock(frontalLobeBlock);
  const summary = getQuickStartSummary(project);
  const immediateTask = getQuickStartTask(project, task);
  const currentState = getQuickStartCurrentState(project);
  const goals = filterQuickStartStrings(project.goals);
  const rules = filterQuickStartStrings(project.rules);
  filterQuickStartStrings(project.nextSteps);
  filterQuickStartDecisions(project.decisions);

  lines.push(`# Quick Start Export: ${sanitize(project.name)}`);
  lines.push('');
  lines.push('Fresh Chat Optimized');
  lines.push('');
  lines.push('## Project Summary');
  lines.push(truncateText(summary, 600));
  lines.push('');
  lines.push('## Current State');
  lines.push(truncateText(currentState, 500));
  lines.push('');
  lines.push('## Immediate Task');
  lines.push(truncateText(immediateTask, 600));
  lines.push('');
  lines.push('## Goals');
  lines.push(compactList(goals, 4));
  lines.push('');
  lines.push('## Important Rules');
  lines.push(compactList(rules, 5, '', 'Ask before assuming missing details.'));

  if (workingStyle) {
    lines.push('');
    lines.push('## AI Working Style');
    lines.push(workingStyle);
  }

  lines.push('');
  lines.push('Please use this lightweight context to start the chat. Ask before assuming missing details.');

  return lines.join('\n');
}

function formatForGrok(project: ProjectMemory, task?: string): string {
  const lines: string[] = [];

  lines.push(`PROJECT: ${sanitize(project.name)}`);
  if (project.githubRepo) lines.push(`REPO: ${project.githubRepo}`);
  if (project.detectedStack && project.detectedStack.length > 0) {
    lines.push(`STACK: ${sanitize(project.detectedStack.join(', '))}`);
  }
  lines.push(`STATUS: ${sanitize(project.currentState || 'not set')}`);
  const grokCharter = sanitizeProjectCharter(project);
  if (grokCharter) {
    lines.push(`MEMORY_CORE: ${grokCharter}`);
  }

  if (project.pendingGitCommits?.length) {
    lines.push(`RECENT_GIT_COMMITS:`);
    project.pendingGitCommits.slice(0, 5).forEach((commit) => {
      const dateOnly = commit.timestamp?.slice(0, 10) || '';
      lines.push(`  - ${sanitize(commit.hash)} ${sanitize(dateOnly)}: ${sanitize(commit.message)}`);
    });
  }

  if (hasItems(project.inProgress)) {
    lines.push(`IN_PROGRESS: ${sanitizeList(project.inProgress).join(', ')}`);
  }
  if (hasContent(project.lastSessionSummary)) {
    lines.push(`LAST_SESSION: ${sanitize(project.lastSessionSummary)}`);
  }
  if (hasContent(project.openQuestion)) {
    lines.push(`OPEN_QUESTION: ${sanitize(project.openQuestion)}`);
  }
  if (task && task.trim()) lines.push(`TASK: ${sanitize(task)}`);
  lines.push(`GOALS: ${sanitizeList(project.goals).join(', ') || 'none'}`);
  lines.push(`RULES: ${sanitizeList(project.rules).join(', ') || 'none'}`);

  if (project.decisions.length > 0) {
    lines.push(`DECISIONS:`);
    project.decisions.forEach((d) => {
      lines.push(`  - ${sanitize(d.decision)}`);
      if (d.rationale) lines.push(`    (${sanitize(d.rationale)})`);
    });
  }

  lines.push(`NEXT: ${sanitizeList(project.nextSteps).join(', ') || 'none'}`);
  lines.push(`QUESTIONS: ${sanitizeList(project.openQuestions).join(', ') || 'none'}`);

  if (task && task.trim()) {
    lines.push(`SCOPE: Focus on the task above. Don't change anything else.`);
  }

  if (project.aiInstructions) {
    lines.push('');
    lines.push(sanitize(project.aiInstructions));
  }

  lines.push('');
  lines.push(RESPONSE_FORMAT);

  return lines.join('\n');
}

function formatForPerplexity(project: ProjectMemory, task?: string): string {
  const lines: string[] = [];

  lines.push(`I'm working on a project called ${sanitize(project.name)}.`);
  lines.push('');
  if (project.githubRepo) {
    lines.push(`The code lives at: ${project.githubRepo}`);
    lines.push('');
  }
  if (project.detectedStack && project.detectedStack.length > 0) {
    lines.push(`Tech stack: ${sanitize(project.detectedStack.join(', '))}`);
    lines.push('');
  }
  lines.push(sanitize(project.summary || '(no summary yet)'));
  lines.push('');
  const perplexityCharter = sanitizeProjectCharter(project);
  if (perplexityCharter) {
    lines.push(`Memory Core: ${perplexityCharter}`);
    lines.push('');
  }
  lines.push(`Current state: ${sanitize(project.currentState || 'not set')}`);
  lines.push('');

  const gitBlock = recentGitCommitsBlock(project.pendingGitCommits, '');
  if (gitBlock) {
    lines.push(`Recent Git commits:`);
    lines.push(gitBlock);
    lines.push('');
  }

  if (hasItems(project.inProgress)) {
    lines.push(`Currently working on: ${sanitizeList(project.inProgress).join('; ')}`);
    lines.push('');
  }

  if (hasContent(project.lastSessionSummary)) {
    lines.push(`Last session: ${sanitize(project.lastSessionSummary)}`);
    lines.push('');
  }

  if (hasContent(project.openQuestion)) {
    lines.push(`Key question: ${sanitize(project.openQuestion)}`);
    lines.push('');
  }

  if (task && task.trim()) {
    lines.push(`I need help with this specific research task: ${sanitize(task)}`);
  } else if (project.openQuestions.length > 0) {
    lines.push(`Here's what I need help researching:`);
    lines.push(numberedList(project.openQuestions));
  }
  lines.push('');

  if (project.decisions.length > 0) {
    lines.push(`For context, here are the key decisions we've made so far:`);
    lines.push(decisionsBlock(project.decisions, ''));
    lines.push('');
  }

  if (project.rules.length > 0) {
    lines.push(`And the rules we're following:`);
    lines.push(bulletList(project.rules));
    lines.push('');
  }

  if (project.aiInstructions) {
    lines.push(sanitize(project.aiInstructions));
    lines.push('');
  }

  lines.push(RESPONSE_FORMAT);

  return lines.join('\n');
}

function formatForGemini(project: ProjectMemory, task?: string): string {
  const lines: string[] = [];

  lines.push(`## Project: **${sanitize(project.name)}**`);
  lines.push('');
  if (project.githubRepo) {
    lines.push(`**GitHub:** ${project.githubRepo}`);
    lines.push('');
  }
  if (project.detectedStack && project.detectedStack.length > 0) {
    lines.push(`**Tech Stack:** ${sanitize(project.detectedStack.join(' · '))}`);
    lines.push('');
  }
  lines.push(sanitize(project.summary || '(no summary yet)'));
  lines.push('');

  pushMarkdownMemoryCore(lines, project);

  lines.push(`## Current Status`);
  lines.push(`**${sanitize(project.currentState || 'not set')}**`);
  lines.push('');

  const gitBlock = recentGitCommitsBlock(project.pendingGitCommits, '');
  if (gitBlock) {
    lines.push(`## Recent Git Commits`);
    lines.push(gitBlock);
    lines.push('');
  }

  if (hasItems(project.inProgress)) {
    lines.push(`## In Progress`);
    lines.push(bulletList(project.inProgress));
    lines.push('');
  }

  if (hasContent(project.lastSessionSummary)) {
    lines.push(`## Last Session`);
    lines.push(sanitize(project.lastSessionSummary));
    lines.push('');
  }

  if (hasContent(project.openQuestion)) {
    lines.push(`## Open Question`);
    lines.push(sanitize(project.openQuestion));
    lines.push('');
  }

  lines.push(`## Goals`);
  lines.push(numberedList(project.goals));
  lines.push('');

  lines.push(`## Rules to Follow`);
  lines.push(bulletList(project.rules));
  lines.push('');

  lines.push(`## Key Decisions Made`);
  lines.push(decisionsBlock(project.decisions, ''));
  lines.push('');

  lines.push(`## What's Next`);
  lines.push(numberedList(project.nextSteps));
  lines.push('');

  lines.push(`## Open Questions`);
  lines.push(bulletList(project.openQuestions));
  lines.push('');

  if (task && task.trim()) {
    lines.push(`---`);
    lines.push(`## Your Task`);
    lines.push(`**${sanitize(task)}**`);
    lines.push('');
    lines.push(`Please focus only on this task. Don't modify anything outside its scope.`);
    lines.push('');
  }

  if (project.aiInstructions) {
    lines.push(sanitize(project.aiInstructions));
    lines.push('');
  }

  lines.push(RESPONSE_FORMAT);

  return lines.join('\n');
}

function formatGenericForPlatform(
  project: ProjectMemory,
  platform: Platform,
  task?: string,
  platformConfig?: AIPlatformConfig,
): string {
  const config = platformConfig ?? getPlatformConfig(platform);
  const lines: string[] = [];

  lines.push(`${config.name} project handoff`);
  lines.push('');
  lines.push(config.promptPrefix);
  lines.push('');
  lines.push(`Project: ${sanitize(project.name)}`);
  lines.push(`Summary: ${sanitize(project.summary || '(no summary yet)')}`);
  lines.push(`Current state: ${sanitize(project.currentState || '(not set)')}`);
  const genericCharter = sanitizeProjectCharter(project);
  if (genericCharter) {
    lines.push(`Memory Core: ${genericCharter}`);
  }

  const gitBlock = recentGitCommitsBlock(project.pendingGitCommits, '');
  if (gitBlock) {
    lines.push(`Recent git commits:`);
    lines.push(gitBlock);
  }

  if (hasItems(project.inProgress)) {
    lines.push(`In progress: ${sanitizeList(project.inProgress).join('; ')}`);
  }
  if (hasContent(project.lastSessionSummary)) {
    lines.push(`Last session: ${sanitize(project.lastSessionSummary)}`);
  }
  if (hasContent(project.openQuestion)) {
    lines.push(`Open question: ${sanitize(project.openQuestion)}`);
  }
  lines.push('');

  if (project.githubRepo) {
    lines.push(`Public repo: ${project.githubRepo}`);
  }
  if (project.detectedStack && project.detectedStack.length > 0) {
    lines.push(`Tech stack: ${sanitize(project.detectedStack.join(', '))}`);
  }
  if (project.githubRepo || (project.detectedStack && project.detectedStack.length > 0)) {
    lines.push('');
  }

  if (config.exportStyle === 'code-heavy') {
    lines.push('Implementation context:');
    lines.push(`- Goals: ${sanitizeList(project.goals).join(', ') || '(none)'}`);
    lines.push(`- Next steps: ${sanitizeList(project.nextSteps).join(', ') || '(none)'}`);
    lines.push(`- Important assets: ${sanitizeList(project.importantAssets).join(', ') || '(none)'}`);
    lines.push('');
  } else if (config.exportStyle === 'compact') {
    lines.push('Goals:');
    lines.push(bulletList(project.goals));
    lines.push('');
    lines.push('Next steps:');
    lines.push(bulletList(project.nextSteps));
    lines.push('');
  } else {
    lines.push('Goals:');
    lines.push(numberedList(project.goals));
    lines.push('');
    lines.push('Rules:');
    lines.push(bulletList(project.rules));
    lines.push('');
    lines.push('Key decisions:');
    lines.push(decisionsBlock(project.decisions, ''));
    lines.push('');
    lines.push('Next steps:');
    lines.push(numberedList(project.nextSteps));
    lines.push('');
    lines.push('Open questions:');
    lines.push(bulletList(project.openQuestions));
    lines.push('');
  }

  if (task && task.trim()) {
    lines.push(`Active task: ${sanitize(task)}`);
    lines.push('');
  }

  if (project.aiInstructions) {
    lines.push(`Project instructions: ${sanitize(project.aiInstructions)}`);
    lines.push('');
  }

  lines.push(RESPONSE_FORMAT);

  return lines.join('\n');
}

// ─── Smart export (context distillation) ────────────────────────────────────

/**
 * Distils a project down to what an AI actually needs right now.
 * Drops stale / noisy content, trims long lists, surfaces fresh activity.
 */
function distillProject(project: ProjectMemory): ProjectMemory {
  const STALE_DAYS = 30;
  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Recent changelog entries (last 30 days, max 5) — used to infer active areas
  const recentLog = (project.changelog ?? [])
    .filter((e) => e.timestamp >= cutoff)
    .slice(-5);
  const activeFields = new Set(recentLog.map((e) => e.field));

  // Keep goals that are recent or if we have few
  const goals =
    project.goals.length <= 5
      ? project.goals
      : activeFields.has('goals')
        ? project.goals.slice(-5)
        : project.goals.slice(0, 5);

  // Keep only last 5 decisions — old decisions are usually baked in by now
  const decisions = project.decisions.slice(-5);

  // Trim asset list — AIs don't need 200 file names, just the key ones
  const importantAssets = project.importantAssets.slice(0, 20);

  // Keep all next steps and open questions — these are always current
  return {
    ...project,
    goals,
    decisions,
    importantAssets,
    // Trim rules to 8 max — keep the most recently relevant ones
    rules: project.rules.slice(-8),
  };
}

function formatSmartExport(
  project: ProjectMemory,
  platform: Platform,
  task?: string,
  platformConfig?: AIPlatformConfig,
  recentActivity?: string,
): string {
  const condensed = distillProject(project);

  const dropped = {
    goals: project.goals.length - condensed.goals.length,
    decisions: project.decisions.length - condensed.decisions.length,
    assets: project.importantAssets.length - condensed.importantAssets.length,
    rules: project.rules.length - condensed.rules.length,
  };

  const totalDropped = Object.values(dropped).reduce((a, b) => a + b, 0);
  const header =
    totalDropped > 0
      ? `[Smart Export — ${totalDropped} older item${totalDropped !== 1 ? 's' : ''} condensed to reduce noise]\n\n`
      : '';

  // Delegate to the platform formatter with the condensed project
  let body: string;
  switch (platform) {
    case 'claude':
      body = formatForClaude(condensed, task, recentActivity);
      break;
    case 'chatgpt':
      body = formatForChatGPT(condensed, task, recentActivity);
      break;
    case 'grok':
      body = formatForGrok(condensed, task);
      break;
    case 'perplexity':
      body = formatForPerplexity(condensed, task);
      break;
    case 'gemini':
      body = formatForGemini(condensed, task);
      break;
    default:
      body = formatGenericForPlatform(condensed, platform, task, platformConfig);
  }

  return header + body;
}

function formatDelta(project: ProjectMemory, task?: string): string {
  const lines: string[] = [];

  lines.push(`Project: ${sanitize(project.name)}`);
  lines.push(`Status: ${sanitize(project.currentState || 'not set')}`);
  const deltaCharter = sanitizeProjectCharter(project);
  if (deltaCharter) {
    lines.push(`Memory Core: ${deltaCharter}`);
  }
  lines.push('');

  const gitBlock = recentGitCommitsBlock(project.pendingGitCommits, '');
  if (gitBlock) {
    lines.push(`Recent Git Commits:`);
    lines.push(gitBlock);
    lines.push('');
  }

  lines.push(`Next Steps:`);
  lines.push(numberedList(project.nextSteps));

  if (project.openQuestions.length > 0) {
    lines.push('');
    lines.push(`Open Questions:`);
    lines.push(bulletList(project.openQuestions));
  }

  if (task && task.trim()) {
    lines.push('');
    lines.push(`Task: ${sanitize(task)}`);
  }

  if (project.aiInstructions) {
    lines.push('');
    lines.push(sanitize(project.aiInstructions));
  }

  lines.push(RESPONSE_FORMAT);
  return lines.join('\n');
}

function formatSpecialist(project: ProjectMemory, task?: string): string {
  const lines: string[] = [];

  lines.push(`Project: ${sanitize(project.name)}`);
  lines.push(sanitize(project.summary || '(no summary yet)'));
  lines.push('');

  pushMarkdownMemoryCore(lines, project);

  const gitBlock = recentGitCommitsBlock(project.pendingGitCommits, '');
  if (gitBlock) {
    lines.push(`Recent Git Commits:`);
    lines.push(gitBlock);
    lines.push('');
  }

  if (task && task.trim()) {
    lines.push(`Task to complete:`);
    lines.push(sanitize(task));
    lines.push('');
  }

  if (project.rules.length > 0) {
    lines.push(`Rules:`);
    lines.push(bulletList(project.rules));
    lines.push('');
  }

  if (project.decisions.length > 0) {
    lines.push(`Key Decisions:`);
    lines.push(decisionsBlock(project.decisions, ''));
    lines.push('');
  }

  if (project.aiInstructions) {
    lines.push(sanitize(project.aiInstructions));
    lines.push('');
  }

  lines.push(RESPONSE_FORMAT);
  return lines.join('\n');
}

function formatForCodex(project: ProjectMemory, task?: string): string {
  const lines: string[] = [];

  lines.push(`PROJECT: ${sanitize(project.name)}`);
  if (project.githubRepo) lines.push(`REPO: ${project.githubRepo}`);
  if (project.detectedStack && project.detectedStack.length > 0) {
    lines.push(`STACK: ${sanitize(project.detectedStack.join(', '))}`);
  }
  lines.push(`STATUS: ${sanitize(project.currentState || 'not set')}`);
  pushAgentCharter(lines, project);

  if (project.pendingGitCommits?.length) {
    lines.push(`RECENT_GIT_COMMITS:`);
    project.pendingGitCommits.slice(0, 5).forEach((commit) => {
      const dateOnly = commit.timestamp?.slice(0, 10) || '';
      lines.push(`  - ${sanitize(commit.hash)} ${sanitize(dateOnly)}: ${sanitize(commit.message)}`);
    });
  }

  if (hasItems(project.inProgress)) {
    lines.push(`IN_PROGRESS: ${sanitizeList(project.inProgress).join(', ')}`);
  }
  if (hasContent(project.lastSessionSummary)) {
    lines.push(`LAST_SESSION: ${sanitize(project.lastSessionSummary)}`);
  }
  if (hasContent(project.openQuestion)) {
    lines.push(`OPEN_QUESTION: ${sanitize(project.openQuestion)}`);
  }
  if (task && task.trim()) lines.push(`TASK: ${sanitize(task)}`);
  lines.push(`GOALS: ${sanitizeList(project.goals).join(', ') || 'none'}`);
  lines.push(`RULES: ${sanitizeList(project.rules).join(', ') || 'none'}`);

  if (project.decisions.length > 0) {
    lines.push(`DECISIONS:`);
    project.decisions.forEach((d) => {
      lines.push(`  - ${sanitize(d.decision)}`);
      if (d.rationale) lines.push(`    (${sanitize(d.rationale)})`);
    });
  }

  lines.push(`NEXT: ${sanitizeList(project.nextSteps).join(', ') || 'none'}`);
  lines.push(`QUESTIONS: ${sanitizeList(project.openQuestions).join(', ') || 'none'}`);
  lines.push(`IMPORTANT_ASSETS: ${sanitizeList(project.importantAssets).join(', ') || 'none'}`);

  if (task && task.trim()) {
    lines.push(`SCOPE: Focus on the task above. Don't change anything else.`);
  }

  if (project.aiInstructions) {
    lines.push('');
    lines.push(sanitize(project.aiInstructions));
  }

  lines.push('');
  lines.push(`Your task: verify the claims in the previous session against the actual codebase.`);
  lines.push('');
  lines.push(`Return:`);
  lines.push(`1. For each claim from the previous session, mark it as`);
  lines.push(`   VERIFIED, REFUTED, or UNVERIFIED with the file evidence.`);
  lines.push(`2. Files you inspected (relative paths only — no absolute paths).`);
  lines.push(`3. Bugs found that the previous session missed.`);
  lines.push(`4. memphant_update JSON block.`);
  lines.push('');
  lines.push(RESPONSE_FORMAT);

  return lines.join('\n');
}

function formatForCowork(project: ProjectMemory, task?: string): string {
  const lines: string[] = [];

  lines.push(`PROJECT: ${sanitize(project.name)}`);
  if (project.githubRepo) lines.push(`REPO: ${project.githubRepo}`);
  if (project.detectedStack && project.detectedStack.length > 0) {
    lines.push(`STACK: ${sanitize(project.detectedStack.join(', '))}`);
  }
  lines.push(`STATUS: ${sanitize(project.currentState || 'not set')}`);
  pushAgentCharter(lines, project);

  if (project.pendingGitCommits?.length) {
    lines.push(`RECENT_GIT_COMMITS:`);
    project.pendingGitCommits.slice(0, 5).forEach((commit) => {
      const dateOnly = commit.timestamp?.slice(0, 10) || '';
      lines.push(`  - ${sanitize(commit.hash)} ${sanitize(dateOnly)}: ${sanitize(commit.message)}`);
    });
  }

  if (hasItems(project.inProgress)) {
    lines.push(`IN_PROGRESS: ${sanitizeList(project.inProgress).join(', ')}`);
  }
  if (hasContent(project.lastSessionSummary)) {
    lines.push(`LAST_SESSION: ${sanitize(project.lastSessionSummary)}`);
  }
  if (hasContent(project.openQuestion)) {
    lines.push(`OPEN_QUESTION: ${sanitize(project.openQuestion)}`);
  }
  if (task && task.trim()) lines.push(`TASK: ${sanitize(task)}`);
  lines.push(`GOALS: ${sanitizeList(project.goals).join(', ') || 'none'}`);
  lines.push(`RULES: ${sanitizeList(project.rules).join(', ') || 'none'}`);

  if (project.decisions.length > 0) {
    lines.push(`DECISIONS:`);
    project.decisions.forEach((d) => {
      lines.push(`  - ${sanitize(d.decision)}`);
      if (d.rationale) lines.push(`    (${sanitize(d.rationale)})`);
    });
  }

  lines.push(`NEXT: ${sanitizeList(project.nextSteps).join(', ') || 'none'}`);
  lines.push(`QUESTIONS: ${sanitizeList(project.openQuestions).join(', ') || 'none'}`);
  lines.push(`IMPORTANT_ASSETS: ${sanitizeList(project.importantAssets).join(', ') || 'none'}`);

  if (task && task.trim()) {
    lines.push(`SCOPE: Focus on the task above. Don't change anything else.`);
  }

  if (project.aiInstructions) {
    lines.push('');
    lines.push(sanitize(project.aiInstructions));
  }

  lines.push('');
  lines.push(`Your task: review continuity and architecture.`);
  lines.push('');
  lines.push(`Return:`);
  lines.push(`1. Continuity check: does the proposed work preserve all`);
  lines.push(`   decisions from the previous session?`);
  lines.push(`2. Architecture review of the proposed changes.`);
  lines.push(`3. Risks the previous session may have missed.`);
  lines.push(`4. Recommended implementation plan as 3-5 ordered steps.`);
  lines.push(`5. memphant_update JSON block.`);
  lines.push('');
  lines.push(RESPONSE_FORMAT);

  return lines.join('\n');
}

export function formatForPlatform(
  project: ProjectMemory,
  platform: Platform,
  task?: string,
  mode: ExportMode = 'full',
  platformConfig?: AIPlatformConfig,
  recentActivity?: string,
  frontalLobeBlock?: string,
): string {
  if (mode === 'quick') return appendFrontalLobe(appendGameContext(appendWorkflowMode(formatQuickStart(project, task), project), project), frontalLobeBlock);
  if (mode === 'delta') return appendFrontalLobe(appendGameContext(appendWorkflowMode(formatDelta(project, task), project), project), frontalLobeBlock);
  if (mode === 'specialist') return appendFrontalLobe(appendGameContext(appendWorkflowMode(formatSpecialist(project, task), project), project), frontalLobeBlock);
  if (mode === 'smart') return appendFrontalLobe(
    appendGameContext(
      appendWorkflowMode(formatSmartExport(project, platform, task, platformConfig, recentActivity), project),
      project,
    ),
    frontalLobeBlock,
  );

  let output: string;

  switch (platform) {
    case 'claude':
      output = formatForClaude(project, task, recentActivity);
      break;
    case 'chatgpt':
      output = formatForChatGPT(project, task, recentActivity);
      break;
    case 'grok':
      output = formatForGrok(project, task);
      break;
    case 'perplexity':
      output = formatForPerplexity(project, task);
      break;
    case 'gemini':
      output = formatForGemini(project, task);
      break;
    case 'codex':
      output = formatForCodex(project, task);
      break;
    case 'cowork':
      output = formatForCowork(project, task);
      break;
    default:
      output = formatGenericForPlatform(project, platform, task, platformConfig);
  }

  return appendFrontalLobe(appendGameContext(appendWorkflowMode(output, project), project), frontalLobeBlock);
}

/**
 * Appends a pre-built Frontal Lobe block to an export string, sanitising it first.
 * Called internally — callers never pass raw vault data; they pass the output of
 * buildFrontalLobeExportBlock() which contains only typed enum labels + custom rules.
 */
function appendFrontalLobe(base: string, block?: string): string {
  if (!block || !block.trim()) return base;
  if (/^# AI Working Style\s*$/m.test(base)) return base;
  return base + '\n\n' + sanitize(block);
}

function appendWorkflowMode(base: string, project: ProjectMemory): string {
  const block = getWorkflowModeExportBlock(project.workflowMode, project);
  if (!block || /^# AI Workflow Mode\s*$/m.test(base)) return base;
  return `${base}\n\n${sanitize(block)}`;
}

function appendGameContext(base: string, project: ProjectMemory): string {
  const block = formatGameContextMarkdown(project, (value) =>
    redactProjectLinkedFolderPath(project, sanitize(value)),
  );
  if (!block || /^## Game Context\s*$/m.test(base)) return base;
  return `${base}\n\n${block}`;
}
