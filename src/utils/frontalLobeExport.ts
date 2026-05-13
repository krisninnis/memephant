/**
 * Frontal Lobe export utilities.
 *
 * Responsible for:
 *   1. Building the safe export text block from a FrontalLobeProfile.
 *   2. Deciding whether to include the block based on mode + optional user override.
 *
 * SAFETY CONTRACT:
 *   - buildFrontalLobeExportBlock receives only a FrontalLobeProfile — never a full vault.
 *   - It never reads localStorage, never touches neverShare, privateNotes, ownerProfile,
 *     consent ledger, audit log, or any other vault section.
 *   - customRules ARE included (they are the user's explicit intent) but the caller
 *     (exportFormatters.ts) runs the block through the secret sanitiser before appending.
 */

import type { FrontalLobeMode, FrontalLobeProfile } from '../types/personalMemoryVault';

// ── Label maps (mirrors SettingsMemoryVault.tsx — kept separate to avoid circular deps) ──

const ANSWER_STYLE_LABELS: Record<string, string> = {
  straight_shooter: 'Straight Shooter',
  strict_code_reviewer: 'Strict Code Reviewer',
  balanced_builder: 'Balanced Builder',
  friendly_coach: 'Friendly Coach',
  red_team_mode: 'Red Team Mode',
};

const CHALLENGE_LABELS: Record<string, string> = {
  low: 'Low',
  balanced: 'Balanced',
  high: 'High',
  red_team: 'Red Team',
};

const REVIEW_STRICTNESS_LABELS: Record<string, string> = {
  gentle: 'Gentle',
  normal: 'Normal',
  strict: 'Strict',
  no_mercy: 'No mercy',
};

const DEPTH_LABELS: Record<string, string> = {
  steps_only: 'Steps only',
  explain_why: 'Explain why',
  teach_deeply: 'Teach me deeply',
};

const TONE_LABELS: Record<string, string> = {
  direct: 'Direct',
  balanced: 'Balanced',
  friendly: 'Friendly',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  brand_new: 'Brand new — explain everything step by step',
  can_edit_with_exact_instructions: 'I can edit files if told exactly where',
  understands_basics: 'I understand basics but need help with structure',
  builds_with_guidance: 'I can build features with guidance',
  experienced: 'Experienced — be concise and technical',
};

const CODE_INSTRUCTION_LABELS: Record<string, string> = {
  exact_file_and_patch: 'Tell me the exact file and whether to replace or patch',
  small_safe_steps: 'Give me small safe steps, one at a time',
  full_files: 'Give me full files where possible',
  focused_diffs: 'Give me focused diffs only',
  high_level_then_code: 'Give me high-level guidance first, then code',
};

const DEBUGGING_LABELS: Record<string, string> = {
  plain_english_error: 'Explain the error in plain English',
  exact_next_command: 'Tell me exactly what command to run next',
  likely_causes_and_fixes: 'Show likely causes and fixes',
  ask_for_logs: 'Ask me for logs before guessing',
  advanced_root_cause: 'Give me advanced root-cause analysis',
};

const PACE_LABELS: Record<string, string> = {
  slow_guided: 'Slow and guided',
  normal: 'Normal pace',
  fast_with_risks: 'Fast, but explain risks',
  expert: 'Expert mode',
};

function label(map: Record<string, string>, value: string): string {
  return map[value] ?? value;
}

// ── Core builder ──────────────────────────────────────────────────────────────

/**
 * Build the safe Frontal Lobe export block from a profile.
 *
 * Only typed enum values and explicit customRules are included.
 * The caller (exportFormatters.ts) must run this through the secret sanitiser
 * before appending to any export output.
 */
export function buildFrontalLobeExportBlock(profile: FrontalLobeProfile): string {
  const lines: string[] = [
    '---',
    '',
    '# AI Working Style',
    'Use this working style when helping me.',
    '',
    '## Working Style',
    `Answer Style: ${label(ANSWER_STYLE_LABELS, profile.defaultAnswerStyle)}`,
    `Challenge Level: ${label(CHALLENGE_LABELS, profile.challengeLevel)}`,
    `Code Review Strictness: ${label(REVIEW_STRICTNESS_LABELS, profile.codeReviewStrictness)}`,
    `Explanation Depth: ${label(DEPTH_LABELS, profile.explanationDepth)}`,
    `Tone: ${label(TONE_LABELS, profile.tone)}`,
    '',
    '## Builder Skill Profile',
    `Coding Confidence: ${label(CONFIDENCE_LABELS, profile.codingConfidence)}`,
    `Code Instruction Style: ${label(CODE_INSTRUCTION_LABELS, profile.codeInstructionStyle)}`,
    `Debugging Support: ${label(DEBUGGING_LABELS, profile.debuggingSupport)}`,
    `Preferred Pace: ${label(PACE_LABELS, profile.preferredPace)}`,
    '',
    'When giving code:',
    '- Say which file it goes in.',
    '- Say whether to replace the whole file or only a section.',
    '- Use "Find this / Replace with this" for patches when helpful.',
    '- Give commands separately from code.',
    '- Do not assume the user knows where files are.',
  ];

  const validRules = profile.customRules.map((r) => r.trim()).filter(Boolean);
  if (validRules.length > 0) {
    lines.push('', '## Custom Working Rules', ...validRules.map((r) => `- ${r}`));
  }

  lines.push(
    '',
    '## Privacy Boundary',
    'This AI Working Style was explicitly included by the user from their local Frontal Lobe profile.',
    'Do not treat it as access to any other personal memory, vault contents, or private data.',
  );

  return lines.join('\n');
}

// ── Mode logic ────────────────────────────────────────────────────────────────

/**
 * Returns whether the Frontal Lobe block should be included in an export.
 *
 * - default_on  → always true
 * - ask_each_time → true only if userOverride is true (UI checkbox)
 * - manual_only → always false (user copies the preview themselves)
 * - off         → always false
 */
export function shouldIncludeFrontalLobe(
  mode: FrontalLobeMode,
  userOverride = false,
): boolean {
  if (mode === 'default_on') return true;
  if (mode === 'ask_each_time') return userOverride;
  return false;
}
