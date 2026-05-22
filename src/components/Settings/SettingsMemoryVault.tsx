import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import {
  clearPersonalMemoryVault,
  loadPersonalMemoryVault,
  savePersonalMemoryVault,
} from '../../services/personalMemoryVaultStorage';
import {
  appendConsentLedgerEvent,
  createConsentLedgerEvent,
  createDefaultPersonalMemoryVault,
  createPersonalMemoryEntry,
  DEFAULT_FRONTAL_LOBE_PROFILE,
  getFrontalLobeLanguageInstruction,
  getFrontalLobeLanguageLabel,
  getMemephantPassportSummary,
  type ConsentLedgerAction,
  type ConsentLedgerScope,
  type FrontalLobeAnswerStyle,
  type FrontalLobeChallengeLevel,
  type FrontalLobeCodeInstructionStyle,
  type FrontalLobeCodeReviewStrictness,
  type FrontalLobeCodingConfidence,
  type FrontalLobeDebuggingSupport,
  type FrontalLobeExplanationDepth,
  type FrontalLobeLanguagePreference,
  type FrontalLobeMode,
  type FrontalLobePreferredPace,
  type FrontalLobeProfile,
  type FrontalLobeTone,
  type PersonalMemoryEntryCategory,
  type PersonalMemoryTextEntry,
  type PersonalMemoryVault,
} from '../../types/personalMemoryVault';
import { generateConsentReceiptMarkdown } from '../../utils/consentReceipt';
import ConfirmDialog from '../Shared/ConfirmDialog';

type VaultSection = {
  title: string;
  description: string;
  count?: number;
  status?: string;
};

type FutureControl = {
  label: string;
  value: string;
  detail: string;
  disabled?: boolean;
};

type MemoryAuditItem = {
  label: string;
  value: number;
  detail: string;
};

const CATEGORY_OPTIONS: Array<{ value: PersonalMemoryEntryCategory; label: string }> = [
  { value: 'owner_profile', label: 'Owner Profile' },
  { value: 'preference', label: 'Preference' },
  { value: 'goal', label: 'Goal' },
  { value: 'rule', label: 'Rule' },
  { value: 'boundary', label: 'Boundary' },
  { value: 'never_share', label: 'Never Share' },
  { value: 'custom', label: 'Custom' },
];

const CONSENT_ACTION_OPTIONS: Array<{ value: ConsentLedgerAction; label: string }> = [
  { value: 'consent_granted', label: 'Consent granted' },
  { value: 'consent_refused', label: 'Consent refused' },
  { value: 'consent_revoked', label: 'Consent revoked' },
  { value: 'permission_updated', label: 'Permission updated' },
];

const CONSENT_SCOPE_OPTIONS: Array<{ value: ConsentLedgerScope; label: string }> = [
  { value: 'ai_training', label: 'AI training' },
  { value: 'commercial_licensing', label: 'Commercial licensing' },
  { value: 'platform_sharing', label: 'Platform sharing' },
  { value: 'memory_export', label: 'Memory export' },
  { value: 'custom', label: 'Custom' },
];

const FUTURE_CONTROLS: FutureControl[] = [
  {
    label: 'Sharing permissions',
    value: 'Off',
    detail: 'No personal memory is shared with AI platforms from this vault today.',
    disabled: true,
  },
  {
    label: 'AI training permission',
    value: 'Off',
    detail: 'There is no permission flow that allows training use in this version.',
    disabled: true,
  },
  {
    label: 'Commercial licensing',
    value: 'Disabled',
    detail: 'Future licensing controls may help you choose whether data can be used commercially.',
    disabled: true,
  },
  {
    label: 'Consent receipt',
    value: 'Available',
    detail:
      'Copy a local Markdown receipt of permission state and consent history. Private memory contents are excluded.',
  },
  {
    label: 'Consent ledger',
    value: 'Local only',
    detail: 'Append-only local record for manual consent decisions.',
  },
];


type StarterSuggestion = {
  id: string;
  title: string;
  category: PersonalMemoryEntryCategory;
  content: string;
};

const STARTER_SUGGESTIONS: StarterSuggestion[] = [
  {
    id: 'starter-ai-response-style',
    title: 'AI response style',
    category: 'preference',
    content:
      'I prefer clear, direct answers with practical next steps. Use British English.',
  },
  {
    id: 'starter-code-collaboration-style',
    title: 'Code collaboration style',
    category: 'preference',
    content:
      'When helping with code, inspect before changing, make small safe slices, and explain what changed.',
  },
  {
    id: 'starter-no-guessing',
    title: 'No guessing',
    category: 'rule',
    content:
      'If something is uncertain or unverified, say so clearly instead of guessing.',
  },
  {
    id: 'starter-private-vault-boundary',
    title: 'Private vault boundary',
    category: 'boundary',
    content:
      'Do not include personal memory in project exports, Memory Trails, or AI handoffs unless I explicitly choose to share it.',
  },
  {
    id: 'starter-user-owned-ai-memory',
    title: 'User-owned AI memory',
    category: 'goal',
    content:
      'I want my AI memory to stay user-owned, portable, inspectable, and private by default.',
  },
];
type AnswerStylePreset = {
  id: string;
  title: string;
  subtitle: string;
  category: PersonalMemoryEntryCategory;
  content: string;
};

const AI_ANSWER_STYLE_PRESETS: AnswerStylePreset[] = [
  {
    id: 'answer-style-straight-shooter',
    title: 'Straight Shooter',
    subtitle: 'Direct, no filler',
    category: 'preference',
    content:
      'Give me direct answers without preamble, recap, or filler. Lead with the answer. Skip pleasantries.',
  },
  {
    id: 'answer-style-strict-code-reviewer',
    title: 'Strict Code Reviewer',
    subtitle: 'Flag every issue',
    category: 'rule',
    content:
      'Flag every issue you spot — style, logic, edge cases. Do not soften feedback or skip problems to spare my feelings.',
  },
  {
    id: 'answer-style-balanced-builder',
    title: 'Balanced Builder',
    subtitle: 'Explain why, not just what',
    category: 'preference',
    content:
      'Explain the reasoning behind suggestions, not just the steps. I want to understand decisions so I can adapt them.',
  },
  {
    id: 'answer-style-friendly-coach',
    title: 'Friendly Coach',
    subtitle: 'Encourage and celebrate',
    category: 'preference',
    content:
      'Acknowledge progress and be encouraging. Celebrate small wins alongside corrections.',
  },
  {
    id: 'answer-style-red-team',
    title: 'Red Team Mode',
    subtitle: 'Challenge assumptions',
    category: 'rule',
    content:
      'Challenge my assumptions. Find edge cases, failure modes, and things I have not considered.',
  },
];


const ANSWER_STYLE_PRESET_TITLES = new Set(AI_ANSWER_STYLE_PRESETS.map((p) => p.title));

// ── Frontal Lobe / AI Working Style ──────────────────────────────────────────

const FRONTAL_LOBE_ANSWER_STYLE_OPTIONS: Array<{ value: FrontalLobeAnswerStyle; label: string }> = [
  { value: 'straight_shooter', label: 'Straight Shooter' },
  { value: 'strict_code_reviewer', label: 'Strict Code Reviewer' },
  { value: 'balanced_builder', label: 'Balanced Builder' },
  { value: 'friendly_coach', label: 'Friendly Coach' },
  { value: 'red_team_mode', label: 'Red Team Mode' },
];

const FRONTAL_LOBE_CHALLENGE_OPTIONS: Array<{ value: FrontalLobeChallengeLevel; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'high', label: 'High' },
  { value: 'red_team', label: 'Red Team' },
];

const FRONTAL_LOBE_STRICTNESS_OPTIONS: Array<{
  value: FrontalLobeCodeReviewStrictness;
  label: string;
}> = [
  { value: 'gentle', label: 'Gentle' },
  { value: 'normal', label: 'Normal' },
  { value: 'strict', label: 'Strict' },
  { value: 'no_mercy', label: 'No mercy' },
];

const FRONTAL_LOBE_DEPTH_OPTIONS: Array<{ value: FrontalLobeExplanationDepth; label: string }> = [
  { value: 'steps_only', label: 'Steps only' },
  { value: 'explain_why', label: 'Explain why' },
  { value: 'teach_deeply', label: 'Teach me deeply' },
];

const FRONTAL_LOBE_TONE_OPTIONS: Array<{ value: FrontalLobeTone; label: string }> = [
  { value: 'direct', label: 'Direct' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'friendly', label: 'Friendly' },
];

const FRONTAL_LOBE_LANGUAGE_OPTIONS: Array<{ value: FrontalLobeLanguagePreference; label: string }> = [
  { value: 'british_english', label: 'British English' },
  { value: 'american_english', label: 'American English' },
  { value: 'australian_english', label: 'Australian English' },
  { value: 'canadian_english', label: 'Canadian English' },
  { value: 'neutral_english', label: 'Neutral English' },
];

// ── Builder Skill Profile ─────────────────────────────────────────────────────

const FRONTAL_LOBE_CODING_CONFIDENCE_OPTIONS: Array<{
  value: FrontalLobeCodingConfidence;
  label: string;
}> = [
  { value: 'brand_new', label: 'Brand new — explain everything step by step' },
  { value: 'can_edit_with_exact_instructions', label: 'I can edit files if told exactly where' },
  { value: 'understands_basics', label: 'I understand basics but need help with structure' },
  { value: 'builds_with_guidance', label: 'I can build features with guidance' },
  { value: 'experienced', label: 'Experienced — be concise and technical' },
];

const FRONTAL_LOBE_CODE_INSTRUCTION_OPTIONS: Array<{
  value: FrontalLobeCodeInstructionStyle;
  label: string;
}> = [
  { value: 'exact_file_and_patch', label: 'Tell me the exact file and whether to replace or patch' },
  { value: 'small_safe_steps', label: 'Give me small safe steps, one at a time' },
  { value: 'full_files', label: 'Give me full files where possible' },
  { value: 'focused_diffs', label: 'Give me focused diffs only' },
  { value: 'high_level_then_code', label: 'Give me high-level guidance first, then code' },
];

const FRONTAL_LOBE_DEBUGGING_OPTIONS: Array<{
  value: FrontalLobeDebuggingSupport;
  label: string;
}> = [
  { value: 'plain_english_error', label: 'Explain the error in plain English' },
  { value: 'exact_next_command', label: 'Tell me exactly what command to run next' },
  { value: 'likely_causes_and_fixes', label: 'Show likely causes and fixes' },
  { value: 'ask_for_logs', label: 'Ask me for logs before guessing' },
  { value: 'advanced_root_cause', label: 'Give me advanced root-cause analysis' },
];

const FRONTAL_LOBE_PACE_OPTIONS: Array<{ value: FrontalLobePreferredPace; label: string }> = [
  { value: 'slow_guided', label: 'Slow and guided' },
  { value: 'normal', label: 'Normal pace' },
  { value: 'fast_with_risks', label: 'Fast, but explain risks' },
  { value: 'expert', label: 'Expert mode' },
];

const FRONTAL_LOBE_MODE_OPTIONS: Array<{ value: FrontalLobeMode; label: string }> = [
  { value: 'default_on', label: 'On by default — include in every new handoff' },
  { value: 'ask_each_time', label: 'Ask each time — prompt me before including' },
  { value: 'manual_only', label: 'Manual only — I\'ll add it when I want it' },
  { value: 'off', label: 'Off — never include my Working Style' },
];

// ── Memory Vault Setup Wizard ─────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4 | 'review';

const WIZARD_CODING_OPTIONS: Array<{
  value: FrontalLobeCodingConfidence;
  label: string;
  sub: string;
}> = [
  { value: 'brand_new', label: 'I am brand new to coding', sub: 'Explain everything step by step' },
  {
    value: 'can_edit_with_exact_instructions',
    label: 'I can edit files if told exactly where',
    sub: 'Give me precise instructions',
  },
  { value: 'understands_basics', label: 'I know the basics', sub: 'Help me with structure and decisions' },
  { value: 'builds_with_guidance', label: 'I can build features with guidance', sub: 'Point me in the right direction' },
  { value: 'experienced', label: 'I am experienced', sub: 'Be concise and technical' },
];

type WizardAnswerChoice = {
  value: FrontalLobeAnswerStyle;
  label: string;
  sub: string;
  challengeLevel: FrontalLobeChallengeLevel;
  codeReviewStrictness: FrontalLobeCodeReviewStrictness;
  tone: FrontalLobeTone;
};

const WIZARD_ANSWER_OPTIONS: WizardAnswerChoice[] = [
  {
    value: 'straight_shooter',
    label: 'Direct and short',
    sub: 'Lead with the answer, skip the filler',
    challengeLevel: 'low',
    codeReviewStrictness: 'gentle',
    tone: 'direct',
  },
  {
    value: 'friendly_coach',
    label: 'Friendly coach',
    sub: 'Encourage me and celebrate progress',
    challengeLevel: 'low',
    codeReviewStrictness: 'gentle',
    tone: 'friendly',
  },
  {
    value: 'balanced_builder',
    label: 'Explain why, not just what',
    sub: 'I want to understand decisions',
    challengeLevel: 'balanced',
    codeReviewStrictness: 'normal',
    tone: 'balanced',
  },
  {
    value: 'red_team_mode',
    label: 'Challenge my ideas',
    sub: 'Find edge cases and what I missed',
    challengeLevel: 'high',
    codeReviewStrictness: 'strict',
    tone: 'direct',
  },
  {
    value: 'strict_code_reviewer',
    label: 'Strict code reviewer',
    sub: 'Flag every issue, no softening',
    challengeLevel: 'high',
    codeReviewStrictness: 'strict',
    tone: 'direct',
  },
];

const WIZARD_CODE_INSTRUCTION_OPTIONS: Array<{
  value: FrontalLobeCodeInstructionStyle;
  label: string;
  sub: string;
}> = [
  {
    value: 'exact_file_and_patch',
    label: 'Tell me the exact file and where to change it',
    sub: 'Precise file + section instructions',
  },
  { value: 'small_safe_steps', label: 'Give me small safe steps, one at a time', sub: 'Slower but nothing gets missed' },
  { value: 'full_files', label: 'Give me the full file', sub: 'Replace the whole thing each time' },
  { value: 'focused_diffs', label: 'Show me just what changed', sub: 'Focused diffs only' },
  {
    value: 'high_level_then_code',
    label: 'Explain the plan first, then the code',
    sub: 'High-level guidance before diving in',
  },
];

const WIZARD_RULE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'wizard-rule-explain-changes', label: 'Explain what changed after editing code' },
  { id: 'wizard-rule-name-file', label: 'Say which file the code goes in' },
  { id: 'wizard-rule-small-steps', label: 'Give me small safe steps, one at a time' },
  { id: 'wizard-rule-flag-risks', label: 'Flag any risks before making changes' },
  { id: 'wizard-rule-ask-if-unsure', label: "If you're unsure, ask me instead of guessing" },
];

function getLabel<T extends string>(
  options: Array<{ value: T; label: string }>,
  value: T,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

function buildFrontalLobePreview(profile: FrontalLobeProfile, customRulesText: string): string {
  const rules = customRulesText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const parts: string[] = [
    '# Frontal Lobe',
    'Use this working style when helping me.',
    '## AI Working Style\n' +
      `Answer Style: ${getLabel(FRONTAL_LOBE_ANSWER_STYLE_OPTIONS, profile.defaultAnswerStyle)}\n` +
      `Challenge Level: ${getLabel(FRONTAL_LOBE_CHALLENGE_OPTIONS, profile.challengeLevel)}\n` +
      `Code Review Strictness: ${getLabel(FRONTAL_LOBE_STRICTNESS_OPTIONS, profile.codeReviewStrictness)}\n` +
      `Explanation Depth: ${getLabel(FRONTAL_LOBE_DEPTH_OPTIONS, profile.explanationDepth)}\n` +
      `Tone: ${getLabel(FRONTAL_LOBE_TONE_OPTIONS, profile.tone)}\n` +
      `Language: ${getFrontalLobeLanguageLabel(profile.languagePreference)}\n` +
      getFrontalLobeLanguageInstruction(profile.languagePreference),
    '## Builder Skill Profile\n' +
      `Coding Confidence: ${getLabel(FRONTAL_LOBE_CODING_CONFIDENCE_OPTIONS, profile.codingConfidence)}\n` +
      `Code Instruction Style: ${getLabel(FRONTAL_LOBE_CODE_INSTRUCTION_OPTIONS, profile.codeInstructionStyle)}\n` +
      `Debugging Support: ${getLabel(FRONTAL_LOBE_DEBUGGING_OPTIONS, profile.debuggingSupport)}\n` +
      `Preferred Pace: ${getLabel(FRONTAL_LOBE_PACE_OPTIONS, profile.preferredPace)}\n` +
      '\nWhen giving code:\n' +
      '- Say which file it goes in.\n' +
      '- Say whether to replace the whole file or only a section.\n' +
      '- Use "Find this / Replace with this" for patches when helpful.\n' +
      '- Give commands separately from code.\n' +
      '- Do not assume the user knows where files are.',
  ];

  if (rules.length > 0) {
    parts.push(`## Custom Working Rules\n${rules.map((r) => `- ${r}`).join('\n')}`);
  }

  parts.push(
    '## Privacy Boundary\n' +
      'This Frontal Lobe profile is stored locally in Memephant. Do not include it in project exports, ' +
      'Memory Trails, Memory Bridge, AI handoffs, cloud sync, or external systems unless I explicitly choose to share it.',
  );

  return parts.join('\n\n');
}

function hasOwnerProfile(vault: PersonalMemoryVault): boolean {
  return Boolean(
    vault.ownerProfile.displayName ||
      vault.ownerProfile.role ||
      vault.ownerProfile.bio ||
      vault.ownerProfile.locationHint,
  );
}

function getPermissionCount(vault: PersonalMemoryVault): number {
  return Object.keys(vault.platformPermissions).length;
}

function sectionStatus(count?: number, status?: string): string {
  if (status) {
    return status;
  }

  return count && count > 0 ? `${count} saved` : 'Empty';
}

function getEntryCategory(entry: PersonalMemoryTextEntry): PersonalMemoryEntryCategory {
  return entry.category ?? 'custom';
}

function getCategoryLabel(category: PersonalMemoryEntryCategory): string {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? 'Custom';
}

function getConsentActionLabel(action: ConsentLedgerAction): string {
  return CONSENT_ACTION_OPTIONS.find((option) => option.value === action)?.label ?? action;
}

function getConsentScopeLabel(scope: ConsentLedgerScope): string {
  return CONSENT_SCOPE_OPTIONS.find((option) => option.value === scope)?.label ?? scope;
}

function getConsentStatus(action: ConsentLedgerAction, allowed: boolean): string {
  if (action === 'consent_revoked') {
    return 'Revoked';
  }

  if (action === 'consent_refused') {
    return 'Refused';
  }

  return allowed ? 'Allowed' : 'Off';
}

function getVaultEntries(vault: PersonalMemoryVault): PersonalMemoryTextEntry[] {
  return [
    ...vault.preferences,
    ...vault.goals,
    ...vault.rules,
    ...vault.privateNotes,
  ].filter((entry) => entry.value.trim().length > 0);
}


function isWorkingStyleEntry(entry: PersonalMemoryTextEntry): boolean {
  const category = getEntryCategory(entry);
  return category === 'preference' || category === 'rule' || category === 'boundary';
}

function formatWorkingStyleLine(entry: PersonalMemoryTextEntry): string {
  const label = entry.label?.trim();
  const value = entry.value.trim();
  return label ? `- ${label}: ${value}` : `- ${value}`;
}

function buildAiWorkingStylePrompt(entries: PersonalMemoryTextEntry[]): string {
  const workingEntries = entries.filter(isWorkingStyleEntry);
  const preferences = workingEntries.filter((entry) => getEntryCategory(entry) === 'preference');
  const rules = workingEntries.filter((entry) => getEntryCategory(entry) === 'rule');
  const boundaries = workingEntries.filter((entry) => getEntryCategory(entry) === 'boundary');
  const sections = [
    preferences.length ? `Preferences:\n${preferences.map(formatWorkingStyleLine).join('\n')}` : null,
    rules.length ? `Rules:\n${rules.map(formatWorkingStyleLine).join('\n')}` : null,
    boundaries.length ? `Boundaries:\n${boundaries.map(formatWorkingStyleLine).join('\n')}` : null,
  ].filter(Boolean);
  return sections.length
    ? `Use these working preferences when helping me:\n\n${sections.join('\n\n')}`
    : '';
}

function isAnswerStyleEntry(entry: PersonalMemoryTextEntry): boolean {
  return Boolean(entry.label && ANSWER_STYLE_PRESET_TITLES.has(entry.label));
}

function buildPersonalContextPassport(
  entries: PersonalMemoryTextEntry[],
  options: {
    includePreferences: boolean;
    includeRules: boolean;
    includeBoundaries: boolean;
    includeAnswerStyle: boolean;
    includeGoals: boolean;
  },
): string {
  const eligible = entries.filter((entry) => {
    const cat = getEntryCategory(entry);
    return cat !== 'never_share' && cat !== 'owner_profile' && cat !== 'custom';
  });

  const answerStyleEntries = options.includeAnswerStyle
    ? eligible.filter(isAnswerStyleEntry)
    : [];
  const answerStyleIds = new Set(answerStyleEntries.map((e) => e.id));

  const preferenceEntries = options.includePreferences
    ? eligible.filter((e) => getEntryCategory(e) === 'preference' && !answerStyleIds.has(e.id))
    : [];
  const ruleEntries = options.includeRules
    ? eligible.filter((e) => getEntryCategory(e) === 'rule' && !answerStyleIds.has(e.id))
    : [];
  const boundaryEntries = options.includeBoundaries
    ? eligible.filter((e) => getEntryCategory(e) === 'boundary' && !answerStyleIds.has(e.id))
    : [];
  const goalEntries = options.includeGoals
    ? eligible.filter((e) => getEntryCategory(e) === 'goal')
    : [];

  const formatLine = (entry: PersonalMemoryTextEntry): string => {
    const label = entry.label?.trim();
    const value = entry.value.trim();
    return label ? `- ${label}: ${value}` : `- ${value}`;
  };

  const parts: string[] = [
    '# Personal Memory Snapshot',
    'Use these personal instructions when helping me.',
  ];

  if (preferenceEntries.length > 0) {
    parts.push(`## Preferences\n${preferenceEntries.map(formatLine).join('\n')}`);
  }
  if (ruleEntries.length > 0) {
    parts.push(`## Rules\n${ruleEntries.map(formatLine).join('\n')}`);
  }
  if (boundaryEntries.length > 0) {
    parts.push(`## Boundaries\n${boundaryEntries.map(formatLine).join('\n')}`);
  }
  if (answerStyleEntries.length > 0) {
    parts.push(`## AI Answer Style\n${answerStyleEntries.map(formatLine).join('\n')}`);
  }
  if (goalEntries.length > 0) {
    parts.push(`## Goals\n${goalEntries.map(formatLine).join('\n')}`);
  }

  parts.push(
    '## Privacy Boundary\n' +
      'These instructions were manually copied by the user. Do not assume access to any other personal memory. ' +
      'Never include private Vault contents in project exports, Memory Trails, Memory Bridge, AI handoffs, ' +
      'cloud sync, or external systems unless the user explicitly asks.',
  );

  return parts.join('\n\n');
}

function countEntriesByCategory(
  vault: PersonalMemoryVault,
  category: PersonalMemoryEntryCategory,
): number {
  return getVaultEntries(vault).filter((entry) => getEntryCategory(entry) === category).length;
}

function addEntryToVault(
  vault: PersonalMemoryVault,
  entry: PersonalMemoryTextEntry,
): PersonalMemoryVault {
  const next: PersonalMemoryVault = {
    ...vault,
    preferences: [...vault.preferences],
    goals: [...vault.goals],
    rules: [...vault.rules],
    privateNotes: [...vault.privateNotes],
    neverShare: [...vault.neverShare],
    updatedAt: entry.updatedAt,
  };

  switch (getEntryCategory(entry)) {
    case 'preference':
      next.preferences.push(entry);
      break;
    case 'goal':
      next.goals.push(entry);
      break;
    case 'rule':
    case 'boundary':
      next.rules.push(entry);
      break;
    case 'never_share':
      next.neverShare.push(entry.value);
      next.privateNotes.push(entry);
      break;
    case 'owner_profile':
    case 'custom':
    default:
      next.privateNotes.push(entry);
      break;
  }

  return next;
}

function removeEntryFromVault(vault: PersonalMemoryVault, entryId: string): PersonalMemoryVault {
  const removedEntry = getVaultEntries(vault).find((entry) => entry.id === entryId);
  const now = new Date().toISOString();

  return {
    ...vault,
    preferences: vault.preferences.filter((entry) => entry.id !== entryId),
    goals: vault.goals.filter((entry) => entry.id !== entryId),
    rules: vault.rules.filter((entry) => entry.id !== entryId),
    privateNotes: vault.privateNotes.filter((entry) => entry.id !== entryId),
    neverShare:
      removedEntry?.category === 'never_share'
        ? vault.neverShare.filter((item) => item !== removedEntry.value)
        : [...vault.neverShare],
    updatedAt: now,
  };
}

export function SettingsMemoryVault() {
  const showToast = useProjectStore((s) => s.showToast);
  const [vault, setVault] = useState<PersonalMemoryVault>(() => loadPersonalMemoryVault());
  const [confirmClear, setConfirmClear] = useState(false);
  const [entryTitle, setEntryTitle] = useState('');
  const [entryContent, setEntryContent] = useState('');
  const [entryCategory, setEntryCategory] = useState<PersonalMemoryEntryCategory>('preference');
  const [formError, setFormError] = useState<string | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<PersonalMemoryTextEntry | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<PersonalMemoryEntryCategory>('preference');
  const [editError, setEditError] = useState<string | null>(null);
  const [consentAction, setConsentAction] = useState<ConsentLedgerAction>('consent_refused');
  const [consentScope, setConsentScope] = useState<ConsentLedgerScope>('ai_training');
  const [consentPlatform, setConsentPlatform] = useState('');
  const [consentTarget, setConsentTarget] = useState('');
  const [consentNotes, setConsentNotes] = useState('');
  const [consentCommercialUseAllowed, setConsentCommercialUseAllowed] = useState(false);
  const [consentAiTrainingAllowed, setConsentAiTrainingAllowed] = useState(false);
  const [consentReceiptPreview, setConsentReceiptPreview] = useState('');
  const [workingStylePreview, setWorkingStylePreview] = useState('');
  const [selectedAnswerStyleId, setSelectedAnswerStyleId] = useState('');
  const [passportIncludePreferences, setPassportIncludePreferences] = useState(true);
  const [passportIncludeRules, setPassportIncludeRules] = useState(true);
  const [passportIncludeBoundaries, setPassportIncludeBoundaries] = useState(true);
  const [passportIncludeAnswerStyle, setPassportIncludeAnswerStyle] = useState(true);
  const [passportIncludeGoals, setPassportIncludeGoals] = useState(false);

  // ── Frontal Lobe / AI Working Style profile ───────────────────────────────
  const [frontalLobeAnswerStyle, setFrontalLobeAnswerStyle] = useState<FrontalLobeAnswerStyle>(
    () => vault.frontalLobeProfile?.defaultAnswerStyle ?? DEFAULT_FRONTAL_LOBE_PROFILE.defaultAnswerStyle,
  );
  const [frontalLobeChallengeLevel, setFrontalLobeChallengeLevel] = useState<FrontalLobeChallengeLevel>(
    () => vault.frontalLobeProfile?.challengeLevel ?? DEFAULT_FRONTAL_LOBE_PROFILE.challengeLevel,
  );
  const [frontalLobeCodeReviewStrictness, setFrontalLobeCodeReviewStrictness] =
    useState<FrontalLobeCodeReviewStrictness>(
      () => vault.frontalLobeProfile?.codeReviewStrictness ?? DEFAULT_FRONTAL_LOBE_PROFILE.codeReviewStrictness,
    );
  const [frontalLobeExplanationDepth, setFrontalLobeExplanationDepth] =
    useState<FrontalLobeExplanationDepth>(
      () => vault.frontalLobeProfile?.explanationDepth ?? DEFAULT_FRONTAL_LOBE_PROFILE.explanationDepth,
    );
  const [frontalLobeTone, setFrontalLobeTone] = useState<FrontalLobeTone>(
    () => vault.frontalLobeProfile?.tone ?? DEFAULT_FRONTAL_LOBE_PROFILE.tone,
  );
  const [frontalLobeLanguagePreference, setFrontalLobeLanguagePreference] =
    useState<FrontalLobeLanguagePreference>(
      () => vault.frontalLobeProfile?.languagePreference ?? DEFAULT_FRONTAL_LOBE_PROFILE.languagePreference,
    );
  // ── Builder Skill Profile state ───────────────────────────────────────────
  const [frontalLobeCodingConfidence, setFrontalLobeCodingConfidence] =
    useState<FrontalLobeCodingConfidence>(
      () => vault.frontalLobeProfile?.codingConfidence ?? DEFAULT_FRONTAL_LOBE_PROFILE.codingConfidence,
    );
  const [frontalLobeCodeInstructionStyle, setFrontalLobeCodeInstructionStyle] =
    useState<FrontalLobeCodeInstructionStyle>(
      () => vault.frontalLobeProfile?.codeInstructionStyle ?? DEFAULT_FRONTAL_LOBE_PROFILE.codeInstructionStyle,
    );
  const [frontalLobeDebuggingSupport, setFrontalLobeDebuggingSupport] =
    useState<FrontalLobeDebuggingSupport>(
      () => vault.frontalLobeProfile?.debuggingSupport ?? DEFAULT_FRONTAL_LOBE_PROFILE.debuggingSupport,
    );
  const [frontalLobePreferredPace, setFrontalLobePreferredPace] = useState<FrontalLobePreferredPace>(
    () => vault.frontalLobeProfile?.preferredPace ?? DEFAULT_FRONTAL_LOBE_PROFILE.preferredPace,
  );
  const [frontalLobeCustomRules, setFrontalLobeCustomRules] = useState<string>(
    () => (vault.frontalLobeProfile?.customRules ?? []).join('\n'),
  );
  const [frontalLobeMode, setFrontalLobeMode] = useState<FrontalLobeMode>(
    () => vault.frontalLobeProfile?.mode ?? DEFAULT_FRONTAL_LOBE_PROFILE.mode,
  );

  // ── Wizard state ────────────────────────────────────────────────────────────
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [wizardCodingConfidence, setWizardCodingConfidence] = useState<FrontalLobeCodingConfidence>(
    DEFAULT_FRONTAL_LOBE_PROFILE.codingConfidence,
  );
  const [wizardAnswerStyle, setWizardAnswerStyle] = useState<FrontalLobeAnswerStyle>(
    DEFAULT_FRONTAL_LOBE_PROFILE.defaultAnswerStyle,
  );
  const [wizardCodeInstruction, setWizardCodeInstruction] = useState<FrontalLobeCodeInstructionStyle>(
    DEFAULT_FRONTAL_LOBE_PROFILE.codeInstructionStyle,
  );
  const [wizardSelectedRules, setWizardSelectedRules] = useState<string[]>([]);

  const frontalLobePreview = buildFrontalLobePreview(
    {
      mode: frontalLobeMode,
      defaultAnswerStyle: frontalLobeAnswerStyle,
      challengeLevel: frontalLobeChallengeLevel,
      codeReviewStrictness: frontalLobeCodeReviewStrictness,
      explanationDepth: frontalLobeExplanationDepth,
      tone: frontalLobeTone,
      languagePreference: frontalLobeLanguagePreference,
      codingConfidence: frontalLobeCodingConfidence,
      codeInstructionStyle: frontalLobeCodeInstructionStyle,
      debuggingSupport: frontalLobeDebuggingSupport,
      preferredPace: frontalLobePreferredPace,
      customRules: [],
    },
    frontalLobeCustomRules,
  );
  const currentPassportProfile: FrontalLobeProfile = {
    mode: frontalLobeMode,
    defaultAnswerStyle: frontalLobeAnswerStyle,
    challengeLevel: frontalLobeChallengeLevel,
    codeReviewStrictness: frontalLobeCodeReviewStrictness,
    explanationDepth: frontalLobeExplanationDepth,
    tone: frontalLobeTone,
    languagePreference: frontalLobeLanguagePreference,
    codingConfidence: frontalLobeCodingConfidence,
    codeInstructionStyle: frontalLobeCodeInstructionStyle,
    debuggingSupport: frontalLobeDebuggingSupport,
    preferredPace: frontalLobePreferredPace,
    customRules: frontalLobeCustomRules
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  };
  const passportSummary = getMemephantPassportSummary(currentPassportProfile);

  const licensingDisabled = !vault.dataLicensingPreferences.allowLicensing;
  const entries = getVaultEntries(vault);
  const aiWorkingStylePrompt = buildAiWorkingStylePrompt(entries);
  const hasAiWorkingStylePrompt = aiWorkingStylePrompt.trim().length > 0;
  const personalContextPassport = buildPersonalContextPassport(entries, {
    includePreferences: passportIncludePreferences,
    includeRules: passportIncludeRules,
    includeBoundaries: passportIncludeBoundaries,
    includeAnswerStyle: passportIncludeAnswerStyle,
    includeGoals: passportIncludeGoals,
  });
  const memoryAuditItems: MemoryAuditItem[] = [
    {
      label: 'Total private memories',
      value: entries.length,
      detail: 'Saved local entries in this vault.',
    },
    {
      label: 'Preferences',
      value: countEntriesByCategory(vault, 'preference'),
      detail: 'Personal preferences you may manually reuse.',
    },
    {
      label: 'Goals',
      value: countEntriesByCategory(vault, 'goal'),
      detail: 'Long-term personal or work goals.',
    },
    {
      label: 'Rules',
      value: countEntriesByCategory(vault, 'rule'),
      detail: 'Instructions for how AI should work with you.',
    },
    {
      label: 'Boundaries',
      value: countEntriesByCategory(vault, 'boundary'),
      detail: 'Limits and privacy boundaries.',
    },
    {
      label: 'Never-share items',
      value: vault.neverShare.length,
      detail: 'Items marked as protected from sharing.',
    },
    {
      label: 'AI Working Style eligible',
      value: entries.filter(isWorkingStyleEntry).length,
      detail: 'Preference, rule, and boundary memories available for manual copy.',
    },
    {
      label: 'Consent ledger events',
      value: vault.consentLedger.length,
      detail: 'Local permission records saved on this device.',
    },
    {
      label: 'Automatically shared',
      value: 0,
      detail: 'Nothing in this vault is shared automatically.',
    },
  ];
  const consentAllowsUse =
    consentAction === 'consent_granted' || consentAction === 'permission_updated';
  const recentConsentEvents = [...vault.consentLedger].reverse().slice(0, 5);
  const sections: VaultSection[] = [
    {
      title: 'Owner Profile',
      description: 'Name, role, bio, or broad self-description you choose to store.',
      count: (hasOwnerProfile(vault) ? 1 : 0) + countEntriesByCategory(vault, 'owner_profile'),
    },
    {
      title: 'Preferences',
      description: 'Personal preferences you may later choose to share with an AI.',
      count: vault.preferences.length,
    },
    {
      title: 'Goals',
      description: 'Long-term personal, career, or creative goals.',
      count: vault.goals.length,
    },
    {
      title: 'Rules / Boundaries',
      description: 'Personal rules, boundaries, and AI collaboration limits.',
      count: vault.rules.length,
    },
    {
      title: 'Never Share',
      description: 'Things Memephant should never include in personal-memory exports.',
      count: vault.neverShare.length,
    },
    {
      title: 'Platform Permissions',
      description: 'Per-platform sharing permissions. Nothing is allowed by default.',
      count: getPermissionCount(vault),
    },
    {
      title: 'Licensing Preferences',
      description: 'Future consent and licensing preferences. Marketplace features are not enabled.',
      status: licensingDisabled ? 'Disabled' : 'Enabled',
    },
    {
      title: 'Consent Ledger',
      description: 'Append-only local receipts for manual permission decisions.',
      count: vault.consentLedger.length,
    },
  ];

  const handleClearVault = () => {
    clearPersonalMemoryVault();
    setVault(createDefaultPersonalMemoryVault());
    setConfirmClear(false);
    setEntryToDelete(null);
    setEditingEntryId(null);
    showToast('Personal Memory Vault cleared from this device');
  };

  const handleSaveEntry = () => {
    const title = entryTitle.trim();
    const content = entryContent.trim();

    if (!title || !content) {
      setFormError('Add a title and content before saving.');
      return;
    }

    const now = new Date().toISOString();
    const entry = createPersonalMemoryEntry(content, {
      label: title,
      category: entryCategory,
      sensitivity: 'private',
      updatedAt: now,
    });
    const nextVault = addEntryToVault(vault, entry);

    savePersonalMemoryVault(nextVault);
    setVault(nextVault);
    setEntryTitle('');
    setEntryContent('');
    setEntryCategory('preference');
    setFormError(null);
    setSelectedAnswerStyleId('');
    showToast('Private memory saved locally');
  };


  const applyStarterSuggestion = (suggestion: StarterSuggestion) => {
    setEntryTitle(suggestion.title);
    setEntryContent(suggestion.content);
    setEntryCategory(suggestion.category);
    setFormError(null);
  };

  const handleUseAnswerStylePreset = (preset: AnswerStylePreset) => {
    setEntryTitle(preset.title);
    setEntryContent(preset.content);
    setEntryCategory(preset.category);
    setFormError(null);
  };

  const handleDeleteEntry = () => {
    if (!entryToDelete) return;

    const nextVault = removeEntryFromVault(vault, entryToDelete.id);
    savePersonalMemoryVault(nextVault);
    setVault(nextVault);
    setEntryToDelete(null);
    showToast('Private memory deleted from this device');
  };

  const startEditingEntry = (entry: PersonalMemoryTextEntry) => {
    setEditingEntryId(entry.id);
    setEditTitle(entry.label ?? '');
    setEditContent(entry.value);
    setEditCategory(getEntryCategory(entry));
    setEditError(null);
  };

  const cancelEditingEntry = () => {
    setEditingEntryId(null);
    setEditTitle('');
    setEditContent('');
    setEditCategory('preference');
    setEditError(null);
  };

  const handleSaveEditedEntry = (entry: PersonalMemoryTextEntry) => {
    const title = editTitle.trim();
    const content = editContent.trim();

    if (!title || !content) {
      setEditError('Add a title and content before saving.');
      return;
    }

    const now = new Date().toISOString();
    const editedEntry: PersonalMemoryTextEntry = {
      ...entry,
      label: title,
      category: editCategory,
      value: content,
      sensitivity: 'private',
      updatedAt: now,
    };
    const nextVault = addEntryToVault(removeEntryFromVault(vault, entry.id), editedEntry);

    savePersonalMemoryVault(nextVault);
    setVault(nextVault);
    cancelEditingEntry();
    showToast('Private memory updated locally');
  };

  const resetConsentForm = () => {
    setConsentAction('consent_refused');
    setConsentScope('ai_training');
    setConsentPlatform('');
    setConsentTarget('');
    setConsentNotes('');
    setConsentCommercialUseAllowed(false);
    setConsentAiTrainingAllowed(false);
  };

  const handleRecordConsentEvent = () => {
    const event = createConsentLedgerEvent({
      action: consentAction,
      scope: consentScope,
      platform: consentPlatform,
      target: consentTarget,
      commercialUseAllowed: consentCommercialUseAllowed,
      aiTrainingAllowed: consentAiTrainingAllowed,
      notes: consentNotes,
    });
    const nextVault = appendConsentLedgerEvent(vault, event);

    savePersonalMemoryVault(nextVault);
    setVault(nextVault);
    resetConsentForm();
    showToast('Consent event recorded locally');
  };

  const handleCopyConsentReceipt = async () => {
    const receipt = generateConsentReceiptMarkdown(vault);
    setConsentReceiptPreview('');

    try {
      await navigator.clipboard.writeText(receipt);
      showToast('Consent receipt copied locally');
    } catch (err) {
      console.warn('[Memephant] Failed to copy consent receipt:', err);
      setConsentReceiptPreview(receipt);
      showToast('Could not copy automatically. Receipt preview shown below.');
    }
  };

  const handleCopyAiWorkingStyle = async () => {
    if (!hasAiWorkingStylePrompt) return;
    setWorkingStylePreview('');

    try {
      await navigator.clipboard.writeText(aiWorkingStylePrompt);
      showToast('AI working style copied');
    } catch (err) {
      console.warn('[Memephant] Failed to copy AI working style:', err);
      setWorkingStylePreview(aiWorkingStylePrompt);
      showToast('Could not copy automatically. Working style preview shown below.');
    }
  };

  const handleCopyPersonalContextPassport = async () => {
    try {
      await navigator.clipboard.writeText(personalContextPassport);
      showToast('Personal Memory Snapshot copied');
    } catch (err) {
      console.warn('[Memephant] Failed to copy Personal Memory Snapshot:', err);
      // Preview remains visible — no extra action needed
    }
  };

  const handleCopyPassportSummary = async () => {
    try {
      await navigator.clipboard.writeText(passportSummary.copyText);
      showToast('Passport summary copied');
    } catch (err) {
      console.warn('[Memephant] Failed to copy Passport summary:', err);
      showToast('Could not copy Passport summary.', 'error');
    }
  };

  const handleReviewPassport = () => {
    document.getElementById('memory-vault-frontal-lobe-section')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const handleSaveFrontalLobe = () => {
    const rules = frontalLobeCustomRules
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const now = new Date().toISOString();
    const profile: FrontalLobeProfile = {
      defaultAnswerStyle: frontalLobeAnswerStyle,
      challengeLevel: frontalLobeChallengeLevel,
      codeReviewStrictness: frontalLobeCodeReviewStrictness,
      explanationDepth: frontalLobeExplanationDepth,
      tone: frontalLobeTone,
      languagePreference: frontalLobeLanguagePreference,
      codingConfidence: frontalLobeCodingConfidence,
      codeInstructionStyle: frontalLobeCodeInstructionStyle,
      debuggingSupport: frontalLobeDebuggingSupport,
      preferredPace: frontalLobePreferredPace,
      mode: frontalLobeMode,
      customRules: rules,
      updatedAt: now,
    };

    const nextVault: PersonalMemoryVault = {
      ...vault,
      frontalLobeProfile: profile,
      updatedAt: now,
    };

    savePersonalMemoryVault(nextVault);
    setVault(nextVault);
    showToast('AI Working Style profile saved locally');
  };

  const handleResetFrontalLobe = () => {
    setFrontalLobeAnswerStyle(DEFAULT_FRONTAL_LOBE_PROFILE.defaultAnswerStyle);
    setFrontalLobeChallengeLevel(DEFAULT_FRONTAL_LOBE_PROFILE.challengeLevel);
    setFrontalLobeCodeReviewStrictness(DEFAULT_FRONTAL_LOBE_PROFILE.codeReviewStrictness);
    setFrontalLobeExplanationDepth(DEFAULT_FRONTAL_LOBE_PROFILE.explanationDepth);
    setFrontalLobeTone(DEFAULT_FRONTAL_LOBE_PROFILE.tone);
    setFrontalLobeLanguagePreference(DEFAULT_FRONTAL_LOBE_PROFILE.languagePreference);
    setFrontalLobeCodingConfidence(DEFAULT_FRONTAL_LOBE_PROFILE.codingConfidence);
    setFrontalLobeCodeInstructionStyle(DEFAULT_FRONTAL_LOBE_PROFILE.codeInstructionStyle);
    setFrontalLobeDebuggingSupport(DEFAULT_FRONTAL_LOBE_PROFILE.debuggingSupport);
    setFrontalLobePreferredPace(DEFAULT_FRONTAL_LOBE_PROFILE.preferredPace);
    setFrontalLobeMode(DEFAULT_FRONTAL_LOBE_PROFILE.mode);
    setFrontalLobeCustomRules('');
    showToast('AI Working Style profile reset to defaults');
  };

  // ── Wizard handlers ──────────────────────────────────────────────────────────

  const openWizard = () => {
    setWizardCodingConfidence(DEFAULT_FRONTAL_LOBE_PROFILE.codingConfidence);
    setWizardAnswerStyle(DEFAULT_FRONTAL_LOBE_PROFILE.defaultAnswerStyle);
    setWizardCodeInstruction(DEFAULT_FRONTAL_LOBE_PROFILE.codeInstructionStyle);
    setWizardSelectedRules([]);
    setWizardStep(1);
    setWizardOpen(true);
  };

  const closeWizard = () => {
    setWizardOpen(false);
  };

  const handleWizardSave = () => {
    const answerChoice = WIZARD_ANSWER_OPTIONS.find((o) => o.value === wizardAnswerStyle);
    const now = new Date().toISOString();
    const profile: FrontalLobeProfile = {
      ...DEFAULT_FRONTAL_LOBE_PROFILE,
      codingConfidence: wizardCodingConfidence,
      defaultAnswerStyle: wizardAnswerStyle,
      challengeLevel: answerChoice?.challengeLevel ?? DEFAULT_FRONTAL_LOBE_PROFILE.challengeLevel,
      codeReviewStrictness: answerChoice?.codeReviewStrictness ?? DEFAULT_FRONTAL_LOBE_PROFILE.codeReviewStrictness,
      tone: answerChoice?.tone ?? DEFAULT_FRONTAL_LOBE_PROFILE.tone,
      codeInstructionStyle: wizardCodeInstruction,
      customRules: wizardSelectedRules,
      updatedAt: now,
    };

    const nextVault: PersonalMemoryVault = {
      ...vault,
      frontalLobeProfile: profile,
      updatedAt: now,
    };

    savePersonalMemoryVault(nextVault);
    setVault(nextVault);

    // Sync the individual frontalLobe* state so the detailed section stays consistent.
    setFrontalLobeCodingConfidence(wizardCodingConfidence);
    setFrontalLobeAnswerStyle(wizardAnswerStyle);
    setFrontalLobeChallengeLevel(answerChoice?.challengeLevel ?? DEFAULT_FRONTAL_LOBE_PROFILE.challengeLevel);
    setFrontalLobeCodeReviewStrictness(answerChoice?.codeReviewStrictness ?? DEFAULT_FRONTAL_LOBE_PROFILE.codeReviewStrictness);
    setFrontalLobeTone(answerChoice?.tone ?? DEFAULT_FRONTAL_LOBE_PROFILE.tone);
    setFrontalLobeLanguagePreference(DEFAULT_FRONTAL_LOBE_PROFILE.languagePreference);
    setFrontalLobeCodeInstructionStyle(wizardCodeInstruction);
    setFrontalLobeCustomRules(wizardSelectedRules.join('\n'));

    closeWizard();
    showToast('Guided setup saved locally.');
  };

  const toggleWizardRule = (label: string) => {
    setWizardSelectedRules((prev) =>
      prev.includes(label) ? prev.filter((r) => r !== label) : [...prev, label],
    );
  };

  return (
    <div>
      <div className="memory-vault-hero">
        <div>
          <p className="memory-vault-eyebrow">User-owned memory</p>
          <h2 className="settings-section-title">Personal Memory Vault</h2>
          <p className="settings-section-subtitle">
            A local-first place for personal preferences, goals, boundaries, and never-share rules
            you want to own, inspect, edit, and carry on your terms.
          </p>
        </div>
        <div className="memory-vault-hero__status">
          <span>Private by default</span>
          <strong>{entries.length}</strong>
          <small>{entries.length === 1 ? 'saved memory' : 'saved memories'}</small>
        </div>
      </div>

      <div className="settings-trust-box">
        <div>Your Personal Memory Vault is separate from project-specific memory.</div>
        <div className="settings-trust-list">
          <div>- Stored locally in this browser/app only</div>
          <div>- Not synced to cloud</div>
          <div>- Not included in project exports or Memory Trails</div>
          <div>- Not included in project handoffs unless you explicitly choose that in a future feature</div>
          <div>- Not sent to any AI unless a future permission flow asks you first</div>
        </div>
      </div>

      <section className="memory-vault-ai-passport" aria-label="Memephant Passport">
        <div className="memory-vault-ai-passport__header">
          <div>
            <p className="memory-vault-ai-passport__eyebrow">Portable AI working identity</p>
            <h3>Memephant Passport</h3>
          </div>
          <span className="memory-vault-ai-passport__badge">
            AI Passport: {passportSummary.status}
          </span>
        </div>

        <div className="memory-vault-ai-passport__progress" aria-label="Passport completion">
          <div className="memory-vault-ai-passport__progress-row">
            <strong>Passport {passportSummary.completionPercentage}% complete</strong>
            <span>
              {passportSummary.completedItems}/{passportSummary.totalItems} signals set
            </span>
          </div>
          <progress
            className="memory-vault-ai-passport__progress-track"
            max={100}
            value={passportSummary.completionPercentage}
          >
            {passportSummary.completionPercentage}%
          </progress>
        </div>

        <div className="memory-vault-ai-passport__fingerprint">
          {passportSummary.fingerprint}
        </div>

        <div className="memory-vault-ai-passport__grid">
          <div>
            <span>Working style</span>
            <strong>{passportSummary.workingStyleSummary}</strong>
          </div>
          <div>
            <span>Language</span>
            <strong>{passportSummary.languagePreference}</strong>
          </div>
          <div>
            <span>Privacy</span>
            <strong>{passportSummary.privacyStatus}</strong>
          </div>
          <div>
            <span>Export readiness</span>
            <strong>{passportSummary.exportReadiness}</strong>
          </div>
        </div>

        {passportSummary.missingItems.length > 0 && (
          <p className="memory-vault-ai-passport__missing">
            Missing: {passportSummary.missingItems.join(', ')}
          </p>
        )}

        <div className="memory-vault-ai-passport__actions">
          <button
            className="setting-btn setting-btn--primary"
            type="button"
            onClick={openWizard}
          >
            Complete Passport
          </button>
          <button
            className="setting-btn"
            type="button"
            onClick={handleReviewPassport}
          >
            Review Passport
          </button>
          <button
            className="setting-btn"
            type="button"
            onClick={() => void handleCopyPassportSummary()}
          >
            Copy Passport Summary
          </button>
        </div>
      </section>

      <div className="mv-wizard-entry" aria-label="Memory Vault guided setup">
        <div className="mv-wizard-entry__text">
          <div className="mv-wizard-entry__title">Not sure where to start?</div>
          <div className="mv-wizard-entry__sub">
            Answer a few simple questions so AI knows how to help you.
          </div>
        </div>
        <button
          className="setting-btn setting-btn--primary"
          type="button"
          onClick={openWizard}
        >
          Start guided setup
        </button>
      </div>

      {entries.length === 0 && (
        <section className="memory-vault-empty-state" aria-label="Memory Vault empty state">
          <div>
            <h3>Start with one private memory</h3>
            <p>
              Add something durable about how you work with AI: a writing preference, a personal
              boundary, a long-term goal, or something that should never be shared. It stays local
              and does not enter project handoffs.
            </p>
          </div>
          <a className="memory-vault-empty-state__link" href="#memory-vault-add-private-memory">
            Add your first memory
          </a>
        </section>
      )}

      {entries.length === 0 && (
        <section
          className="memory-vault-suggestions"
          aria-label="Memory Vault starter suggestions"
        >
          <div className="memory-vault-suggestions__header">
            <h3>Try a starter memory</h3>
            <p>
              Pick one to prefill the form below. Nothing is saved until you click
              Save private memory.
            </p>
          </div>
          <div className="memory-vault-suggestions__grid">
            {STARTER_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                className="memory-vault-suggestion-card"
                onClick={() => applyStarterSuggestion(suggestion)}
              >
                <span className="memory-vault-suggestion-card__title">
                  {suggestion.title}
                </span>
                <span className="memory-vault-suggestion-card__category">
                  {getCategoryLabel(suggestion.category)}
                </span>
                <span className="memory-vault-suggestion-card__content">
                  {suggestion.content}
                </span>
              </button>
            ))}
          </div>
          <p className="memory-vault-suggestions__note">
            Suggestions only prefill the form. They are stored locally only when you
            click Save private memory.
          </p>
        </section>
      )}

      <div className="memory-vault-status-grid">
        <div className="memory-vault-status-card">
          <div className="memory-vault-status-label">Storage</div>
          <div className="memory-vault-status-value">Local only</div>
        </div>
        <div className="memory-vault-status-card">
          <div className="memory-vault-status-label">Sharing</div>
          <div className="memory-vault-status-value">Off by default</div>
        </div>
        <div className="memory-vault-status-card">
          <div className="memory-vault-status-label">Licensing</div>
          <div className="memory-vault-status-value">
            {licensingDisabled ? 'Disabled' : 'Enabled'}
          </div>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">Your data rights layer</div>
        <section className="memory-vault-rights-panel">
          <h3>Own first. Share later, only by choice.</h3>
          <p>
            This vault is designed as a user-controlled personal data layer. Nothing here is shared
            without explicit action. Future permission controls could let you decide which AI
            platforms may see specific categories, and future licensing controls could help you
            decide whether any personal data may be used commercially.
          </p>
          <p className="memory-vault-rights-panel__note">
            This is not legal advice and does not guarantee enforcement. These controls are product
            safeguards being prepared around consent, auditability, and portability.
          </p>
        </section>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">Consent and licensing preview</div>
        <div className="memory-vault-future-grid" aria-label="Future consent and licensing safeguards">
          {FUTURE_CONTROLS.map((control) => (
            <section
              className={`memory-vault-future-card${control.disabled ? ' memory-vault-future-card--disabled' : ''}`}
              key={control.label}
            >
              <div className="memory-vault-future-card__header">
                <h3>{control.label}</h3>
                <span className="setting-badge">{control.value}</span>
              </div>
              <p>{control.detail}</p>
              <small>{control.disabled ? 'Informational only - not active' : 'Active local safeguard'}</small>
            </section>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">Consent Ledger</div>
        <section className="memory-vault-consent-panel">
          <div className="memory-vault-consent-panel__intro">
            <div>
              <h3>Local permission receipts</h3>
              <p>
                Local record of permission decisions. This is not legal advice or automatic
                enforcement. Events are append-only; revocation creates a new event instead of
                editing the original.
              </p>
            </div>
            <span className="setting-badge">
              {vault.consentLedger.length} {vault.consentLedger.length === 1 ? 'event' : 'events'}
            </span>
          </div>

          <div className="memory-vault-consent-export">
            <div>
              <h3>Consent receipt</h3>
              <p>
                Copy a Markdown receipt of local permission state and ledger history. Private
                memory contents are not included.
              </p>
            </div>
            <button
              className="setting-btn setting-btn--primary"
              onClick={handleCopyConsentReceipt}
              type="button"
            >
              Copy consent receipt
            </button>
          </div>

          {consentReceiptPreview && (
            <label className="memory-vault-field">
              <span>Consent receipt preview</span>
              <textarea
                className="memory-vault-input memory-vault-textarea memory-vault-receipt-preview"
                readOnly
                value={consentReceiptPreview}
              />
            </label>
          )}

          <div className="memory-vault-consent-form">
            <label className="memory-vault-field">
              <span>Action</span>
              <select
                className="memory-vault-input"
                value={consentAction}
                onChange={(event) => {
                  const nextAction = event.target.value as ConsentLedgerAction;
                  setConsentAction(nextAction);
                  if (nextAction === 'consent_refused' || nextAction === 'consent_revoked') {
                    setConsentCommercialUseAllowed(false);
                    setConsentAiTrainingAllowed(false);
                  }
                }}
              >
                {CONSENT_ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="memory-vault-field">
              <span>Scope</span>
              <select
                className="memory-vault-input"
                value={consentScope}
                onChange={(event) => setConsentScope(event.target.value as ConsentLedgerScope)}
              >
                {CONSENT_SCOPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="memory-vault-field">
              <span>Platform optional</span>
              <input
                className="memory-vault-input"
                value={consentPlatform}
                onChange={(event) => setConsentPlatform(event.target.value)}
                placeholder="Example: ChatGPT"
              />
            </label>

            <label className="memory-vault-field">
              <span>Target optional</span>
              <input
                className="memory-vault-input"
                value={consentTarget}
                onChange={(event) => setConsentTarget(event.target.value)}
                placeholder="Example: preferences"
              />
            </label>

            <label className="memory-vault-field memory-vault-field--full">
              <span>Notes optional</span>
              <textarea
                className="memory-vault-input memory-vault-textarea"
                value={consentNotes}
                onChange={(event) => setConsentNotes(event.target.value)}
                placeholder="Add a short note about what was allowed, refused, or revoked."
              />
            </label>

            <div className="memory-vault-consent-checks">
              <label>
                <input
                  type="checkbox"
                  checked={consentCommercialUseAllowed}
                  disabled={!consentAllowsUse}
                  onChange={(event) => setConsentCommercialUseAllowed(event.target.checked)}
                />
                Commercial use allowed
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={consentAiTrainingAllowed}
                  disabled={!consentAllowsUse}
                  onChange={(event) => setConsentAiTrainingAllowed(event.target.checked)}
                />
                AI training allowed
              </label>
            </div>

            {!consentAllowsUse && (
              <p className="memory-vault-form-note">
                Refused and revoked events keep AI training and commercial use off.
              </p>
            )}

            <button
              className="setting-btn setting-btn--primary"
              onClick={handleRecordConsentEvent}
              type="button"
            >
              Record consent event
            </button>
          </div>

          <div className="memory-vault-consent-events">
            {recentConsentEvents.length > 0 ? (
              recentConsentEvents.map((event) => (
                <article className="memory-vault-consent-event" key={event.id}>
                  <div className="memory-vault-consent-event__header">
                    <div>
                      <h3>{getConsentActionLabel(event.action)}</h3>
                      <div className="memory-vault-entry-meta">
                        {getConsentScopeLabel(event.scope)} - {getConsentStatus(event.action, event.allowed)}
                      </div>
                    </div>
                    <time dateTime={event.createdAt}>
                      {new Date(event.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <p>{event.receiptText}</p>
                </article>
              ))
            ) : (
              <p className="memory-vault-empty">
                No consent events recorded yet.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">Vault sections</div>
        <div className="memory-vault-grid">
          {sections.map((section) => (
            <section className="memory-vault-card" key={section.title}>
              <div className="memory-vault-card-header">
                <h3>{section.title}</h3>
                <span className="setting-badge">
                  {sectionStatus(section.count, section.status)}
                </span>
              </div>
              <p>{section.description}</p>
            </section>
          ))}
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title" id="memory-vault-add-private-memory">
          Add private memory
        </div>
        <div className="memory-vault-form">
          <p className="memory-vault-form-note">
            Private by default. Not included in project exports or AI handoffs.
          </p>

          <label className="memory-vault-field">
            <span>Title</span>
            <input
              className="memory-vault-input"
              value={entryTitle}
              onChange={(event) => {
                setEntryTitle(event.target.value);
                setFormError(null);
              }}
              placeholder="Example: Collaboration preference"
            />
          </label>

          <label className="memory-vault-field">
            <span>Category</span>
            <select
              className="memory-vault-input"
              value={entryCategory}
              onChange={(event) => setEntryCategory(event.target.value as PersonalMemoryEntryCategory)}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="memory-vault-field memory-vault-field--full">
            <span>Content</span>
            <textarea
              className="memory-vault-input memory-vault-textarea"
              value={entryContent}
              onChange={(event) => {
                setEntryContent(event.target.value);
                setFormError(null);
              }}
              placeholder="Write a private memory you want to keep under your control."
            />
          </label>

          {formError && <p className="memory-vault-form-error">{formError}</p>}

          <button
            className="setting-btn setting-btn--primary"
            onClick={handleSaveEntry}
            type="button"
          >
            Save private memory
          </button>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">AI Answer Style</div>
        <div className="memory-vault-answer-style">
          <div className="memory-vault-answer-style__hero">
            <div className="memory-vault-answer-style__badge">
              Portable AI identity
            </div>

            <h3 className="memory-vault-answer-style__title">
              Teach AI how to work with you once.
            </h3>

            <p className="memory-vault-answer-style__description">
              Memephant remembers your working style locally, so you do not have to retrain every AI from scratch.
            </p>

            <p className="memory-vault-answer-style__description">
              Your preferences, workflows, and AI collaboration style become private memories you control — a user-owned context layer that stays with you across tools.
            </p>

            <div className="memory-vault-answer-style__privacy">
              Stored privately on your device. Included in exports only when you choose.
            </div>
          </div>

          <label className="memory-vault-field">
            <span>Choose how AIs should help you</span>
            <select
              aria-label="Answer style preset"
              className="memory-vault-input"
              value={selectedAnswerStyleId}
              onChange={(event) => {
                const id = event.target.value;
                setSelectedAnswerStyleId(id);
                const preset = AI_ANSWER_STYLE_PRESETS.find((p) => p.id === id);
                if (preset) {
                  handleUseAnswerStylePreset(preset);
                }
              }}
            >
              <option value="">Choose a style...</option>
              {AI_ANSWER_STYLE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.title}
                </option>
              ))}
            </select>
          </label>

          {selectedAnswerStyleId && (() => {
            const selected = AI_ANSWER_STYLE_PRESETS.find((p) => p.id === selectedAnswerStyleId);
            return selected ? (
              <div className="memory-vault-answer-style-preview">
                <p className="memory-vault-answer-style-preview__subtitle">{selected.subtitle}</p>
                <p className="memory-vault-answer-style-preview__content">{selected.content}</p>
              </div>
            ) : null;
          })()}
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">AI Working Style</div>
        <section className="memory-vault-working-style">
          <div className="memory-vault-working-style__intro">
            <div>
              <h3>Copy your AI working style</h3>
              <p>
                Generate a manual prompt from preference, rule, and boundary memories.
                This does not change project exports, Memory Trails, Memory Bridge, or cloud sync.
              </p>
            </div>
            <button
              className="setting-btn setting-btn--primary"
              disabled={!hasAiWorkingStylePrompt}
              onClick={handleCopyAiWorkingStyle}
              type="button"
            >
              Copy AI working style
            </button>
          </div>
          {hasAiWorkingStylePrompt ? (
            <label className="memory-vault-field">
              <span>AI working style preview</span>
              <textarea
                className="memory-vault-input memory-vault-textarea memory-vault-working-style-preview"
                readOnly
                value={workingStylePreview || aiWorkingStylePrompt}
              />
            </label>
          ) : (
            <p className="memory-vault-empty">
              Add preference, rule, or boundary memories to generate a working-style prompt.
            </p>
          )}
        </section>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">Personal Memory Snapshot</div>
        <section className="memory-vault-passport" aria-label="Personal Memory Snapshot section">
          <div className="memory-vault-passport__intro">
            <h3>Copy personal AI instructions</h3>
            <p>
              Create a portable instruction prompt from the personal memories you choose. This is
              separate from project Memory Trail and project exports. Nothing is shared until
              you copy it.
            </p>
          </div>

          <div className="memory-vault-passport-checks">
            <label>
              <input
                type="checkbox"
                checked={passportIncludePreferences}
                onChange={(event) => setPassportIncludePreferences(event.target.checked)}
              />
              Preferences
            </label>
            <label>
              <input
                type="checkbox"
                checked={passportIncludeRules}
                onChange={(event) => setPassportIncludeRules(event.target.checked)}
              />
              Rules
            </label>
            <label>
              <input
                type="checkbox"
                checked={passportIncludeBoundaries}
                onChange={(event) => setPassportIncludeBoundaries(event.target.checked)}
              />
              Boundaries
            </label>
            <label>
              <input
                type="checkbox"
                checked={passportIncludeAnswerStyle}
                onChange={(event) => setPassportIncludeAnswerStyle(event.target.checked)}
              />
              AI Answer Style
            </label>
            <label>
              <input
                type="checkbox"
                checked={passportIncludeGoals}
                onChange={(event) => setPassportIncludeGoals(event.target.checked)}
              />
              Goals optional
            </label>
            <span className="memory-vault-passport-exclusion">Never-share items excluded</span>
          </div>

          <label className="memory-vault-field">
            <span>Personal Memory Snapshot preview</span>
            <textarea
              aria-label="Personal Memory Snapshot preview"
              className="memory-vault-input memory-vault-textarea memory-vault-passport-preview"
              readOnly
              value={personalContextPassport}
            />
          </label>

          <button
            className="setting-btn setting-btn--primary"
            onClick={handleCopyPersonalContextPassport}
            type="button"
          >
            Copy Personal Memory Snapshot
          </button>
        </section>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">Frontal Lobe</div>
        <section
          id="memory-vault-frontal-lobe-section"
          className="memory-vault-frontal-lobe"
          aria-label="Frontal Lobe AI Working Style section"
        >
          <div className="memory-vault-frontal-lobe__intro">
            <h3>AI Working Style</h3>
            <p>
              Your AI Working Style profile. Define how AI should work with you — directness,
              challenge level, coding support, explanation depth, and tone. This stays local and is
              not included in project exports or AI handoffs unless you explicitly choose to share
              it in a future step.
            </p>
          </div>

          <div className="memory-vault-frontal-lobe__group-label">AI Working Style Defaults</div>
          <div className="memory-vault-frontal-lobe__controls">
            <label className="memory-vault-field">
              <span>When to include your Working Style in AI handoffs</span>
              <select
                aria-label="AI Working Style default inclusion mode"
                value={frontalLobeMode}
                onChange={(e) => setFrontalLobeMode(e.target.value as FrontalLobeMode)}
              >
                {FRONTAL_LOBE_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <span className="memory-vault-field-hint">
                This controls future handoff behaviour. It does not send anything automatically yet.
              </span>
            </label>
          </div>

                    <div className="memory-vault-frontal-lobe__group-label">AI Working Style</div>
          <div className="memory-vault-frontal-lobe__controls">
            <label className="memory-vault-field">
              <span>Default answer style</span>
              <select
                aria-label="Default answer style"
                className="memory-vault-input"
                value={frontalLobeAnswerStyle}
                onChange={(event) => setFrontalLobeAnswerStyle(event.target.value as FrontalLobeAnswerStyle)}
              >
                {FRONTAL_LOBE_ANSWER_STYLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="memory-vault-field">
              <span>Challenge level</span>
              <select
                aria-label="Challenge level"
                className="memory-vault-input"
                value={frontalLobeChallengeLevel}
                onChange={(event) => setFrontalLobeChallengeLevel(event.target.value as FrontalLobeChallengeLevel)}
              >
                {FRONTAL_LOBE_CHALLENGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="memory-vault-field">
              <span>Code review strictness</span>
              <select
                aria-label="Code review strictness"
                className="memory-vault-input"
                value={frontalLobeCodeReviewStrictness}
                onChange={(event) => setFrontalLobeCodeReviewStrictness(event.target.value as FrontalLobeCodeReviewStrictness)}
              >
                {FRONTAL_LOBE_STRICTNESS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="memory-vault-field">
              <span>Explanation depth</span>
              <select
                aria-label="Explanation depth"
                className="memory-vault-input"
                value={frontalLobeExplanationDepth}
                onChange={(event) => setFrontalLobeExplanationDepth(event.target.value as FrontalLobeExplanationDepth)}
              >
                {FRONTAL_LOBE_DEPTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="memory-vault-field">
              <span>Tone</span>
              <select
                aria-label="Tone"
                className="memory-vault-input"
                value={frontalLobeTone}
                onChange={(event) => setFrontalLobeTone(event.target.value as FrontalLobeTone)}
              >
                {FRONTAL_LOBE_TONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="memory-vault-field">
              <span>Language preference</span>
              <select
                aria-label="Language preference"
                className="memory-vault-input"
                value={frontalLobeLanguagePreference}
                onChange={(event) =>
                  setFrontalLobeLanguagePreference(event.target.value as FrontalLobeLanguagePreference)}
              >
                {FRONTAL_LOBE_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="memory-vault-frontal-lobe__group-label">Builder Skill Profile</div>
          <div className="memory-vault-frontal-lobe__controls">
            <label className="memory-vault-field memory-vault-field--full">
              <span>Coding confidence</span>
              <select
                aria-label="Coding confidence"
                className="memory-vault-input"
                value={frontalLobeCodingConfidence}
                onChange={(event) => setFrontalLobeCodingConfidence(event.target.value as FrontalLobeCodingConfidence)}
              >
                {FRONTAL_LOBE_CODING_CONFIDENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="memory-vault-field memory-vault-field--full">
              <span>Code instruction style</span>
              <select
                aria-label="Code instruction style"
                className="memory-vault-input"
                value={frontalLobeCodeInstructionStyle}
                onChange={(event) => setFrontalLobeCodeInstructionStyle(event.target.value as FrontalLobeCodeInstructionStyle)}
              >
                {FRONTAL_LOBE_CODE_INSTRUCTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="memory-vault-field memory-vault-field--full">
              <span>Debugging support</span>
              <select
                aria-label="Debugging support"
                className="memory-vault-input"
                value={frontalLobeDebuggingSupport}
                onChange={(event) => setFrontalLobeDebuggingSupport(event.target.value as FrontalLobeDebuggingSupport)}
              >
                {FRONTAL_LOBE_DEBUGGING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="memory-vault-field memory-vault-field--full">
              <span>Preferred pace</span>
              <select
                aria-label="Preferred pace"
                className="memory-vault-input"
                value={frontalLobePreferredPace}
                onChange={(event) => setFrontalLobePreferredPace(event.target.value as FrontalLobePreferredPace)}
              >
                {FRONTAL_LOBE_PACE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="memory-vault-frontal-lobe__group-label">Custom Working Rules</div>
          <label className="memory-vault-field">
            <span>Custom working rules</span>
            <textarea
              aria-label="Custom working rules"
              className="memory-vault-input memory-vault-textarea"
              value={frontalLobeCustomRules}
              onChange={(event) => setFrontalLobeCustomRules(event.target.value)}
              placeholder="One rule per line."
            />
          </label>

          <label className="memory-vault-field">
            <span>Frontal Lobe preview</span>
            <textarea
              aria-label="Frontal Lobe preview"
              className="memory-vault-input memory-vault-textarea memory-vault-frontal-lobe-preview"
              readOnly
              value={frontalLobePreview}
            />
          </label>

          <div className="memory-vault-frontal-lobe__actions">
            <button
              className="setting-btn setting-btn--primary"
              onClick={handleSaveFrontalLobe}
              type="button"
            >
              Save Frontal Lobe profile
            </button>
            <button
              className="setting-btn"
              onClick={handleResetFrontalLobe}
              type="button"
            >
              Reset Frontal Lobe profile
            </button>
          </div>
        </section>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">Memory Audit</div>
        <section className="memory-vault-audit" aria-label="Personal Memory Vault audit">
          <div className="memory-vault-audit__intro">
            <h3>What Memephant knows locally</h3>
            <p>
              Review what is stored locally in your Personal Memory Vault. Nothing here is shared
              automatically.
            </p>
          </div>
          <div className="memory-vault-audit-grid">
            {memoryAuditItems.map((item) => (
              <article className="memory-vault-audit-card" key={item.label}>
                <div className="memory-vault-audit-card__value">{item.value}</div>
                <h4>{item.label}</h4>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
          <p className="memory-vault-form-note">
            Manual copy actions only happen when you click them. Project exports, Memory Trails,
            Memory Bridge, cloud sync, and Supabase do not receive Vault contents from this audit.
          </p>
        </section>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">Saved private memories</div>
        {entries.length > 0 ? (
          <div className="memory-vault-entry-list">
            {entries.map((entry) => (
              <article className="memory-vault-entry" key={entry.id}>
                {editingEntryId === entry.id ? (
                  <div className="memory-vault-edit-form">
                    <label className="memory-vault-field">
                      <span>Edit title</span>
                      <input
                        className="memory-vault-input"
                        value={editTitle}
                        onChange={(event) => {
                          setEditTitle(event.target.value);
                          setEditError(null);
                        }}
                      />
                    </label>

                    <label className="memory-vault-field">
                      <span>Edit category</span>
                      <select
                        className="memory-vault-input"
                        value={editCategory}
                        onChange={(event) =>
                          setEditCategory(event.target.value as PersonalMemoryEntryCategory)}
                      >
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="memory-vault-field memory-vault-field--full">
                      <span>Edit content</span>
                      <textarea
                        className="memory-vault-input memory-vault-textarea"
                        value={editContent}
                        onChange={(event) => {
                          setEditContent(event.target.value);
                          setEditError(null);
                        }}
                      />
                    </label>

                    {editError && <p className="memory-vault-form-error">{editError}</p>}

                    <div className="memory-vault-entry-actions">
                      <button
                        className="setting-btn setting-btn--primary"
                        onClick={() => handleSaveEditedEntry(entry)}
                        type="button"
                      >
                        Save changes
                      </button>
                      <button
                        className="setting-btn"
                        onClick={cancelEditingEntry}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="memory-vault-entry-header">
                      <div>
                        <h3>{entry.label || 'Untitled private memory'}</h3>
                        <div className="memory-vault-entry-meta">
                          {getCategoryLabel(getEntryCategory(entry))} - Private - Local only
                        </div>
                      </div>
                      <div className="memory-vault-entry-actions">
                        <button
                          className="setting-btn"
                          onClick={() => startEditingEntry(entry)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="setting-btn setting-btn--danger"
                          onClick={() => setEntryToDelete(entry)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p>{entry.value}</p>
                  </>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="memory-vault-empty">
            No private memories saved yet.
          </p>
        )}
      </div>

      <div className="settings-group">
        <div className="settings-group-title">Vault controls</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">Clear Vault</div>
            <div className="setting-description">
              Remove the local Personal Memory Vault shell from this device. Project memories are not affected.
            </div>
          </div>
          <button
            className="setting-btn setting-btn--danger"
            onClick={() => setConfirmClear(true)}
            type="button"
          >
            Clear Vault
          </button>
        </div>
      </div>

      {confirmClear && (
        <ConfirmDialog
          title="Clear Personal Memory Vault?"
          message="This clears only the local Personal Memory Vault on this device. Project memory, exports, and cloud backup are not changed."
          confirmLabel="Clear Vault"
          onConfirm={handleClearVault}
          onCancel={() => setConfirmClear(false)}
          dangerous
        />
      )}

      {entryToDelete && (
        <ConfirmDialog
          title="Delete private memory?"
          message="This removes only this local Personal Memory Vault entry. Project memory, exports, and cloud backup are not changed."
          confirmLabel="Delete Memory"
          onConfirm={handleDeleteEntry}
          onCancel={() => setEntryToDelete(null)}
          dangerous
        />
      )}

      {wizardOpen && (
        <div
          className="mv-wizard-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Memory Vault Setup Wizard"
        >
          <div className="mv-wizard-panel">
            {/* Header */}
            <div className="mv-wizard-header">
              <div className="mv-wizard-progress">
                {wizardStep === 'review'
                  ? 'Review your setup'
                  : `Step ${wizardStep} of 4`}
              </div>
              <button
                className="mv-wizard-close"
                type="button"
                aria-label="Cancel guided setup"
                onClick={closeWizard}
              >
                ×
              </button>
            </div>

            {/* ── Step 1: Coding confidence ── */}
            {wizardStep === 1 && (
              <div className="mv-wizard-step" aria-label="Wizard step 1">
                <h3 className="mv-wizard-question">How much coding help do you need?</h3>
                <p className="mv-wizard-hint">This helps AI give you instructions at the right level.</p>
                <div className="mv-wizard-options">
                  {WIZARD_CODING_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`mv-wizard-option${wizardCodingConfidence === opt.value ? ' is-selected' : ''}`}
                      onClick={() => setWizardCodingConfidence(opt.value)}
                    >
                      <strong>{opt.label}</strong>
                      <small>{opt.sub}</small>
                    </button>
                  ))}
                </div>
                <div className="mv-wizard-nav">
                  <button className="setting-btn" type="button" onClick={closeWizard}>
                    Cancel
                  </button>
                  <button
                    className="setting-btn setting-btn--primary"
                    type="button"
                    onClick={() => setWizardStep(2)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: Answer style ── */}
            {wizardStep === 2 && (
              <div className="mv-wizard-step" aria-label="Wizard step 2">
                <h3 className="mv-wizard-question">How should AI answer you?</h3>
                <p className="mv-wizard-hint">Pick the style that feels right for how you like to work.</p>
                <div className="mv-wizard-options">
                  {WIZARD_ANSWER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`mv-wizard-option${wizardAnswerStyle === opt.value ? ' is-selected' : ''}`}
                      onClick={() => setWizardAnswerStyle(opt.value)}
                    >
                      <strong>{opt.label}</strong>
                      <small>{opt.sub}</small>
                    </button>
                  ))}
                </div>
                <div className="mv-wizard-nav">
                  <button className="setting-btn" type="button" onClick={() => setWizardStep(1)}>
                    Back
                  </button>
                  <button
                    className="setting-btn setting-btn--primary"
                    type="button"
                    onClick={() => setWizardStep(3)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: Code instruction style ── */}
            {wizardStep === 3 && (
              <div className="mv-wizard-step" aria-label="Wizard step 3">
                <h3 className="mv-wizard-question">When AI gives you code, what helps most?</h3>
                <p className="mv-wizard-hint">Choose how you want code changes delivered to you.</p>
                <div className="mv-wizard-options">
                  {WIZARD_CODE_INSTRUCTION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`mv-wizard-option${wizardCodeInstruction === opt.value ? ' is-selected' : ''}`}
                      onClick={() => setWizardCodeInstruction(opt.value)}
                    >
                      <strong>{opt.label}</strong>
                      <small>{opt.sub}</small>
                    </button>
                  ))}
                </div>
                <div className="mv-wizard-nav">
                  <button className="setting-btn" type="button" onClick={() => setWizardStep(2)}>
                    Back
                  </button>
                  <button
                    className="setting-btn setting-btn--primary"
                    type="button"
                    onClick={() => setWizardStep(4)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 4: Rules (multi-select) ── */}
            {wizardStep === 4 && (
              <div className="mv-wizard-step" aria-label="Wizard step 4">
                <h3 className="mv-wizard-question">Pick rules you want AI to follow.</h3>
                <p className="mv-wizard-hint">Select any that apply. You can change these later.</p>
                <div className="mv-wizard-options">
                  {WIZARD_RULE_OPTIONS.map((rule) => {
                    const selected = wizardSelectedRules.includes(rule.label);
                    return (
                      <button
                        key={rule.id}
                        type="button"
                        className={`mv-wizard-option mv-wizard-option--rule${selected ? ' is-selected' : ''}`}
                        aria-pressed={selected}
                        onClick={() => toggleWizardRule(rule.label)}
                      >
                        <span className="mv-wizard-option__check">{selected ? '✓' : ''}</span>
                        <strong>{rule.label}</strong>
                      </button>
                    );
                  })}
                </div>
                <div className="mv-wizard-nav">
                  <button className="setting-btn" type="button" onClick={() => setWizardStep(3)}>
                    Back
                  </button>
                  <button
                    className="setting-btn setting-btn--primary"
                    type="button"
                    onClick={() => setWizardStep('review')}
                  >
                    Review my setup
                  </button>
                </div>
              </div>
            )}

            {/* ── Review screen ── */}
            {wizardStep === 'review' && (
              <div className="mv-wizard-step" aria-label="Wizard review screen">
                <h3 className="mv-wizard-question">Here is your AI Working Style.</h3>
                <p className="mv-wizard-hint mv-wizard-hint--privacy">
                  Saved locally on this device only. Not synced to cloud, not included in project exports.
                </p>
                <div className="mv-wizard-review" aria-label="Guided setup summary">
                  <div className="mv-wizard-review__row">
                    <span className="mv-wizard-review__label">Coding experience</span>
                    <span className="mv-wizard-review__value">
                      {WIZARD_CODING_OPTIONS.find((o) => o.value === wizardCodingConfidence)?.label ?? wizardCodingConfidence}
                    </span>
                  </div>
                  <div className="mv-wizard-review__row">
                    <span className="mv-wizard-review__label">Answer style</span>
                    <span className="mv-wizard-review__value">
                      {WIZARD_ANSWER_OPTIONS.find((o) => o.value === wizardAnswerStyle)?.label ?? wizardAnswerStyle}
                    </span>
                  </div>
                  <div className="mv-wizard-review__row">
                    <span className="mv-wizard-review__label">Code delivery</span>
                    <span className="mv-wizard-review__value">
                      {WIZARD_CODE_INSTRUCTION_OPTIONS.find((o) => o.value === wizardCodeInstruction)?.label ?? wizardCodeInstruction}
                    </span>
                  </div>
                  <div className="mv-wizard-review__row">
                    <span className="mv-wizard-review__label">Rules</span>
                    <span className="mv-wizard-review__value">
                      {wizardSelectedRules.length === 0
                        ? 'None selected'
                        : wizardSelectedRules.join(', ')}
                    </span>
                  </div>
                  <div className="mv-wizard-review__row mv-wizard-review__row--boundary">
                    <span className="mv-wizard-review__label">Export boundary</span>
                    <span className="mv-wizard-review__value">
                      This AI Working Style profile stays local. It is not included in project exports or AI handoffs unless you choose to share it.
                    </span>
                  </div>
                </div>
                <div className="mv-wizard-nav">
                  <button className="setting-btn" type="button" onClick={() => setWizardStep(4)}>
                    Back
                  </button>
                  <button
                    className="setting-btn setting-btn--primary"
                    type="button"
                    onClick={handleWizardSave}
                  >
                    Save my AI setup
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsMemoryVault;
