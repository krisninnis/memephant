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
  type ConsentLedgerAction,
  type ConsentLedgerScope,
  type FrontalLobeAnswerStyle,
  type FrontalLobeChallengeLevel,
  type FrontalLobeCodeReviewStrictness,
  type FrontalLobeExplanationDepth,
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
      'Do not include personal memory in project exports, Context Passports, or AI handoffs unless I explicitly choose to share it.',
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
    `## Answer Style\n${getLabel(FRONTAL_LOBE_ANSWER_STYLE_OPTIONS, profile.defaultAnswerStyle)}`,
    `## Challenge Level\n${getLabel(FRONTAL_LOBE_CHALLENGE_OPTIONS, profile.challengeLevel)}`,
    `## Code Review Strictness\n${getLabel(FRONTAL_LOBE_STRICTNESS_OPTIONS, profile.codeReviewStrictness)}`,
    `## Explanation Depth\n${getLabel(FRONTAL_LOBE_DEPTH_OPTIONS, profile.explanationDepth)}`,
    `## Tone\n${getLabel(FRONTAL_LOBE_TONE_OPTIONS, profile.tone)}`,
  ];

  if (rules.length > 0) {
    parts.push(`## Custom Working Rules\n${rules.map((r) => `- ${r}`).join('\n')}`);
  }

  parts.push(
    '## Privacy Boundary\n' +
      'This Frontal Lobe profile is stored locally in Memephant. Do not include it in project exports, ' +
      'Context Passports, Memory Bridge, AI handoffs, cloud sync, or external systems unless I explicitly choose to share it.',
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
    '# Personal Context Passport',
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
      'Never include private Vault contents in project exports, Context Passports, Memory Bridge, AI handoffs, ' +
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
  // Frontal Lobe / AI Working Style profile — initialized from saved vault
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
  const [frontalLobeCustomRules, setFrontalLobeCustomRules] = useState<string>(
    () => (vault.frontalLobeProfile?.customRules ?? []).join('\n'),
  );

  const frontalLobePreview = buildFrontalLobePreview(
    {
      defaultAnswerStyle: frontalLobeAnswerStyle,
      challengeLevel: frontalLobeChallengeLevel,
      codeReviewStrictness: frontalLobeCodeReviewStrictness,
      explanationDepth: frontalLobeExplanationDepth,
      tone: frontalLobeTone,
      customRules: [],
    },
    frontalLobeCustomRules,
  );

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
      showToast('Personal Context Passport copied');
    } catch (err) {
      console.warn('[Memephant] Failed to copy Personal Context Passport:', err);
      // Preview remains visible — no extra action needed
    }
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
    setFrontalLobeCustomRules('');
    showToast('AI Working Style profile reset to defaults');
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
          <div>- Not included in project exports or Context Passports</div>
          <div>- Not included in project handoffs unless you explicitly choose that in a future feature</div>
          <div>- Not sent to any AI unless a future permission flow asks you first</div>
        </div>
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
          <p className="memory-vault-answer-style__intro">
            Pick a style preset to prefill the form below. Presets become private memories you
            control — they never change project exports or AI handoffs.
          </p>
          <label className="memory-vault-field">
            <span>Answer style preset</span>
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
                This does not change project exports, Context Passports, Memory Bridge, or cloud sync.
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
        <div className="settings-group-title">Personal Context Passport</div>
        <section className="memory-vault-passport" aria-label="Personal Context Passport section">
          <div className="memory-vault-passport__intro">
            <h3>Copy personal AI instructions</h3>
            <p>
              Create a portable instruction prompt from the personal memories you choose. This is
              separate from project Context Passport and project exports. Nothing is shared until
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
            <span>Personal Context Passport preview</span>
            <textarea
              aria-label="Personal Context Passport preview"
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
            Copy Personal Context Passport
          </button>
        </section>
      </div>

      <div className="settings-group">
        <div className="settings-group-title">Frontal Lobe</div>
        <section className="memory-vault-frontal-lobe" aria-label="Frontal Lobe AI Working Style section">
          <div className="memory-vault-frontal-lobe__intro">
            <h3>AI Working Style</h3>
            <p>
              Define how AI should work with you — directness, challenge level, code-review
              strictness, explanation depth, and tone. This stays local and is not included in
              project exports or AI handoffs unless you explicitly choose to share it in a future
              step.
            </p>
          </div>

          <div className="memory-vault-frontal-lobe__controls">
            <label className="memory-vault-field">
              <span>Default an