import { fireEvent, render, screen } from '@testing-library/react';
import AppShell from '../components/Layout/AppShell';
import { useProjectStore } from '../store/projectStore';

jest.mock('../hooks/useTauriSync', () => ({
  useTauriSync: jest.fn(),
}));

jest.mock('../services/tauriActions', () => ({
  isDesktopApp: () => false,
  createProject: jest.fn(async () => undefined),
  createProjectFromFolder: jest.fn(async () => undefined),
  createProjectFromTemplate: jest.fn(async () => undefined),
  importProjectFromFile: jest.fn(async () => undefined),
  deleteProject: jest.fn(async () => undefined),
}));

jest.mock('../components/CommandPalette/CommandPalette', () => ({
  CommandPalette: () => null,
}));

jest.mock('../components/Tour/TourOverlay', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../components/Layout/WelcomeScreen', () => ({
  __esModule: true,
  default: () => <div>Welcome placeholder</div>,
}));

jest.mock('../components/Settings/SettingsPage', () => ({
  __esModule: true,
  default: () => <div>Settings placeholder</div>,
}));

jest.mock('../components/Workspace/ActionBar', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../components/Workspace/WorkflowGuide', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../components/Workspace/PasteZone', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../components/Editor/ProjectEditor', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../components/PWAInstallButton', () => ({
  PWAInstallButton: () => null,
}));

jest.mock('../components/Shared/ConfirmDialog', () => ({
  __esModule: true,
  default: () => null,
  ConfirmDialog: () => null,
}));

jest.mock('../components/Launchpad/LaunchpadWizard', () => ({
  __esModule: true,
  default: () => null,
}));

describe('AppShell Memory Vault navigation', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useProjectStore.setState({
      projects: [],
      activeProjectId: null,
      currentView: 'projects',
      isLoading: false,
      toastMessage: null,
      settingsTab: 'general',
    });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('shows Memory Vault as a top-level navigation option', () => {
    render(<AppShell />);

    expect(
      screen.getByRole('button', { name: /Memory Vault Private personal memory/i }),
    ).toBeInTheDocument();
  });

  it('opens the Personal Memory Vault from top-level navigation', () => {
    render(<AppShell />);

    fireEvent.click(
      screen.getByRole('button', { name: /Memory Vault Private personal memory/i }),
    );

    expect(
      screen.getByRole('heading', { name: 'Personal Memory Vault' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Local only').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Not included in project exports or Context Passports/),
    ).toBeInTheDocument();
    expect(screen.getByText('Your data rights layer')).toBeInTheDocument();
    expect(screen.getByText('Consent and licensing preview')).toBeInTheDocument();
  });
});
