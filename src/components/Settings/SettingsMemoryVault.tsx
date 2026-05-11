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
  type ConsentLedgerAction,
  type ConsentLedgerScope,
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

  const licensingDisabled = !vault.dataLicensingPreferences.allowLicensing;
  const entries = getVaultEntries(vault);
  const aiWorkingStylePrompt = buildAiWorkingStylePrompt(entries);
  const hasAiWorkingStylePrompt = aiWorkingStylePrompt.trim().length > 0;
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
    showToast('Private memory saved locally');
  };


  const applyStarterSuggestion = (suggestion: StarterSuggestion) => {
    setEntryTitle(suggestion.title);
    setEntryContent(suggestion.content);
    setEntryCategory(suggestion.category);
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
    </div>
  );
}

export default SettingsMemoryVault;
