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
    expect(screen.getByText('Owner Profile')).toBeInTheDocument();
    expect(screen.getByText('Preferences')).toBeInTheDocument();
    expect(screen.getByText('Goals')).toBeInTheDocument();
    expect(screen.getByText('Rules / Boundaries')).toBeInTheDocument();
    expect(screen.getByText('Never Share')).toBeInTheDocument();
    expect(screen.getByText('Platform Permissions')).toBeInTheDocument();
    expect(screen.getByText('Licensing Preferences')).toBeInTheDocument();
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
    expect(screen.getAllByText('Empty').length).toBeGreaterThan(0);
  });
});
