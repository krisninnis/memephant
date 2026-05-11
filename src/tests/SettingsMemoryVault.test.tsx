import { fireEvent, render, screen, within } from '@testing-library/react';
import SettingsMemoryVault from '../components/Settings/SettingsMemoryVault';
import {
  createConsentLedgerEvent,
  createDefaultPersonalMemoryVault,
  createPersonalMemoryEntry,
} from '../types/personalMemoryVault';
import {
  PERSONAL_MEMORY_VAULT_STORAGE_KEY,
  savePersonalMemoryVault,
} from '../services/personalMemoryVaultStorage';

jest.mock('../components/Shared/ConfirmDialog', () => {
  type MockConfirmDialogProps = {
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
  };

  function MockConfirmDialog({
    title,
    message,
    confirmLabel = 'Confirm',
    onConfirm,
    onCancel,
  }: MockConfirmDialogProps) {
    return (
      <div role="dialog" aria-label={title}>
        <h3>{title}</h3>
        <p>{message}</p>
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onConfirm}>{confirmLabel}</button>
      </div>
    );
  }

  return {
    __esModule: true,
    default: MockConfirmDialog,
    ConfirmDialog: MockConfirmDialog,
  };
});

describe('SettingsMemoryVault', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
    jest.restoreAllMocks();
  });

  it('renders the local-only Personal Memory Vault shell', () => {
    render(<SettingsMemoryVault />);

    expect(screen.getByRole('heading', { name: 'Personal Memory Vault' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Owner Profile' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Preferences' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Goals' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rules / Boundaries' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Never Share' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Platform Permissions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Licensing Preferences' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Consent Ledger' })).toBeInTheDocument();
  });

  it('starts local, private, and licensing-disabled by default', () => {
    render(<SettingsMemoryVault />);

    expect(screen.getByText('Private by default')).toBeInTheDocument();
    expect(screen.getAllByText('Local only').length).toBeGreaterThan(0);
    expect(screen.getByText('Off by default')).toBeInTheDocument();
    expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Not included in project exports or Context Passports/),
    ).toBeInTheDocument();
  });

  it('shows a stronger empty state for the first private memory', () => {
    render(<SettingsMemoryVault />);

    expect(screen.getByLabelText('Memory Vault empty state')).toBeInTheDocument();
    expect(screen.getByText('Start with one private memory')).toBeInTheDocument();
    expect(
      screen.getByText(/It stays local and does not enter project handoffs/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add your first memory' })).toBeInTheDocument();
  });

  it('renders starter suggestions in the empty state', () => {
    render(<SettingsMemoryVault />);

    const suggestions = screen.getByLabelText('Memory Vault starter suggestions');
    expect(suggestions).toBeInTheDocument();
    expect(within(suggestions).getByRole('heading', { name: 'Try a starter memory' })).toBeInTheDocument();
    expect(within(suggestions).getByRole('button', { name: /AI response style/i })).toBeInTheDocument();
    expect(within(suggestions).getByRole('button', { name: /Code collaboration style/i })).toBeInTheDocument();
    expect(within(suggestions).getByRole('button', { name: /No guessing/i })).toBeInTheDocument();
    expect(within(suggestions).getByRole('button', { name: /Private vault boundary/i })).toBeInTheDocument();
    expect(within(suggestions).getByRole('button', { name: /User-owned AI memory/i })).toBeInTheDocument();
    expect(
      within(suggestions).getByText(/Suggestions only prefill the form/),
    ).toBeInTheDocument();
  });

  it('prefills the private memory form when clicking a starter suggestion', () => {
    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: /No guessing/i }));

    expect(screen.getByLabelText('Title')).toHaveValue('No guessing');
    expect(screen.getByLabelText('Category')).toHaveValue('rule');
    expect(screen.getByLabelText('Content')).toHaveValue(
      'If something is uncertain or unverified, say so clearly instead of guessing.',
    );
  });

  it('does not save an entry automatically when clicking a starter suggestion', () => {
    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: /Private vault boundary/i }));

    expect(window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY)).toBeNull();
    expect(screen.getByText('No private memories saved yet.')).toBeInTheDocument();
  });

  it('saves a normal private local entry after starter prefill', () => {
    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: /AI response style/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save private memory' }));

    expect(screen.getByText('AI response style')).toBeInTheDocument();
    expect(
      screen.getByText('I prefer clear, direct answers with practical next steps. Use British English.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Preference - Private - Local only')).toBeInTheDocument();

    const stored = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    expect(stored).toContain('AI response style');
    expect(stored).toContain('I prefer clear, direct answers with practical next steps. Use British English.');
    expect(stored).toContain('"sensitivity":"private"');
  });

  it('renders the data rights and consent preview as informational safeguards', () => {
    render(<SettingsMemoryVault />);

    expect(screen.getByText('Your data rights layer')).toBeInTheDocument();
    expect(screen.getByText('Own first. Share later, only by choice.')).toBeInTheDocument();
    expect(screen.getByText(/Nothing here is shared without explicit action/)).toBeInTheDocument();
    expect(screen.getByText(/This is not legal advice and does not guarantee enforcement/)).toBeInTheDocument();

    const safeguardsGrid = screen.getByLabelText('Future consent and licensing safeguards');
    expect(safeguardsGrid).toBeInTheDocument();
    expect(within(safeguardsGrid).getByRole('heading', { name: 'Sharing permissions' })).toBeInTheDocument();
    expect(within(safeguardsGrid).getByRole('heading', { name: 'AI training permission' })).toBeInTheDocument();
    expect(within(safeguardsGrid).getByRole('heading', { name: 'Commercial licensing' })).toBeInTheDocument();
    expect(within(safeguardsGrid).getByRole('heading', { name: 'Consent receipt' })).toBeInTheDocument();
    expect(within(safeguardsGrid).getByRole('heading', { name: 'Consent ledger' })).toBeInTheDocument();
    expect(within(safeguardsGrid).getAllByText('Informational only - not active')).toHaveLength(3);
    expect(within(safeguardsGrid).getAllByText('Active local safeguard')).toHaveLength(2);
  });

  it('renders the local Consent Ledger section with safe defaults', () => {
    render(<SettingsMemoryVault />);

    expect(screen.getByText('Local permission receipts')).toBeInTheDocument();
    expect(screen.getByText(/not legal advice or automatic enforcement/i)).toBeInTheDocument();
    expect(screen.getByText(/Events are append-only/)).toBeInTheDocument();
    expect(screen.getByText('No consent events recorded yet.')).toBeInTheDocument();
    expect(screen.getByLabelText('Commercial use allowed')).toBeDisabled();
    expect(screen.getByLabelText('AI training allowed')).toBeDisabled();
  });

  it('adds a local consent ledger event', () => {
    render(<SettingsMemoryVault />);

    fireEvent.change(screen.getByLabelText('Action'), {
      target: { value: 'consent_granted' },
    });
    fireEvent.change(screen.getByLabelText('Scope'), {
      target: { value: 'platform_sharing' },
    });
    fireEvent.change(screen.getByLabelText('Platform optional'), {
      target: { value: 'ChatGPT' },
    });
    fireEvent.change(screen.getByLabelText('Target optional'), {
      target: { value: 'preference memory' },
    });
    fireEvent.change(screen.getByLabelText('Notes optional'), {
      target: { value: 'ConsentLedgerUiSentinel' },
    });
    fireEvent.click(screen.getByLabelText('Commercial use allowed'));
    fireEvent.click(screen.getByRole('button', { name: 'Record consent event' }));

    expect(screen.getByRole('heading', { name: 'Consent granted' })).toBeInTheDocument();
    expect(screen.getByText('Platform sharing - Allowed')).toBeInTheDocument();
    expect(screen.getByText(/ConsentLedgerUiSentinel/)).toBeInTheDocument();

    const stored = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    expect(stored).toContain('ConsentLedgerUiSentinel');
    expect(stored).toContain('"commercialUseAllowed":true');
    expect(stored).toContain('"aiTrainingAllowed":false');
  });

  it('copies a consent receipt without exposing private memory content', async () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-08T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry('PrivateReceiptUiMemorySentinel', {
        id: 'receipt-private-memory',
        label: 'Receipt private memory',
        category: 'preference',
        updatedAt: vault.updatedAt,
      }),
    ];
    vault.neverShare = ['PrivateReceiptNeverShareSentinel'];
    vault.consentLedger = [
      createConsentLedgerEvent({
        id: 'receipt-consent-event',
        createdAt: '2026-05-08T10:30:00.000Z',
        action: 'consent_refused',
        scope: 'ai_training',
        notes: 'ReceiptUiLedgerNoteSentinel',
      }),
    ];
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy consent receipt' }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    const receipt = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
    expect(receipt).toContain('# Memephant Personal Memory Vault - Consent Receipt');
    expect(receipt).toContain('ReceiptUiLedgerNoteSentinel');
    expect(receipt).toContain('This receipt does not include private memory entry contents.');
    expect(receipt).not.toContain('PrivateReceiptUiMemorySentinel');
    expect(receipt).not.toContain('PrivateReceiptNeverShareSentinel');
  });

  it('shows a readonly consent receipt preview if clipboard copy fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: jest.fn().mockRejectedValue(new Error('clipboard blocked')),
      },
    });

    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy consent receipt' }));

    const preview = await screen.findByLabelText('Consent receipt preview');
    expect(preview).toHaveValue();
    expect((preview as HTMLTextAreaElement).value).toContain(
      '# Memephant Personal Memory Vault - Consent Receipt',
    );
  });

  it('creates a private memory entry locally', () => {
    render(<SettingsMemoryVault />);

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Writing style' },
    });
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'preference' },
    });
    fireEvent.change(screen.getByLabelText('Content'), {
      target: { value: 'PersonalVaultCreatedEntrySentinel' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save private memory' }));

    expect(screen.getByText('Writing style')).toBeInTheDocument();
    expect(screen.getByText('PersonalVaultCreatedEntrySentinel')).toBeInTheDocument();
    expect(screen.getByText('Preference - Private - Local only')).toBeInTheDocument();

    const stored = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    expect(stored).toContain('PersonalVaultCreatedEntrySentinel');
    expect(stored).toContain('"sensitivity":"private"');
  });

  it('rejects empty private memory entries', () => {
    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: 'Save private memory' }));

    expect(screen.getByText('Add a title and content before saving.')).toBeInTheDocument();
    expect(window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY)).toBeNull();
  });

  it('displays saved private memory entries from local storage', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-08T10:00:00.000Z');
    vault.goals = [
      createPersonalMemoryEntry('PersonalVaultSavedEntrySentinel', {
        id: 'saved-goal-1',
        label: 'Saved goal',
        category: 'goal',
        updatedAt: vault.updatedAt,
      }),
    ];
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    expect(screen.getByText('Saved goal')).toBeInTheDocument();
    expect(screen.getByText('PersonalVaultSavedEntrySentinel')).toBeInTheDocument();
    expect(screen.getByText('Goal - Private - Local only')).toBeInTheDocument();
  });

  it('deletes a private memory entry locally after confirmation', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-08T10:00:00.000Z');
    vault.rules = [
      createPersonalMemoryEntry('PersonalVaultDeleteEntrySentinel', {
        id: 'delete-rule-1',
        label: 'Delete me',
        category: 'rule',
        updatedAt: vault.updatedAt,
      }),
    ];
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete private memory?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Memory' }));

    expect(screen.queryByText('PersonalVaultDeleteEntrySentinel')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY)).not.toContain(
      'PersonalVaultDeleteEntrySentinel',
    );
  });

  it('edits a private memory entry locally', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-08T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry('Original private memory', {
        id: 'edit-pref-1',
        label: 'Original title',
        category: 'preference',
        updatedAt: vault.updatedAt,
      }),
    ];
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Edit title'), {
      target: { value: 'Edited title' },
    });
    fireEvent.change(screen.getByLabelText('Edit category'), {
      target: { value: 'boundary' },
    });
    fireEvent.change(screen.getByLabelText('Edit content'), {
      target: { value: 'PersonalVaultEditedEntrySentinel' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.queryByText('Original title')).not.toBeInTheDocument();
    expect(screen.queryByText('Original private memory')).not.toBeInTheDocument();
    expect(screen.getByText('Edited title')).toBeInTheDocument();
    expect(screen.getByText('PersonalVaultEditedEntrySentinel')).toBeInTheDocument();
    expect(screen.getByText('Boundary - Private - Local only')).toBeInTheDocument();

    const stored = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    expect(stored).toContain('PersonalVaultEditedEntrySentinel');
    expect(stored).toContain('"sensitivity":"private"');
  });

  it('rejects empty edits', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-08T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry('Keep this memory', {
        id: 'edit-empty-pref-1',
        label: 'Keep title',
        category: 'preference',
        updatedAt: vault.updatedAt,
      }),
    ];
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Edit content'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText('Add a title and content before saving.')).toBeInTheDocument();
    expect(window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY)).toContain(
      'Keep this memory',
    );
  });

  it('cancels editing without changing the saved entry', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-08T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry('Original cancel content', {
        id: 'cancel-edit-pref-1',
        label: 'Original cancel title',
        category: 'preference',
        updatedAt: vault.updatedAt,
      }),
    ];
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Edit title'), {
      target: { value: 'Discarded title' },
    });
    fireEvent.change(screen.getByLabelText('Edit content'), {
      target: { value: 'Discarded content' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Original cancel title')).toBeInTheDocument();
    expect(screen.getByText('Original cancel content')).toBeInTheDocument();
    expect(screen.queryByText('Discarded title')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY)).toContain(
      'Original cancel content',
    );
  });

  it('keeps neverShare consistent when editing categories and content', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-08T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry('Initial private value', {
        id: 'edit-never-share-1',
        label: 'Sensitive rule',
        category: 'preference',
        updatedAt: vault.updatedAt,
      }),
    ];
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Edit category'), {
      target: { value: 'never_share' },
    });
    fireEvent.change(screen.getByLabelText('Edit content'), {
      target: { value: 'NeverShareFirstSentinel' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    let stored = JSON.parse(
      window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY) ?? '{}',
    ) as { neverShare?: string[] };
    expect(stored.neverShare).toContain('NeverShareFirstSentinel');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Edit content'), {
      target: { value: 'NeverShareSecondSentinel' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    stored = JSON.parse(
      window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY) ?? '{}',
    ) as { neverShare?: string[] };
    expect(stored.neverShare).not.toContain('NeverShareFirstSentinel');
    expect(stored.neverShare).toContain('NeverShareSecondSentinel');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Edit category'), {
      target: { value: 'preference' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    stored = JSON.parse(
      window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY) ?? '{}',
    ) as { neverShare?: string[] };
    expect(stored.neverShare).not.toContain('NeverShareSecondSentinel');
  });

  it('clears the local vault after confirmation and returns to empty state', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-08T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry('PersonalVaultUiClearSentinel', {
        id: 'ui-pref-1',
        updatedAt: vault.updatedAt,
      }),
    ];
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    expect(screen.getByText('1 saved')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear Vault' }));
    expect(screen.getByText('Clear Personal Memory Vault?')).toBeInTheDocument();

    const clearButtons = screen.getAllByRole('button', { name: 'Clear Vault' });
    fireEvent.click(clearButtons[clearButtons.length - 1]);

    expect(window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY)).toBeNull();
    expect(screen.queryByText('PersonalVaultUiClearSentinel')).not.toBeInTheDocument();
    expect(screen.getAllByText('Empty').length).toBeGreaterThan(0);
  });

  // AI Working Style tests

  it('shows an empty AI Working Style state with no eligible entries', () => {
    render(<SettingsMemoryVault />);

    expect(screen.getByText('AI Working Style')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Add preference, rule, or boundary memories to generate a working-style prompt.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy AI working style' })).toBeDisabled();
  });

  it('previews AI working style from preferences, rules, and boundaries', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-08T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry('WORKING_STYLE_PREF_SENTINEL', {
        id: 'ws-pref-1',
        label: 'My preference',
        category: 'preference',
        updatedAt: vault.updatedAt,
      }),
    ];
    vault.rules = [
      createPersonalMemoryEntry('WORKING_STYLE_RULE_SENTINEL', {
        id: 'ws-rule-1',
        label: 'My rule',
        category: 'rule',
        updatedAt: vault.updatedAt,
      }),
      createPersonalMemoryEntry('WORKING_STYLE_BOUNDARY_SENTINEL', {
        id: 'ws-boundary-1',
        label: 'My boundary',
        category: 'boundary',
        updatedAt: vault.updatedAt,
      }),
    ];
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    const preview = screen.getByLabelText('AI working style preview') as HTMLTextAreaElement;
    expect(preview).toBeInTheDocument();
    expect(preview.value).toContain('Use these working preferences when helping me:');
    expect(preview.value).toContain('WORKING_STYLE_PREF_SENTINEL');
    expect(preview.value).toContain('WORKING_STYLE_RULE_SENTINEL');
    expect(preview.value).toContain('WORKING_STYLE_BOUNDARY_SENTINEL');
    expect(preview.value).toContain('Preferences:');
    expect(preview.value).toContain('Rules:');
    expect(preview.value).toContain('Boundaries:');
    expect(screen.getByRole('button', { name: 'Copy AI working style' })).not.toBeDisabled();
  });

  it('excludes non-working-style vault entries from AI working style', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-08T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry('WORKING_STYLE_PREF_SENTINEL', {
        id: 'ws-excl-pref-1',
        label: 'Safe pref',
        category: 'preference',
        updatedAt: vault.updatedAt,
      }),
    ];
    vault.goals = [
      createPersonalMemoryEntry('WORKING_STYLE_GOAL_SHOULD_NOT_COPY', {
        id: 'ws-excl-goal-1',
        category: 'goal',
        updatedAt: vault.updatedAt,
      }),
    ];
    vault.neverShare = ['WORKING_STYLE_NEVER_SHARE_SHOULD_NOT_COPY'];
    vault.privateNotes = [
      createPersonalMemoryEntry('WORKING_STYLE_PRIVATE_NOTE_SHOULD_NOT_COPY', {
        id: 'ws-excl-note-1',
        category: 'custom',
        updatedAt: vault.updatedAt,
      }),
      createPersonalMemoryEntry('WORKING_STYLE_OWNER_PROFILE_SHOULD_NOT_COPY', {
        id: 'ws-excl-owner-1',
        category: 'owner_profile',
        updatedAt: vault.updatedAt,
      }),
    ];
    vault.consentLedger = [
      createConsentLedgerEvent({
        id: 'ws-excl-consent-1',
        createdAt: vault.updatedAt,
        action: 'consent_refused',
        scope: 'ai_training',
        notes: 'WORKING_STYLE_CONSENT_SHOULD_NOT_COPY',
      }),
    ];
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    const preview = screen.getByLabelText('AI working style preview') as HTMLTextAreaElement;
    expect(preview.value).toContain('WORKING_STYLE_PREF_SENTINEL');
    expect(preview.value).not.toContain('WORKING_STYLE_GOAL_SHOULD_NOT_COPY');
    expect(preview.value).not.toContain('WORKING_STYLE_NEVER_SHARE_SHOULD_NOT_COPY');
    expect(preview.value).not.toContain('WORKING_STYLE_PRIVATE_NOTE_SHOULD_NOT_COPY');
    expect(preview.value).not.toContain('WORKING_STYLE_OWNER_PROFILE_SHOULD_NOT_COPY');
    expect(preview.value).not.toContain('WORKING_STYLE_CONSENT_SHOULD_NOT_COPY');
  });

  it('copies AI working style without mutating the vault', async () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-08T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry('WORKING_STYLE_PREF_SENTINEL', {
        id: 'ws-copy-pref-1',
        label: 'Copy pref',
        category: 'preference',
        updatedAt: vault.updatedAt,
      }),
    ];
    savePersonalMemoryVault(vault);
    const storedBefore = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);

    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy AI working style' }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    const copied = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
    expect(copied).toContain('Use these working preferences when helping me:');
    expect(copied).toContain('WORKING_STYLE_PREF_SENTINEL');

    const storedAfter = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    expect(storedAfter).toEqual(storedBefore);
  });

  it('shows AI working style preview if clipboard copy fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: jest
          .fn()
          .mockRejectedValue(new Error('clipboard blocked for working style')),
      },
    });

    const vault = createDefaultPersonalMemoryVault('2026-05-08T10:00:00.000Z');
    vault.rules = [
      createPersonalMemoryEntry('WORKING_STYLE_RULE_SENTINEL', {
        id: 'ws-fail-rule-1',
        label: 'Fallback rule',
        category: 'rule',
        updatedAt: vault.updatedAt,
      }),
    ];
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy AI working style' }));

    const preview = await screen.findByLabelText(
      'AI working style preview',
    ) as HTMLTextAreaElement;
    expect(preview).toBeInTheDocument();
    expect(preview.readOnly).toBe(true);
    expect(preview.value).toContain('WORKING_STYLE_RULE_SENTINEL');
  });
});

describe('AI Answer Style presets', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders all five preset cards', () => {
    render(<SettingsMemoryVault />);

    expect(screen.getByRole('button', { name: /Straight Shooter/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Strict Code Reviewer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Balanced Builder/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Friendly Coach/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Red Team Mode/i })).toBeInTheDocument();
  });

  it('prefills the form when a preset card is clicked', () => {
    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: /Straight Shooter/i }));

    const titleInput = screen.getByPlaceholderText('Example: Collaboration preference') as HTMLInputElement;
    const contentTextarea = screen.getByPlaceholderText(
      'Write a private memory you want to keep under your control.',
    ) as HTMLTextAreaElement;

    expect(titleInput.value).toBe('Straight Shooter');
    expect(contentTextarea.value).toContain('direct answers');
  });

  it('prefills with the correct category for a rule preset', () => {
    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: /Strict Code Reviewer/i }));

    const categorySelect = screen.getByLabelText('Category') as HTMLSelectElement;
    expect(categorySelect.value).toBe('rule');
  });

  it('does not auto-save when a preset card is clicked', () => {
    render(<SettingsMemoryVault />);

    const storedBefore = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);

    fireEvent.click(screen.getByRole('button', { name: /Friendly Coach/i }));

    const storedAfter = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    expect(storedAfter).toEqual(storedBefore);
  });

  it('clears the form error when a preset card is clicked', () => {
    render(<SettingsMemoryVault />);

    // Trigger a form error by clicking Save with empty fields
    fireEvent.click(screen.getByRole('button', { name: 'Save private memory' }));
    expect(screen.getByText('Add a title and content before saving.')).toBeInTheDocument();

    // Clicking a preset should clear the error
    fireEvent.click(screen.getByRole('button', { name: /Red Team Mode/i }));
    expect(screen.queryByText('Add a title and content before saving.')).not.toBeInTheDocument();
  });

  it('saving after AI Answer Style preset prefill creates a normal private local memory', () => {
    // Use actual preset content as sentinel — it is unique to the Straight Shooter preset
    const STRAIGHT_SHOOTER_TITLE = 'Straight Shooter';
    const STRAIGHT_SHOOTER_CONTENT_SENTINEL = 'without preamble, recap, or filler';

    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: /Straight Shooter/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save private memory' }));

    // Title appears both on the preset card and in Saved private memories — assert at least 2
    const titleMatches = screen.getAllByText(STRAIGHT_SHOOTER_TITLE);
    expect(titleMatches.length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/without preamble, recap, or filler/).length).toBeGreaterThanOrEqual(2);

    // Category label shows Preference - Private - Local only
    expect(screen.getByText('Preference - Private - Local only')).toBeInTheDocument();

    // localStorage contains the content and marks it as private
    const stored = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY) ?? '';
    expect(stored).toContain(STRAIGHT_SHOOTER_TITLE);
    expect(stored).toContain(STRAIGHT_SHOOTER_CONTENT_SENTINEL);
    expect(stored).toContain('"sensitivity":"private"');
  });

  it('saved AI Answer Style rule preset appears in AI Working Style preview', () => {
    // Use actual preset content as sentinel — unique to Strict Code Reviewer
    const CODE_REVIEWER_CONTENT_SENTINEL = 'Flag every issue you spot';

    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: /Strict Code Reviewer/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Save private memory' }));

    // AI Working Style preview should now be rendered and contain the saved rule
    const preview = screen.getByLabelText('AI working style preview') as HTMLTextAreaElement;
    expect(preview).toBeInTheDocument();
    expect(preview.readOnly).toBe(true);
    expect(preview.value).toContain('Rules:');
    expect(preview.value).toContain(CODE_REVIEWER_CONTENT_SENTINEL);
  });
});
