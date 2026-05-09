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
});
