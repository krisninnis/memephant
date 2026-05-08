import { fireEvent, render, screen } from '@testing-library/react';
import SettingsMemoryVault from '../components/Settings/SettingsMemoryVault';
import {
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
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
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
  });

  it('starts local, private, and licensing-disabled by default', () => {
    render(<SettingsMemoryVault />);

    expect(screen.getByText('Local only')).toBeInTheDocument();
    expect(screen.getByText('Off by default')).toBeInTheDocument();
    expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Not included in project exports or Context Passports/),
    ).toBeInTheDocument();
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
