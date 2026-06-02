import { fireEvent, render, screen, within } from '@testing-library/react';
import SettingsMemoryVault from '../components/Settings/SettingsMemoryVault';
import {
  createConsentLedgerEvent,
  createDefaultPersonalMemoryVault,
  createPersonalMemoryEntry,
  DEFAULT_FRONTAL_LOBE_PROFILE,
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
    expect(screen.getAllByRole('heading', { name: 'Preferences' }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('heading', { name: 'Goals' }).length).toBeGreaterThanOrEqual(2);
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
    expect(
      within(suggestions).getByRole('heading', { name: 'Try a starter memory' }),
    ).toBeInTheDocument();
    expect(within(suggestions).getByRole('button', { name: /AI response style/i })).toBeInTheDocument();
    expect(
      within(suggestions).getByRole('button', { name: /Code collaboration style/i }),
    ).toBeInTheDocument();
    expect(within(suggestions).getByRole('button', { name: /No guessing/i })).toBeInTheDocument();
    expect(
      within(suggestions).getByRole('button', { name: /Private vault boundary/i }),
    ).toBeInTheDocument();
    expect(
      within(suggestions).getByRole('button', { name: /User-owned AI memory/i }),
    ).toBeInTheDocument();
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
    expect(
      within(safeguardsGrid).getByRole('heading', { name: 'Sharing permissions' }),
    ).toBeInTheDocument();
    expect(
      within(safeguardsGrid).getByRole('heading', { name: 'AI training permission' }),
    ).toBeInTheDocument();
    expect(
      within(safeguardsGrid).getByRole('heading', { name: 'Commercial licensing' }),
    ).toBeInTheDocument();
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

  it('shows an empty AI Working Style state with no eligible entries', () => {
    render(<SettingsMemoryVault />);

    expect(screen.getAllByText('AI Working Style').length).toBeGreaterThanOrEqual(2);
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

describe('AI Answer Style dropdown', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('renders the AI Answer Style dropdown', () => {
    render(<SettingsMemoryVault />);
    expect(screen.getByLabelText('Answer style preset')).toBeInTheDocument();
  });

  it('selecting Straight Shooter pre-fills Title, Category, and Content', () => {
    render(<SettingsMemoryVault />);

    fireEvent.change(screen.getByLabelText('Answer style preset'), {
      target: { value: 'answer-style-straight-shooter' },
    });

    expect(screen.getByLabelText('Title')).toHaveValue('Straight Shooter');
    expect(screen.getByLabelText('Category')).toHaveValue('preference');
    expect(screen.getByLabelText('Content')).toHaveValue(
      'Give me direct answers without preamble, recap, or filler. Lead with the answer. Skip pleasantries.',
    );
  });

  it('selecting Strict Code Reviewer sets category to rule', () => {
    render(<SettingsMemoryVault />);

    fireEvent.change(screen.getByLabelText('Answer style preset'), {
      target: { value: 'answer-style-strict-code-reviewer' },
    });

    expect(screen.getByLabelText('Category')).toHaveValue('rule');
  });

  it('selecting a preset does not save automatically or mutate localStorage', () => {
    render(<SettingsMemoryVault />);

    const storedBefore = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);

    fireEvent.change(screen.getByLabelText('Answer style preset'), {
      target: { value: 'answer-style-friendly-coach' },
    });

    const storedAfter = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    expect(storedAfter).toEqual(storedBefore);
  });

  it('saving after selecting a preset creates a normal private local memory', () => {
    const STRAIGHT_SHOOTER_TITLE = 'Straight Shooter';
    const STRAIGHT_SHOOTER_CONTENT_SENTINEL = 'without preamble, recap, or filler';

    render(<SettingsMemoryVault />);

    fireEvent.change(screen.getByLabelText('Answer style preset'), {
      target: { value: 'answer-style-straight-shooter' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save private memory' }));

    // Title appears in both saved entry h3 and the dropdown option
    expect(screen.getAllByText(STRAIGHT_SHOOTER_TITLE).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/without preamble, recap, or filler/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Preference - Private - Local only')).toBeInTheDocument();

    const stored = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY) ?? '';
    expect(stored).toContain(STRAIGHT_SHOOTER_TITLE);
    expect(stored).toContain(STRAIGHT_SHOOTER_CONTENT_SENTINEL);
    expect(stored).toContain('"sensitivity":"private"');
  });

  it('saved AI Answer Style preset appears in AI Working Style preview', () => {
    const CODE_REVIEWER_CONTENT_SENTINEL = 'Flag every issue you spot';

    render(<SettingsMemoryVault />);

    fireEvent.change(screen.getByLabelText('Answer style preset'), {
      target: { value: 'answer-style-strict-code-reviewer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save private memory' }));

    const preview = screen.getByLabelText('AI working style preview') as HTMLTextAreaElement;
    expect(preview).toBeInTheDocument();
    expect(preview.readOnly).toBe(true);
    expect(preview.value).toContain('Rules:');
    expect(preview.value).toContain(CODE_REVIEWER_CONTENT_SENTINEL);
  });
});

describe('Personal Memory Snapshot', () => {
  const PASSPORT_PREF_SENTINEL = 'PASSPORT_PREF_SENTINEL';
  const PASSPORT_RULE_SENTINEL = 'PASSPORT_RULE_SENTINEL';
  const PASSPORT_BOUNDARY_SENTINEL = 'PASSPORT_BOUNDARY_SENTINEL';
  const PASSPORT_ANSWER_STYLE_SENTINEL = 'PASSPORT_ANSWER_STYLE_SENTINEL';
  const PASSPORT_NEVER_SHARE_SHOULD_NOT_COPY = 'PASSPORT_NEVER_SHARE_SHOULD_NOT_COPY';
  const PASSPORT_CUSTOM_NOTE_SHOULD_NOT_COPY = 'PASSPORT_CUSTOM_NOTE_SHOULD_NOT_COPY';
  const PASSPORT_OWNER_PROFILE_SHOULD_NOT_COPY = 'PASSPORT_OWNER_PROFILE_SHOULD_NOT_COPY';
  const PASSPORT_CONSENT_SHOULD_NOT_COPY = 'PASSPORT_CONSENT_SHOULD_NOT_COPY';

  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('renders Personal Memory Snapshot section', () => {
    render(<SettingsMemoryVault />);

    const passport = screen.getByLabelText('Personal Memory Snapshot section');
    expect(passport).toBeInTheDocument();
    expect(
      within(passport).getByRole('heading', { name: 'Copy personal AI instructions' }),
    ).toBeInTheDocument();
    expect(
      within(passport).getByRole('button', { name: 'Copy Personal Memory Snapshot' }),
    ).toBeInTheDocument();
    expect(within(passport).getByLabelText('Personal Memory Snapshot preview')).toBeInTheDocument();
  });

  it('preview includes selected preferences, rules, boundaries, and answer style memories', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-12T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry(PASSPORT_PREF_SENTINEL, {
        id: 'passport-pref-1',
        label: 'My pref',
        category: 'preference',
        updatedAt: vault.updatedAt,
      }),
      createPersonalMemoryEntry(PASSPORT_ANSWER_STYLE_SENTINEL, {
        id: 'passport-answer-style-1',
        label: 'Straight Shooter',
        category: 'preference',
        updatedAt: vault.updatedAt,
      }),
    ];
    vault.rules = [
      createPersonalMemoryEntry(PASSPORT_RULE_SENTINEL, {
        id: 'passport-rule-1',
        label: 'My rule',
        category: 'rule',
        updatedAt: vault.updatedAt,
      }),
      createPersonalMemoryEntry(PASSPORT_BOUNDARY_SENTINEL, {
        id: 'passport-boundary-1',
        label: 'My boundary',
        category: 'boundary',
        updatedAt: vault.updatedAt,
      }),
    ];
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    const passport = screen.getByLabelText('Personal Memory Snapshot section');
    const preview = within(passport).getByLabelText(
      'Personal Memory Snapshot preview',
    ) as HTMLTextAreaElement;
    expect(preview.value).toContain(PASSPORT_PREF_SENTINEL);
    expect(preview.value).toContain(PASSPORT_RULE_SENTINEL);
    expect(preview.value).toContain(PASSPORT_BOUNDARY_SENTINEL);
    expect(preview.value).toContain(PASSPORT_ANSWER_STYLE_SENTINEL);
    expect(preview.value).toContain('## AI Answer Style');
  });

  it('preview excludes never_share, owner_profile, custom notes, and consent events', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-12T10:00:00.000Z');
    vault.neverShare = [PASSPORT_NEVER_SHARE_SHOULD_NOT_COPY];
    vault.privateNotes = [
      createPersonalMemoryEntry(PASSPORT_CUSTOM_NOTE_SHOULD_NOT_COPY, {
        id: 'passport-custom-1',
        category: 'custom',
        updatedAt: vault.updatedAt,
      }),
      createPersonalMemoryEntry(PASSPORT_OWNER_PROFILE_SHOULD_NOT_COPY, {
        id: 'passport-owner-1',
        category: 'owner_profile',
        updatedAt: vault.updatedAt,
      }),
    ];
    vault.consentLedger = [
      createConsentLedgerEvent({
        id: 'passport-consent-1',
        createdAt: vault.updatedAt,
        action: 'consent_refused',
        scope: 'ai_training',
        notes: PASSPORT_CONSENT_SHOULD_NOT_COPY,
      }),
    ];
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    const passport = screen.getByLabelText('Personal Memory Snapshot section');
    const preview = within(passport).getByLabelText(
      'Personal Memory Snapshot preview',
    ) as HTMLTextAreaElement;
    expect(preview.value).not.toContain(PASSPORT_NEVER_SHARE_SHOULD_NOT_COPY);
    expect(preview.value).not.toContain(PASSPORT_CUSTOM_NOTE_SHOULD_NOT_COPY);
    expect(preview.value).not.toContain(PASSPORT_OWNER_PROFILE_SHOULD_NOT_COPY);
    expect(preview.value).not.toContain(PASSPORT_CONSENT_SHOULD_NOT_COPY);
  });

  it('shows "Never-share items excluded" wording', () => {
    render(<SettingsMemoryVault />);

    const passport = screen.getByLabelText('Personal Memory Snapshot section');
    expect(within(passport).getByText('Never-share items excluded')).toBeInTheDocument();
  });

  it('copy button writes the generated passport to navigator.clipboard', async () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-12T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry(PASSPORT_PREF_SENTINEL, {
        id: 'passport-copy-pref-1',
        label: 'Copy pref',
        category: 'preference',
        updatedAt: vault.updatedAt,
      }),
    ];
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    const passport = screen.getByLabelText('Personal Memory Snapshot section');
    fireEvent.click(
      within(passport).getByRole('button', { name: 'Copy Personal Memory Snapshot' }),
    );

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    const copied = (navigator.clipboard.writeText as jest.Mock).mock.calls[0][0] as string;
    expect(copied).toContain('# Personal Memory Snapshot');
    expect(copied).toContain(PASSPORT_PREF_SENTINEL);
    expect(copied).toContain('## Privacy Boundary');
  });

  it('clipboard failure keeps preview visible', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: jest.fn().mockRejectedValue(new Error('clipboard blocked')),
      },
    });

    render(<SettingsMemoryVault />);

    const passport = screen.getByLabelText('Personal Memory Snapshot section');
    fireEvent.click(
      within(passport).getByRole('button', { name: 'Copy Personal Memory Snapshot' }),
    );

    // Preview is always visible — wait a tick and verify it still exists
    await screen.findByLabelText('Personal Memory Snapshot preview');
    const preview = within(passport).getByLabelText(
      'Personal Memory Snapshot preview',
    ) as HTMLTextAreaElement;
    expect(preview).toBeInTheDocument();
    expect(preview.value).toContain('# Personal Memory Snapshot');
  });

  it('rendering and copying the passport does not mutate localStorage', async () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-12T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry(PASSPORT_PREF_SENTINEL, {
        id: 'passport-nomut-1',
        label: 'No mutate pref',
        category: 'preference',
        updatedAt: vault.updatedAt,
      }),
    ];
    savePersonalMemoryVault(vault);
    const storedBefore = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);

    render(<SettingsMemoryVault />);

    const passport = screen.getByLabelText('Personal Memory Snapshot section');
    fireEvent.click(
      within(passport).getByRole('button', { name: 'Copy Personal Memory Snapshot' }),
    );

    const storedAfter = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    expect(storedAfter).toEqual(storedBefore);
  });
});

describe('Memory Audit section', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  function expectAuditItem(audit: HTMLElement, label: string, value: string) {
    const labelEl = within(audit).getByText(label);
    const card = labelEl.closest('article');
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText(value)).toBeInTheDocument();
  }

  it('renders the Memory Audit section with key structural elements', () => {
    render(<SettingsMemoryVault />);

    expect(screen.getByText('Memory Audit')).toBeInTheDocument();

    const audit = screen.getByLabelText('Personal Memory Vault audit');
    expect(audit).toBeInTheDocument();
    expect(within(audit).getByText('What Memephant knows locally')).toBeInTheDocument();
    expect(within(audit).getByText(/Nothing here is shared/)).toBeInTheDocument();
    expect(within(audit).getByText('Automatically shared')).toBeInTheDocument();
  });

  it('always shows zero for Automatically shared even with a populated vault', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-11T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry('AUDIT_AUTO_SHARE_PREF_SENTINEL', {
        id: 'audit-auto-1',
        label: 'Auto share pref',
        category: 'preference',
        updatedAt: vault.updatedAt,
      }),
    ];
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    const audit = screen.getByLabelText('Personal Memory Vault audit');
    expectAuditItem(audit, 'Automatically shared', '0');
    expect(within(audit).getByText('Nothing in this vault is shared automatically.')).toBeInTheDocument();
  });

  it('counts categories correctly from a seeded vault', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-11T10:00:00.000Z');

    vault.preferences = [
      createPersonalMemoryEntry('AUDIT_PREF_SENTINEL_1', {
        id: 'audit-pref-1',
        label: 'Pref one',
        category: 'preference',
        updatedAt: vault.updatedAt,
      }),
      createPersonalMemoryEntry('AUDIT_PREF_SENTINEL_2', {
        id: 'audit-pref-2',
        label: 'Pref two',
        category: 'preference',
        updatedAt: vault.updatedAt,
      }),
    ];
    vault.goals = [
      createPersonalMemoryEntry('AUDIT_GOAL_SENTINEL', {
        id: 'audit-goal-1',
        label: 'Goal one',
        category: 'goal',
        updatedAt: vault.updatedAt,
      }),
    ];
    vault.rules = [
      createPersonalMemoryEntry('AUDIT_RULE_SENTINEL', {
        id: 'audit-rule-1',
        label: 'Rule one',
        category: 'rule',
        updatedAt: vault.updatedAt,
      }),
      createPersonalMemoryEntry('AUDIT_BOUNDARY_SENTINEL', {
        id: 'audit-boundary-1',
        label: 'Boundary one',
        category: 'boundary',
        updatedAt: vault.updatedAt,
      }),
    ];
    vault.neverShare = ['AUDIT_NEVER_SHARE_SENTINEL'];
    vault.consentLedger = [
      createConsentLedgerEvent({
        id: 'audit-consent-1',
        createdAt: vault.updatedAt,
        action: 'consent_refused',
        scope: 'ai_training',
      }),
    ];
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    const audit = screen.getByLabelText('Personal Memory Vault audit');

    expectAuditItem(audit, 'Total private memories', '5');
    expectAuditItem(audit, 'Preferences', '2');
    expectAuditItem(audit, 'Goals', '1');
    expectAuditItem(audit, 'Rules', '1');
    expectAuditItem(audit, 'Boundaries', '1');
    expectAuditItem(audit, 'Never-share items', '1');
    expectAuditItem(audit, 'AI Working Style eligible', '4');
    expectAuditItem(audit, 'Consent ledger events', '1');
    expectAuditItem(audit, 'Automatically shared', '0');
  });

  it('rendering Memory Audit does not mutate localStorage', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-11T10:00:00.000Z');
    vault.preferences = [
      createPersonalMemoryEntry('AUDIT_NO_MUTATE_SENTINEL', {
        id: 'audit-nomut-1',
        label: 'No mutate pref',
        category: 'preference',
        updatedAt: vault.updatedAt,
      }),
    ];
    savePersonalMemoryVault(vault);

    const storedBefore = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);

    render(<SettingsMemoryVault />);

    const storedAfter = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    expect(storedAfter).toEqual(storedBefore);
  });
});
describe('Frontal Lobe AI Working Style profile', () => {
  const FRONTAL_LOBE_RULE_SENTINEL = 'FRONTAL_LOBE_RULE_SENTINEL';
  const FRONTAL_LOBE_EMPTY_LINE_SHOULD_NOT_RENDER = '';
  const FRONTAL_LOBE_PROFILE_SHOULD_NOT_EXPORT = 'FRONTAL_LOBE_PROFILE_SHOULD_NOT_EXPORT';
  const FRONTAL_LOBE_NO_CONSENT_EVENT = 'FRONTAL_LOBE_NO_CONSENT_EVENT';

  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  // Test 1: section renders with AI Working Style wording
  it('renders Frontal Lobe section with AI Working Style wording', () => {
    render(<SettingsMemoryVault />);

    const section = screen.getByLabelText('Frontal Lobe AI Working Style section');
    expect(section).toBeInTheDocument();
    expect(within(section).getByRole('heading', { name: 'AI Working Style' })).toBeInTheDocument();
    expect(within(section).getByText(/Your AI Working Style profile/)).toBeInTheDocument();
    expect(within(section).getByLabelText('Default answer style')).toBeInTheDocument();
    expect(within(section).getByLabelText('Language preference')).toBeInTheDocument();
    expect(within(section).getByLabelText('Coding confidence')).toBeInTheDocument();
    expect(within(section).getByText('Builder Skill Profile')).toBeInTheDocument();
  });

  // Test 2: section copy does not use the word "personality"
  it('does not use the word personality anywhere in the section', () => {
    render(<SettingsMemoryVault />);

    const section = screen.getByLabelText('Frontal Lobe AI Working Style section');
    expect(section.textContent?.toLowerCase()).not.toContain('personality');
  });

  // Test 3: default profile values render for all 9 controls
  it('renders default profile values for all controls', () => {
    render(<SettingsMemoryVault />);

    const section = screen.getByLabelText('Frontal Lobe AI Working Style section');

    expect(within(section).getByLabelText('Default answer style')).toHaveValue(DEFAULT_FRONTAL_LOBE_PROFILE.defaultAnswerStyle);
    expect(within(section).getByLabelText('Challenge level')).toHaveValue(DEFAULT_FRONTAL_LOBE_PROFILE.challengeLevel);
    expect(within(section).getByLabelText('Code review strictness')).toHaveValue(DEFAULT_FRONTAL_LOBE_PROFILE.codeReviewStrictness);
    expect(within(section).getByLabelText('Explanation depth')).toHaveValue(DEFAULT_FRONTAL_LOBE_PROFILE.explanationDepth);
    expect(within(section).getByLabelText('Tone')).toHaveValue(DEFAULT_FRONTAL_LOBE_PROFILE.tone);
    expect(within(section).getByLabelText('Language preference')).toHaveValue(DEFAULT_FRONTAL_LOBE_PROFILE.languagePreference);
    expect(within(section).getByLabelText('Coding confidence')).toHaveValue(DEFAULT_FRONTAL_LOBE_PROFILE.codingConfidence);
    expect(within(section).getByLabelText('Code instruction style')).toHaveValue(DEFAULT_FRONTAL_LOBE_PROFILE.codeInstructionStyle);
    expect(within(section).getByLabelText('Debugging support')).toHaveValue(DEFAULT_FRONTAL_LOBE_PROFILE.debuggingSupport);
    expect(within(section).getByLabelText('Preferred pace')).toHaveValue(DEFAULT_FRONTAL_LOBE_PROFILE.preferredPace);

    // Verify human-readable defaults in the preview
    const preview = within(section).getByLabelText('Frontal Lobe preview') as HTMLTextAreaElement;
    expect(preview.value).toContain('Balanced Builder');
    expect(preview.value).toContain('Balanced');
    expect(preview.value).toContain('Normal');
    expect(preview.value).toContain('Explain why');
    expect(preview.value).toContain('I can edit files if told exactly where');
    expect(preview.value).toContain('Tell me the exact file and whether to replace or patch');
    expect(preview.value).toContain('Explain the error in plain English');
    expect(preview.value).toContain('Slow and guided');
    expect(preview.value).toContain('Language: British English');
    expect(preview.value).toContain('Use British spelling and phrasing, e.g. centre, colour, organise, behaviour.');
  });

  // Test 4: changing controls updates the preview
  it('changing controls live-updates the preview without saving', () => {
    render(<SettingsMemoryVault />);

    const section = screen.getByLabelText('Frontal Lobe AI Working Style section');
    const preview = within(section).getByLabelText('Frontal Lobe preview') as HTMLTextAreaElement;

    fireEvent.change(within(section).getByLabelText('Default answer style'), {
      target: { value: 'strict_code_reviewer' },
    });
    expect(preview.value).toContain('Strict Code Reviewer');

    fireEvent.change(within(section).getByLabelText('Challenge level'), {
      target: { value: 'high' },
    });
    expect(preview.value).toContain('High');

    fireEvent.change(within(section).getByLabelText('Coding confidence'), {
      target: { value: 'brand_new' },
    });
    expect(preview.value).toContain('Brand new — explain everything step by step');

    fireEvent.change(within(section).getByLabelText('Code instruction style'), {
      target: { value: 'full_files' },
    });
    expect(preview.value).toContain('Give me full files where possible');

    fireEvent.change(within(section).getByLabelText('Debugging support'), {
      target: { value: 'advanced_root_cause' },
    });
    expect(preview.value).toContain('Give me advanced root-cause analysis');

    fireEvent.change(within(section).getByLabelText('Preferred pace'), {
      target: { value: 'expert' },
    });
    expect(preview.value).toContain('Expert mode');

    fireEvent.change(within(section).getByLabelText('Language preference'), {
      target: { value: 'canadian_english' },
    });
    expect(preview.value).toContain('Language: Canadian English');
    expect(preview.value).toContain('Use Canadian English spelling and phrasing.');
  });

  // Test 5: custom working rules appear as bullets
  it('custom working rules appear as bullet points in the preview', () => {
    render(<SettingsMemoryVault />);

    const section = screen.getByLabelText('Frontal Lobe AI Working Style section');
    fireEvent.change(within(section).getByLabelText('Custom working rules'), {
      target: { value: FRONTAL_LOBE_RULE_SENTINEL },
    });

    const preview = within(section).getByLabelText('Frontal Lobe preview') as HTMLTextAreaElement;
    expect(preview.value).toContain(`- ${FRONTAL_LOBE_RULE_SENTINEL}`);
    expect(preview.value).toContain('## Custom Working Rules');
  });

  // Test 6: empty lines in custom rules are filtered out
  it('empty custom-rule lines are not rendered in the preview', () => {
    render(<SettingsMemoryVault />);

    const section = screen.getByLabelText('Frontal Lobe AI Working Style section');
    fireEvent.change(within(section).getByLabelText('Custom working rules'), {
      target: { value: `${FRONTAL_LOBE_RULE_SENTINEL}\n${FRONTAL_LOBE_EMPTY_LINE_SHOULD_NOT_RENDER}\nSecond rule` },
    });

    const preview = within(section).getByLabelText('Frontal Lobe preview') as HTMLTextAreaElement;
    expect(preview.value).toContain(`- ${FRONTAL_LOBE_RULE_SENTINEL}`);
    expect(preview.value).toContain('- Second rule');
    // Empty line should not create a bare dash bullet
    const bulletLines = preview.value.split('\n').filter((l) => l.trim() === '-');
    expect(bulletLines).toHaveLength(0);
  });

  // Test 7: changing controls and preview does not mutate localStorage before save
  it('changing controls and preview does not mutate localStorage before save', () => {
    render(<SettingsMemoryVault />);

    const storedBefore = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);

    const section = screen.getByLabelText('Frontal Lobe AI Working Style section');
    fireEvent.change(within(section).getByLabelText('Default answer style'), {
      target: { value: 'red_team_mode' },
    });
    fireEvent.change(within(section).getByLabelText('Coding confidence'), {
      target: { value: 'experienced' },
    });
    fireEvent.change(within(section).getByLabelText('Custom working rules'), {
      target: { value: FRONTAL_LOBE_RULE_SENTINEL },
    });

    const storedAfter = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    expect(storedAfter).toEqual(storedBefore);
  });

  // Test 8: saving writes to local Personal Memory Vault storage
  it('saving Frontal Lobe profile writes to local Personal Memory Vault storage', () => {
    render(<SettingsMemoryVault />);

    const section = screen.getByLabelText('Frontal Lobe AI Working Style section');
    fireEvent.change(within(section).getByLabelText('Default answer style'), {
      target: { value: 'strict_code_reviewer' },
    });
    fireEvent.change(within(section).getByLabelText('Coding confidence'), {
      target: { value: 'brand_new' },
    });
    fireEvent.change(within(section).getByLabelText('Language preference'), {
      target: { value: 'american_english' },
    });
    fireEvent.change(within(section).getByLabelText('Custom working rules'), {
      target: { value: FRONTAL_LOBE_RULE_SENTINEL },
    });

    fireEvent.click(within(section).getByRole('button', { name: 'Save Frontal Lobe profile' }));

    const stored = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored ?? '{}') as { frontalLobeProfile?: Record<string, unknown> };
    expect(parsed.frontalLobeProfile).toBeDefined();
    expect(parsed.frontalLobeProfile?.defaultAnswerStyle).toBe('strict_code_reviewer');
    expect(parsed.frontalLobeProfile?.codingConfidence).toBe('brand_new');
    expect(parsed.frontalLobeProfile?.languagePreference).toBe('american_english');
    expect(parsed.frontalLobeProfile?.customRules).toContain(FRONTAL_LOBE_RULE_SENTINEL);
  });

  // Test 9: resetting returns profile form and preview to defaults
  it('resetting returns profile form and preview to defaults', () => {
    render(<SettingsMemoryVault />);

    const section = screen.getByLabelText('Frontal Lobe AI Working Style section');

    fireEvent.change(within(section).getByLabelText('Default answer style'), {
      target: { value: 'red_team_mode' },
    });
    fireEvent.change(within(section).getByLabelText('Coding confidence'), {
      target: { value: 'experienced' },
    });
    fireEvent.change(within(section).getByLabelText('Custom working rules'), {
      target: { value: FRONTAL_LOBE_RULE_SENTINEL },
    });

    fireEvent.click(within(section).getByRole('button', { name: 'Reset Frontal Lobe profile' }));

    expect(within(section).getByLabelText('Default answer style')).toHaveValue(DEFAULT_FRONTAL_LOBE_PROFILE.defaultAnswerStyle);
    expect(within(section).getByLabelText('Coding confidence')).toHaveValue(DEFAULT_FRONTAL_LOBE_PROFILE.codingConfidence);
    expect(within(section).getByLabelText('Language preference')).toHaveValue(DEFAULT_FRONTAL_LOBE_PROFILE.languagePreference);
    expect(within(section).getByLabelText('Custom working rules')).toHaveValue('');

    const preview = within(section).getByLabelText('Frontal Lobe preview') as HTMLTextAreaElement;
    expect(preview.value).toContain('Balanced Builder');
    expect(preview.value).toContain('I can edit files if told exactly where');
    expect(preview.value).not.toContain(FRONTAL_LOBE_RULE_SENTINEL);
  });

  // Test 10: saving does not create a consent ledger event
  it('saving Frontal Lobe profile does not create a consent ledger event', () => {
    render(<SettingsMemoryVault />);

    const section = screen.getByLabelText('Frontal Lobe AI Working Style section');
    fireEvent.click(within(section).getByRole('button', { name: 'Save Frontal Lobe profile' }));

    const stored = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    const parsed = JSON.parse(stored ?? '{}') as { consentLedger?: unknown[] };
    expect(parsed.consentLedger).toHaveLength(0);

    // Sentinel: verify no consent event with our marker appears
    expect(stored).not.toContain(FRONTAL_LOBE_NO_CONSENT_EVENT);
  });

  // Test 11: Frontal Lobe profile excluded from project export boundaries
  it('Frontal Lobe profile sentinel data does not appear in project export surfaces', () => {
    const vault = createDefaultPersonalMemoryVault('2026-05-12T10:00:00.000Z');
    vault.frontalLobeProfile = {
      ...DEFAULT_FRONTAL_LOBE_PROFILE,
      customRules: [FRONTAL_LOBE_PROFILE_SHOULD_NOT_EXPORT],
    };
    savePersonalMemoryVault(vault);

    render(<SettingsMemoryVault />);

    // AI Working Style copy button — does not include frontalLobeProfile data
    const workingStylePreview = screen.queryByLabelText('AI working style preview');
    if (workingStylePreview) {
      expect((workingStylePreview as HTMLTextAreaElement).value).not.toContain(
        FRONTAL_LOBE_PROFILE_SHOULD_NOT_EXPORT,
      );
    }

    // Personal Memory Snapshot does not include frontalLobeProfile data
    const passportPreview = screen.getByLabelText('Personal Memory Snapshot preview') as HTMLTextAreaElement;
    expect(passportPreview.value).not.toContain(FRONTAL_LOBE_PROFILE_SHOULD_NOT_EXPORT);
  });

  // Test 12: existing Personal Memory Snapshot / AI Working Style tests still work
  it('Frontal Lobe section coexists without breaking AI Working Style copy or Context Passport copy', () => {
    render(<SettingsMemoryVault />);

    const frontalSection = screen.getByLabelText('Frontal Lobe AI Working Style section');
    expect(frontalSection).toBeInTheDocument();
    expect(screen.getByLabelText('Personal Memory Snapshot section')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy AI working style' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Personal Memory Snapshot' })).toBeInTheDocument();
  });

  // Test 13: Builder Skill Profile fields all render and update preview
  it('Builder Skill Profile section renders all four controls', () => {
    render(<SettingsMemoryVault />);

    const section = screen.getByLabelText('Frontal Lobe AI Working Style section');
    expect(within(section).getByText('Builder Skill Profile')).toBeInTheDocument();
    expect(within(section).getByLabelText('Coding confidence')).toBeInTheDocument();
    expect(within(section).getByLabelText('Code instruction style')).toBeInTheDocument();
    expect(within(section).getByLabelText('Debugging support')).toBeInTheDocument();
    expect(within(section).getByLabelText('Preferred pace')).toBeInTheDocument();

    // Check all Builder Skill Profile values appear in preview
    const preview = within(section).getByLabelText('Frontal Lobe preview') as HTMLTextAreaElement;
    expect(preview.value).toContain('## Builder Skill Profile');
    expect(preview.value).toContain('Coding Confidence:');
    expect(preview.value).toContain('Code Instruction Style:');
    expect(preview.value).toContain('Debugging Support:');
    expect(preview.value).toContain('Preferred Pace:');
    expect(preview.value).toContain('When giving code:');
  });

  // Test 14: default mode renders as 'default_on'
  it('AI Working Style Defaults mode selector renders with default_on selected', () => {
    render(<SettingsMemoryVault />);

    const section = screen.getByLabelText('Frontal Lobe AI Working Style section');
    expect(within(section).getByText('AI Working Style Defaults')).toBeInTheDocument();

    const modeSelect = within(section).getByLabelText('AI Working Style default inclusion mode') as HTMLSelectElement;
    expect(modeSelect.value).toBe('default_on');
  });

  // Test 15: changing mode updates state without auto-saving
  it('changing mode selector updates UI state without writing to storage', () => {
    render(<SettingsMemoryVault />);

    const section = screen.getByLabelText('Frontal Lobe AI Working Style section');
    const modeSelect = within(section).getByLabelText('AI Working Style default inclusion mode') as HTMLSelectElement;

    window.localStorage.clear();
    fireEvent.change(modeSelect, { target: { value: 'manual_only' } });

    expect(modeSelect.value).toBe('manual_only');
    // No save triggered — localStorage should still be empty
    expect(window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY)).toBeNull();
  });

  // Test 16: saving persists mode to storage
  it('saving Frontal Lobe profile persists mode to Personal Memory Vault storage', () => {
    render(<SettingsMemoryVault />);

    const section = screen.getByLabelText('Frontal Lobe AI Working Style section');
    fireEvent.change(within(section).getByLabelText('AI Working Style default inclusion mode'), {
      target: { value: 'off' },
    });

    fireEvent.click(within(section).getByRole('button', { name: 'Save Frontal Lobe profile' }));

    const stored = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored ?? '{}') as { frontalLobeProfile?: Record<string, unknown> };
    expect(parsed.frontalLobeProfile?.mode).toBe('off');
  });

  // Test 17: reset restores mode to default_on
  it('resetting Frontal Lobe profile restores mode to default_on', () => {
    render(<SettingsMemoryVault />);

    const section = screen.getByLabelText('Frontal Lobe AI Working Style section');
    const modeSelect = within(section).getByLabelText('AI Working Style default inclusion mode') as HTMLSelectElement;

    fireEvent.change(modeSelect, { target: { value: 'ask_each_time' } });
    expect(modeSelect.value).toBe('ask_each_time');

    fireEvent.click(within(section).getByRole('button', { name: 'Reset Frontal Lobe profile' }));

    expect(modeSelect.value).toBe('default_on');
  });

  it('renders the Memephant Passport card with status, completion, and fingerprint', () => {
    render(<SettingsMemoryVault />);

    const passport = screen.getByLabelText('Memephant Passport');

    expect(within(passport).getByRole('heading', { name: 'Memephant Passport' })).toBeInTheDocument();
    expect(within(passport).getByText('Working Style Profile: Portable')).toBeInTheDocument();
    expect(within(passport).getByText('Passport 86% complete')).toBeInTheDocument();
    expect(
      within(passport).getByText(
        'British English · Balanced Builder · Balanced · Slow and guided · Privacy-first',
      ),
    ).toBeInTheDocument();
    expect(within(passport).getByText('Local only, user controlled')).toBeInTheDocument();
    expect(within(passport).getByText('Ready for handoff')).toBeInTheDocument();
  });

  it('Passport card exposes professional CTA buttons', () => {
    render(<SettingsMemoryVault />);

    const passport = screen.getByLabelText('Memephant Passport');

    expect(within(passport).getByRole('button', { name: 'Complete Passport' })).toBeInTheDocument();
    expect(within(passport).getByRole('button', { name: 'Review Passport' })).toBeInTheDocument();
    expect(within(passport).getByRole('button', { name: 'Copy Passport Summary' })).toBeInTheDocument();
  });

  it('Copy Passport Summary copies the local passport summary only', () => {
    render(<SettingsMemoryVault />);

    const passport = screen.getByLabelText('Memephant Passport');
    fireEvent.click(within(passport).getByRole('button', { name: 'Copy Passport Summary' }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Working Style Profile: Portable'),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Fingerprint: British English'),
    );
  });
});

describe('Memory Vault Setup Wizard', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('"Start guided setup" button is visible on the Memory Vault page', () => {
    render(<SettingsMemoryVault />);

    expect(screen.getByRole('button', { name: 'Start guided setup' })).toBeInTheDocument();
    expect(screen.getByLabelText('Memory Vault guided setup')).toBeInTheDocument();
    expect(
      screen.getByText('Answer a few simple questions so AI knows how to help you.'),
    ).toBeInTheDocument();
  });

  it('clicking "Start guided setup" opens the wizard dialog', () => {
    render(<SettingsMemoryVault />);

    expect(screen.queryByRole('dialog', { name: 'Memory Vault Setup Wizard' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));

    expect(screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' })).toBeInTheDocument();
    expect(screen.getByLabelText('Wizard step 1')).toBeInTheDocument();
    expect(screen.getByText('How much coding help do you need?')).toBeInTheDocument();
  });

  it('wizard shows step 1 of 4 progress indicator', () => {
    render(<SettingsMemoryVault />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));

    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument();
  });

  it('Cancel button on step 1 closes the wizard without saving', () => {
    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));
    expect(screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' })).toBeInTheDocument();

    // Click Cancel on step 1
    const wizard = screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' });
    fireEvent.click(within(wizard).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: 'Memory Vault Setup Wizard' })).toBeNull();
    expect(window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY)).toBeNull();
  });

  it('close (×) button cancels the wizard without saving', () => {
    render(<SettingsMemoryVault />);

    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel guided setup' }));

    expect(screen.queryByRole('dialog', { name: 'Memory Vault Setup Wizard' })).toBeNull();
    expect(window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY)).toBeNull();
  });

  it('Next advances from step 1 to step 2', () => {
    render(<SettingsMemoryVault />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));

    const wizard = screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' });
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' }));

    expect(within(wizard).getByLabelText('Wizard step 2')).toBeInTheDocument();
    expect(within(wizard).getByText('How should AI answer you?')).toBeInTheDocument();
    expect(within(wizard).getByText('Step 2 of 4')).toBeInTheDocument();
  });

  it('Next advances from step 2 to step 3', () => {
    render(<SettingsMemoryVault />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));

    const wizard = screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' });
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → step 2
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → step 3

    expect(within(wizard).getByLabelText('Wizard step 3')).toBeInTheDocument();
    expect(within(wizard).getByText('When AI gives you code, what helps most?')).toBeInTheDocument();
  });

  it('Next advances from step 3 to step 4', () => {
    render(<SettingsMemoryVault />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));

    const wizard = screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' });
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → 2
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → 3
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → 4

    expect(within(wizard).getByLabelText('Wizard step 4')).toBeInTheDocument();
    expect(within(wizard).getByText('Pick rules you want AI to follow.')).toBeInTheDocument();
  });

  it('Back on step 2 returns to step 1', () => {
    render(<SettingsMemoryVault />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));

    const wizard = screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' });
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → 2
    fireEvent.click(within(wizard).getByRole('button', { name: 'Back' })); // → 1

    expect(within(wizard).getByLabelText('Wizard step 1')).toBeInTheDocument();
  });

  it('step 4 advances to review screen via "Review my setup"', () => {
    render(<SettingsMemoryVault />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));

    const wizard = screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' });
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → 2
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → 3
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → 4
    fireEvent.click(within(wizard).getByRole('button', { name: 'Review my setup' }));

    expect(within(wizard).getByLabelText('Wizard review screen')).toBeInTheDocument();
    expect(within(wizard).getByText('Here is your AI Working Style.')).toBeInTheDocument();
    expect(within(wizard).getByText('Review your setup')).toBeInTheDocument();
  });

  it('step 1 selection appears in the review screen', () => {
    render(<SettingsMemoryVault />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));

    const wizard = screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' });

    // Step 1: pick "I am experienced"
    fireEvent.click(within(wizard).getByRole('button', { name: /I am experienced/i }));
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' }));
    // Step 2: default, Next
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' }));
    // Step 3: default, Next
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' }));
    // Step 4: Review
    fireEvent.click(within(wizard).getByRole('button', { name: 'Review my setup' }));

    const review = within(wizard).getByLabelText('Guided setup summary');
    expect(review).toHaveTextContent('I am experienced');
  });

  it('step 2 selection appears in the review screen', () => {
    render(<SettingsMemoryVault />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));

    const wizard = screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' });

    // Step 1: Next
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' }));
    // Step 2: pick "Direct and short"
    fireEvent.click(within(wizard).getByRole('button', { name: /Direct and short/i }));
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' }));
    // Step 3: Next
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' }));
    // Step 4: Review
    fireEvent.click(within(wizard).getByRole('button', { name: 'Review my setup' }));

    const review = within(wizard).getByLabelText('Guided setup summary');
    expect(review).toHaveTextContent('Direct and short');
  });

  it('step 4 rule selections appear in the review screen', () => {
    render(<SettingsMemoryVault />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));

    const wizard = screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' });

    // Navigate to step 4
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → 2
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → 3
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → 4

    // Select two rules
    fireEvent.click(within(wizard).getByRole('button', { name: /Explain what changed after editing code/i }));
    fireEvent.click(within(wizard).getByRole('button', { name: /Flag any risks before making changes/i }));

    fireEvent.click(within(wizard).getByRole('button', { name: 'Review my setup' }));

    const review = within(wizard).getByLabelText('Guided setup summary');
    expect(review).toHaveTextContent('Explain what changed after editing code');
    expect(review).toHaveTextContent('Flag any risks before making changes');
  });

  it('"Save my AI setup" writes frontalLobeProfile to Personal Memory Vault storage', () => {
    render(<SettingsMemoryVault />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));

    const wizard = screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' });

    // Step 1: pick brand_new
    fireEvent.click(within(wizard).getByRole('button', { name: /I am brand new to coding/i }));
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' }));

    // Step 2: pick "Friendly coach"
    fireEvent.click(within(wizard).getByRole('button', { name: /Friendly coach/i }));
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' }));

    // Step 3: pick "Give me the full file"
    fireEvent.click(within(wizard).getByRole('button', { name: /Give me the full file/i }));
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' }));

    // Step 4: no rules selected
    fireEvent.click(within(wizard).getByRole('button', { name: 'Review my setup' }));

    // Save
    fireEvent.click(within(wizard).getByRole('button', { name: 'Save my AI setup' }));

    const stored = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored ?? '{}') as { frontalLobeProfile?: Record<string, unknown> };
    expect(parsed.frontalLobeProfile).toBeDefined();
    expect(parsed.frontalLobeProfile?.codingConfidence).toBe('brand_new');
    expect(parsed.frontalLobeProfile?.defaultAnswerStyle).toBe('friendly_coach');
    expect(parsed.frontalLobeProfile?.tone).toBe('friendly');
    expect(parsed.frontalLobeProfile?.challengeLevel).toBe('low');
    expect(parsed.frontalLobeProfile?.codeInstructionStyle).toBe('full_files');
    expect(parsed.frontalLobeProfile?.customRules).toEqual([]);
  });

  it('saving wizard writes rules to customRules in frontalLobeProfile', () => {
    render(<SettingsMemoryVault />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));

    const wizard = screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' });

    // Navigate to step 4
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → 2
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → 3
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → 4

    fireEvent.click(within(wizard).getByRole('button', { name: /Say which file the code goes in/i }));
    fireEvent.click(within(wizard).getByRole('button', { name: /If you're unsure, ask me instead of guessing/i }));

    fireEvent.click(within(wizard).getByRole('button', { name: 'Review my setup' }));
    fireEvent.click(within(wizard).getByRole('button', { name: 'Save my AI setup' }));

    const stored = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    const parsed = JSON.parse(stored ?? '{}') as { frontalLobeProfile?: Record<string, unknown> };
    expect(parsed.frontalLobeProfile?.customRules).toEqual([
      'Say which file the code goes in',
      "If you're unsure, ask me instead of guessing",
    ]);
  });

  it('saving wizard does not add consent ledger events', () => {
    render(<SettingsMemoryVault />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));

    const wizard = screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' });

    // Walk all 4 steps with defaults
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → 2
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → 3
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' })); // → 4
    fireEvent.click(within(wizard).getByRole('button', { name: 'Review my setup' }));
    fireEvent.click(within(wizard).getByRole('button', { name: 'Save my AI setup' }));

    const stored = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);
    const parsed = JSON.parse(stored ?? '{}') as { consentLedger?: unknown[] };
    expect(parsed.consentLedger?.length ?? 0).toBe(0);
  });

  it('saving wizard closes the dialog', () => {
    render(<SettingsMemoryVault />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));

    const wizard = screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' });

    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' }));
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' }));
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' }));
    fireEvent.click(within(wizard).getByRole('button', { name: 'Review my setup' }));
    fireEvent.click(within(wizard).getByRole('button', { name: 'Save my AI setup' }));

    expect(screen.queryByRole('dialog', { name: 'Memory Vault Setup Wizard' })).toBeNull();
  });

  it('review screen shows the export boundary disclaimer', () => {
    render(<SettingsMemoryVault />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));

    const wizard = screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' });

    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' }));
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' }));
    fireEvent.click(within(wizard).getByRole('button', { name: 'Next' }));
    fireEvent.click(within(wizard).getByRole('button', { name: 'Review my setup' }));

    expect(
      within(wizard).getByText(/not included in project exports or AI handoffs/i),
    ).toBeInTheDocument();
  });

  it('cancel on step 1 does not mutate storage even when vault was pre-populated', () => {
    const existingVault = createDefaultPersonalMemoryVault();
    savePersonalMemoryVault(existingVault);
    const snapshotBefore = window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY);

    render(<SettingsMemoryVault />);
    fireEvent.click(screen.getByRole('button', { name: 'Start guided setup' }));

    const wizard = screen.getByRole('dialog', { name: 'Memory Vault Setup Wizard' });
    fireEvent.click(within(wizard).getByRole('button', { name: 'Cancel' }));

    expect(window.localStorage.getItem(PERSONAL_MEMORY_VAULT_STORAGE_KEY)).toBe(snapshotBefore);
  });
});
