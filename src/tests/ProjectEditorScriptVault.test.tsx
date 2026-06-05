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
    expect(within(updatedVault).getByLabelText('Status')).toHaveValue('Planned');
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
    expect(within(vault).getByLabelText('Related system')).toHaveDisplayValue('Other');
    expect(within(vault).getByLabelText('Custom Related system')).toHaveValue('Door interaction');
    expect(within(vault).getByLabelText('Status')).toHaveValue('Buggy');
    expect(within(vault).getByLabelText('Notes')).toHaveValue('Door pivots upward instead of sideways.');
    expect(within(vault).getByLabelText('Optional code snippet')).toHaveValue('local door = script.Parent');
  });

  it('stores guided preset selections as the final game overview value', () => {
    render(<ProjectEditor />);

    fireEvent.change(screen.getByLabelText('Genre'), { target: { value: 'Tycoon' } });
    fireEvent.change(screen.getByLabelText('Target player'), { target: { value: 'Co-op players' } });
    fireEvent.change(screen.getByLabelText('Art style'), { target: { value: 'Cartoony' } });
    fireEvent.change(screen.getByLabelText('Monetisation plan'), { target: { value: 'Gamepasses' } });
    fireEvent.change(screen.getByLabelText('Current playable state'), { target: { value: 'Prototype' } });
    fireEvent.change(screen.getByLabelText('Core gameplay loop'), {
      target: { value: 'Build base, earn currency, upgrade systems' },
    });

    const project = useProjectStore.getState().projects[0];
    expect(project.gameContext?.overview?.genre).toBe('Tycoon');
    expect(project.gameContext?.overview?.targetPlayer).toBe('Co-op players');
    expect(project.gameContext?.overview?.artStyle).toBe('Cartoony');
    expect(project.gameContext?.overview?.monetisationPlan).toBe('Gamepasses');
    expect(project.gameContext?.overview?.currentPlayableState).toBe('Prototype');
    expect(project.gameContext?.overview?.coreLoop).toBe('Build base, earn currency, upgrade systems');
  });

  it('renders old custom game overview and bug status values through Other inputs', () => {
    useProjectStore.setState({
      projects: [{
        ...baseProject,
        gameContext: {
          ...baseProject.gameContext,
          overview: {
            ...baseProject.gameContext?.overview,
            genre: 'Survival tycoon',
            coreLoop: 'Farm animals, sell milk, survive flood rounds',
          },
          knownBugs: [
            {
              id: 'bug-1',
              title: 'Barn door clips',
              status: 'Needs designer check',
            },
          ],
        },
      }],
      activeProjectId: baseProject.id,
    });

    render(<ProjectEditor />);

    expect(screen.getByLabelText('Genre')).toHaveDisplayValue('Other');
    expect(screen.getByLabelText('Custom Genre')).toHaveValue('Survival tycoon');
    expect(screen.getByLabelText('Core gameplay loop')).toHaveDisplayValue('Other');
    expect(screen.getByLabelText('Custom Core gameplay loop')).toHaveValue(
      'Farm animals, sell milk, survive flood rounds',
    );
    expect(screen.getByLabelText('Status')).toHaveDisplayValue('Other');
    expect(screen.getByLabelText('Custom Status')).toHaveValue('Needs designer check');
  });
});
