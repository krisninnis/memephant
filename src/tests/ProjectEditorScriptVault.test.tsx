import { fireEvent, render, screen, within } from '@testing-library/react';
import ProjectEditor from '../components/Editor/ProjectEditor';
import { useProjectStore } from '../store/projectStore';
import type { ProjectMemory } from '../types/memphant-types';

jest.mock('../services/tauriActions', () => ({
  restoreProjectFromHistory: jest.fn(async () => undefined),
}));

jest.mock('../hooks/useRecentActivity', () => ({
  useRecentActivity: () => ({ markdown: '', loading: false, error: null }),
}));

const baseProject: ProjectMemory = {
  schema_version: '1.2.0',
  id: 'script-vault-ui-project',
  name: 'Script Vault UI Project',
  summary: 'A Roblox game project.',
  currentState: 'Game fields are being edited.',
  goals: [],
  rules: [],
  decisions: [],
  nextSteps: [],
  openQuestions: [],
  importantAssets: [],
  changelog: [],
  checkpoints: [],
  platformState: {},
  projectCategory: 'game',
  gamePlatform: 'roblox',
  gameContext: {
    overview: { platformTarget: 'Roblox' },
    systems: {},
    knownBugs: [],
    scriptVault: [],
  },
};

describe('ProjectEditor Script Vault', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: [baseProject],
      activeProjectId: baseProject.id,
    });
  });

  it('renders a clear empty state and creates an editable script record', () => {
    render(<ProjectEditor />);

    const vault = screen.getByRole('region', { name: 'Script Vault' });
    expect(within(vault).getByRole('heading', { name: 'Important scripts' })).toBeInTheDocument();
    expect(within(vault).getByText(
      'Store important scripts here as context. This is not an IDE or Git replacement.',
    )).toBeInTheDocument();
    expect(within(vault).getByText(/LocalScripts, ModuleScripts, ServerScriptService/i)).toBeInTheDocument();
    expect(within(vault).getByText('No scripts stored yet.')).toBeInTheDocument();

    fireEvent.click(within(vault).getByRole('button', { name: 'Add first script' }));

    const updatedVault = screen.getByRole('region', { name: 'Script Vault' });
    expect(within(updatedVault).getByLabelText('Script name')).toBeInTheDocument();
    expect(within(updatedVault).getByLabelText('Platform/language')).toHaveValue('Luau');
    expect(within(updatedVault).getByLabelText('Purpose')).toBeInTheDocument();
    expect(within(updatedVault).getByLabelText('Related system')).toBeInTheDocument();
    expect(within(updatedVault).getByLabelText('Status')).toHaveValue('Active');
    expect(within(updatedVault).getByLabelText('Notes')).toBeInTheDocument();
    expect(within(updatedVault).getByLabelText('Optional code snippet')).toBeInTheDocument();
  });

  it('renders existing script records as editable fields', () => {
    useProjectStore.setState({
      projects: [{
        ...baseProject,
        gameContext: {
          ...baseProject.gameContext,
          scriptVault: [
            {
              id: 'script-1',
              scriptName: 'DoorController.lua',
              platformLanguage: 'Luau',
              purpose: 'Handles hinge interaction',
              relatedSystem: 'Door interaction',
              status: 'Buggy',
              notes: 'Door pivots upward instead of sideways.',
              codeSnippet: 'local door = script.Parent',
            },
          ],
        },
      }],
      activeProjectId: baseProject.id,
    });

    render(<ProjectEditor />);

    const vault = screen.getByRole('region', { name: 'Script Vault' });
    expect(within(vault).getByLabelText('Script name')).toHaveValue('DoorController.lua');
    expect(within(vault).getByLabelText('Purpose')).toHaveValue('Handles hinge interaction');
    expect(within(vault).getByLabelText('Related system')).toHaveValue('Door interaction');
    expect(within(vault).getByLabelText('Status')).toHaveValue('Buggy');
    expect(within(vault).getByLabelText('Notes')).toHaveValue('Door pivots upward instead of sideways.');
    expect(within(vault).getByLabelText('Optional code snippet')).toHaveValue('local door = script.Parent');
  });
});
