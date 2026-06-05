import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WelcomeScreen } from '../components/Layout/WelcomeScreen';
import type { ProjectMemory } from '../types/memphant-types';
import { DEMO_PROJECT_ID } from '../utils/demoProject';
import { createProjectFromFolder, saveToDisk } from '../services/tauriActions';

const mockAddProject = jest.fn();
const mockSetActiveProject = jest.fn();
const mockShowToast = jest.fn();
const mockSetCurrentView = jest.fn();
const mockSetSettingsTab = jest.fn();

let mockProjects: ProjectMemory[] = [];

jest.mock('../store/projectStore', () => ({
  useProjectStore: (selector: (state: {
    projects: ProjectMemory[];
    addProject: typeof mockAddProject;
    setActiveProject: typeof mockSetActiveProject;
    showToast: typeof mockShowToast;
    cloudUser: null;
    setCurrentView: typeof mockSetCurrentView;
    setSettingsTab: typeof mockSetSettingsTab;
  }) => unknown) =>
    selector({
      projects: mockProjects,
      addProject: mockAddProject,
      setActiveProject: mockSetActiveProject,
      showToast: mockShowToast,
      cloudUser: null,
      setCurrentView: mockSetCurrentView,
      setSettingsTab: mockSetSettingsTab,
    }),
}));

jest.mock('../services/tauriActions', () => ({
  isDesktopApp: jest.fn(() => false),
  createProjectFromFolder: jest.fn(),
  createProjectFromTemplate: jest.fn(),
  getFolderActionLabel: jest.fn(() => 'Select Folder'),
  importProjectFromFile: jest.fn(),
  saveToDisk: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../components/Launchpad/LaunchpadWizard', () => ({
  __esModule: true,
  default: () => <div data-testid="launchpad-wizard" />,
}));

describe('WelcomeScreen demo project entry', () => {
  beforeEach(() => {
    mockProjects = [];
    jest.clearAllMocks();
  });

  it('creates and opens the built-in demo project from the welcome screen', async () => {
    render(<WelcomeScreen />);

    expect(
      screen.getByText(/Build a project memory, generate a Context Passport/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Connect a project folder')).toBeInTheDocument();
    expect(screen.getByText('Generate a Context Passport')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /try demo project/i }));

    await waitFor(() => expect(saveToDisk).toHaveBeenCalledTimes(1));

    const demoProject = (saveToDisk as jest.Mock).mock.calls[0][0] as ProjectMemory;
    expect(demoProject.id).toBe(DEMO_PROJECT_ID);
    expect(demoProject.summary).toContain('Context Passport');
    expect(mockAddProject).toHaveBeenCalledWith(expect.objectContaining({ id: DEMO_PROJECT_ID }));
    expect(mockSetActiveProject).toHaveBeenCalledWith(DEMO_PROJECT_ID);
    expect(mockSetCurrentView).toHaveBeenCalledWith('projects');
    expect(mockShowToast).toHaveBeenCalledWith(
      'Demo project ready. Generate a Context Passport to see the handoff.',
    );
  });

  it('opens an existing demo project instead of overwriting it', async () => {
    mockProjects = [{ id: DEMO_PROJECT_ID, name: 'Existing demo' } as ProjectMemory];

    render(<WelcomeScreen />);

    fireEvent.click(screen.getByRole('button', { name: /try demo project/i }));

    await waitFor(() => expect(mockSetActiveProject).toHaveBeenCalledWith(DEMO_PROJECT_ID));
    expect(saveToDisk).not.toHaveBeenCalled();
    expect(mockAddProject).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      'Demo project opened. Generate a Context Passport to try the handoff.',
    );
  });

  it('prioritizes selecting a project folder and demotes Memephant project import', () => {
    render(<WelcomeScreen />);

    fireEvent.click(screen.getByRole('button', { name: /Select Folder/i }));

    expect(createProjectFromFolder).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /Import Memephant Project/i })).toBeInTheDocument();
    expect(screen.queryByText(/Import project JSON/i)).not.toBeInTheDocument();
  });
});
