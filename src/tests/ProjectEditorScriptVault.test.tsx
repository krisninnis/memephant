import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import ProjectEditor from '../components/Editor/ProjectEditor';
import { useProjectStore } from '../store/projectStore';
import type { ProjectMemory } from '../types/memphant-types';
import { generateContextPassport } from '../utils/passportGenerator';

jest.mock('../services/tauriActions', () => ({
  getFolderActionLabel: jest.fn(() => 'Select Folder'),
  linkFolder: jest.fn(async () => undefined),
  rescanLinkedFolder: jest.fn(async () => undefined),
  restoreProjectFromHistory: jest.fn(async () => undefined),
  unlinkFolder: jest.fn(async () => undefined),
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
  const clipboardWriteText = jest.fn(async () => undefined);
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });
    clipboardWriteText.mockClear();

    useProjectStore.setState({
      projects: [baseProject],
      activeProjectId: baseProject.id,
    });
  });

  afterAll(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
  });

  it('renders a compact empty summary and creates an editable script record in Script Workspace', () => {
    render(<ProjectEditor />);

    const vault = screen.getByRole('region', { name: 'Script Vault' });
    expect(within(vault).getByRole('heading', { name: 'Important scripts' })).toBeInTheDocument();
    expect(within(vault).getByText(
      'Store important scripts here as context. This is not an IDE or Git replacement.',
    )).toBeInTheDocument();
    expect(within(vault).getByText(/LocalScripts, ModuleScripts, ServerScriptService/i)).toBeInTheDocument();
    expect(within(vault).getByText('No scripts stored yet.')).toBeInTheDocument();

    fireEvent.click(within(vault).getByRole('button', { name: 'Add first script' }));

    const workspace = screen.getByRole('dialog', { name: 'Script Workspace' });
    expect(within(workspace).getByLabelText('Script name')).toBeInTheDocument();
    expect(within(workspace).getByLabelText('Platform/language')).toHaveValue('Luau');
    expect(within(workspace).getByLabelText('Purpose')).toBeInTheDocument();
    expect(within(workspace).getByLabelText('Related system')).toBeInTheDocument();
    expect(within(workspace).getByLabelText('Status')).toHaveValue('Planned');
    expect(within(workspace).getByLabelText('Notes')).toBeInTheDocument();
    expect(within(workspace).getByLabelText('Script content')).toBeInTheDocument();
  });

  it('opens Script Workspace from Script Vault and creates a selected script when empty', () => {
    render(<ProjectEditor />);

    const vault = screen.getByRole('region', { name: 'Script Vault' });
    fireEvent.click(within(vault).getByRole('button', { name: 'Open Script Workspace' }));

    const workspace = screen.getByRole('dialog', { name: 'Script Workspace' });
    expect(within(workspace).getByText('Script context workspace')).toBeInTheDocument();
    expect(within(workspace).getByText(/LocalScripts, ModuleScripts, ServerScriptService/i)).toBeInTheDocument();
    expect(within(workspace).getByRole('button', { name: 'Select script Untitled script' })).toBeInTheDocument();
    expect(within(workspace).getByLabelText('Script content')).toBeInTheDocument();
    expect(within(workspace).getByLabelText('Platform/language')).toHaveValue('Luau');
  });

  it('renders existing script records as a compact summary and opens clicked scripts in Script Workspace', () => {
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
    expect(within(vault).getByText('1')).toBeInTheDocument();
    expect(within(vault).getByText('script stored')).toBeInTheDocument();
    expect(within(vault).getByRole('button', { name: 'Open DoorController.lua in Script Workspace' })).toBeInTheDocument();
    expect(within(vault).queryByLabelText('Script name')).not.toBeInTheDocument();
    expect(within(vault).queryByLabelText('Purpose')).not.toBeInTheDocument();
    expect(within(vault).queryByLabelText('Optional code snippet')).not.toBeInTheDocument();

    fireEvent.click(within(vault).getByRole('button', { name: 'Open DoorController.lua in Script Workspace' }));

    const workspace = screen.getByRole('dialog', { name: 'Script Workspace' });
    expect(within(workspace).getByLabelText('Script name')).toHaveValue('DoorController.lua');
    expect(within(workspace).getByLabelText('Purpose')).toHaveValue('Handles hinge interaction');
    expect(within(workspace).getByLabelText('Related system')).toHaveDisplayValue('Other');
    expect(within(workspace).getByLabelText('Custom Related system')).toHaveValue('Door interaction');
    expect(within(workspace).getByLabelText('Status')).toHaveValue('Buggy');
    expect(within(workspace).getByLabelText('Notes')).toHaveValue('Door pivots upward instead of sideways.');
    expect(within(workspace).getByLabelText('Script content')).toHaveValue('local door = script.Parent');
  });

  it('lists, selects, edits and duplicates existing scripts in Script Workspace', () => {
    useProjectStore.setState({
      projects: [{
        ...baseProject,
        gameContext: {
          ...baseProject.gameContext,
          scriptVault: [
            {
              id: 'script-1',
              scriptName: 'NPCSpawner.lua',
              platformLanguage: 'Luau',
              purpose: 'Spawns enemy waves',
              relatedSystem: 'NPCs',
              status: 'Buggy',
              notes: 'Needs round cap.',
              codeSnippet: 'local spawnCount = 5',
            },
            {
              id: 'script-2',
              scriptName: 'DoorController.lua',
              platformLanguage: 'Roblox Lua custom',
              purpose: 'Handles doors',
              relatedSystem: 'Door Interaction',
              status: 'Working',
              notes: 'Keep hinge side-mounted.',
              codeSnippet: 'local door = script.Parent',
            },
          ],
        },
      }],
      activeProjectId: baseProject.id,
    });

    render(<ProjectEditor />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Script Workspace' }));
    const workspace = screen.getByRole('dialog', { name: 'Script Workspace' });

    expect(within(workspace).getByRole('button', { name: 'Select script NPCSpawner.lua' })).toBeInTheDocument();
    fireEvent.click(within(workspace).getByRole('button', { name: 'Select script DoorController.lua' }));

    expect(within(workspace).getByLabelText('Script content')).toHaveValue('local door = script.Parent');
    expect(within(workspace).getByLabelText('Script name')).toHaveValue('DoorController.lua');
    expect(within(workspace).getByLabelText('Platform/language')).toHaveDisplayValue('Other');
    expect(within(workspace).getByLabelText('Custom Platform/language')).toHaveValue('Roblox Lua custom');

    fireEvent.change(within(workspace).getByLabelText('Script content'), {
      target: { value: 'local door = workspace.Door' },
    });
    fireEvent.change(within(workspace).getByLabelText('Purpose'), {
      target: { value: 'Controls every interactive door' },
    });
    fireEvent.click(within(workspace).getByRole('button', { name: 'Duplicate script' }));

    const scripts = useProjectStore.getState().projects[0].gameContext?.scriptVault ?? [];
    expect(scripts[1]).toEqual(expect.objectContaining({
      scriptName: 'DoorController.lua',
      purpose: 'Controls every interactive door',
      codeSnippet: 'local door = workspace.Door',
    }));
    expect(scripts[2]).toEqual(expect.objectContaining({
      scriptName: 'DoorController copy.lua',
      codeSnippet: 'local door = workspace.Door',
    }));
  });

  it('prompts before adding duplicate placeholder scripts and cancel prevents the duplicate', () => {
    render(<ProjectEditor />);

    const vault = screen.getByRole('region', { name: 'Script Vault' });
    fireEvent.click(within(vault).getByRole('button', { name: 'Add first script' }));
    fireEvent.click(within(screen.getByRole('region', { name: 'Script Vault' })).getByRole('button', { name: 'Add script' }));

    const confirmation = screen.getByRole('dialog', { name: 'Duplicate script confirmation' });
    expect(within(confirmation).getByText('A script named Untitled script already exists.')).toBeInTheDocument();

    fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }));

    const scripts = useProjectStore.getState().projects[0].gameContext?.scriptVault ?? [];
    expect(scripts).toHaveLength(1);
  });

  it('allows a duplicate placeholder script only after confirmation', () => {
    render(<ProjectEditor />);

    fireEvent.click(within(screen.getByRole('region', { name: 'Script Vault' })).getByRole('button', { name: 'Add first script' }));
    fireEvent.click(within(screen.getByRole('region', { name: 'Script Vault' })).getByRole('button', { name: 'Add script' }));

    const confirmation = screen.getByRole('dialog', { name: 'Duplicate script confirmation' });
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Create duplicate' }));

    const scripts = useProjectStore.getState().projects[0].gameContext?.scriptVault ?? [];
    expect(scripts).toHaveLength(2);
    expect(scripts.map((script) => script.scriptName)).toEqual(['', '']);
  });

  it('prompts when renaming a script to a duplicate and cancel keeps the original name', () => {
    useProjectStore.setState({
      projects: [{
        ...baseProject,
        gameContext: {
          ...baseProject.gameContext,
          scriptVault: [
            { id: 'script-1', scriptName: 'NPCSpawner.lua', platformLanguage: 'Luau' },
            { id: 'script-2', scriptName: 'DoorController.lua', platformLanguage: 'Luau' },
          ],
        },
      }],
      activeProjectId: baseProject.id,
    });

    render(<ProjectEditor />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Script Workspace' }));
    const workspace = screen.getByRole('dialog', { name: 'Script Workspace' });
    fireEvent.click(within(workspace).getByRole('button', { name: 'Select script DoorController.lua' }));
    fireEvent.change(within(workspace).getByLabelText('Script name'), { target: { value: 'npcspawner.lua' } });

    const confirmation = screen.getByRole('dialog', { name: 'Duplicate script confirmation' });
    expect(within(confirmation).getByText('A script named NPCSpawner.lua already exists.')).toBeInTheDocument();

    fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }));

    const scripts = useProjectStore.getState().projects[0].gameContext?.scriptVault ?? [];
    expect(scripts.map((script) => script.scriptName)).toEqual(['NPCSpawner.lua', 'DoorController.lua']);
  });

  it('allows renaming to a duplicate only after confirmation', () => {
    useProjectStore.setState({
      projects: [{
        ...baseProject,
        gameContext: {
          ...baseProject.gameContext,
          scriptVault: [
            { id: 'script-1', scriptName: 'NPCSpawner.lua', platformLanguage: 'Luau' },
            { id: 'script-2', scriptName: 'DoorController.lua', platformLanguage: 'Luau' },
          ],
        },
      }],
      activeProjectId: baseProject.id,
    });

    render(<ProjectEditor />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Script Workspace' }));
    const workspace = screen.getByRole('dialog', { name: 'Script Workspace' });
    fireEvent.click(within(workspace).getByRole('button', { name: 'Select script DoorController.lua' }));
    fireEvent.change(within(workspace).getByLabelText('Script name'), { target: { value: 'npcspawner.lua' } });
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Duplicate script confirmation' })).getByRole('button', { name: 'Create duplicate' }));

    const scripts = useProjectStore.getState().projects[0].gameContext?.scriptVault ?? [];
    expect(scripts.map((script) => script.scriptName)).toEqual(['NPCSpawner.lua', 'npcspawner.lua']);
  });

  it('detects path and basename duplicates when renaming scripts', () => {
    useProjectStore.setState({
      projects: [{
        ...baseProject,
        gameContext: {
          ...baseProject.gameContext,
          scriptVault: [
            { id: 'script-1', scriptName: 'NPCSpawner', platformLanguage: 'Luau' },
            { id: 'script-2', scriptName: 'DoorController.lua', platformLanguage: 'Luau' },
          ],
        },
      }],
      activeProjectId: baseProject.id,
    });

    render(<ProjectEditor />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Script Workspace' }));
    const workspace = screen.getByRole('dialog', { name: 'Script Workspace' });
    fireEvent.click(within(workspace).getByRole('button', { name: 'Select script DoorController.lua' }));
    fireEvent.change(within(workspace).getByLabelText('Script name'), { target: { value: 'scripts/npcspawner.lua' } });

    const confirmation = screen.getByRole('dialog', { name: 'Duplicate script confirmation' });
    expect(within(confirmation).getByText('A script named NPCSpawner already exists.')).toBeInTheDocument();
  });

  it('shows duplicate script names distinctly in the compact summary list', () => {
    useProjectStore.setState({
      projects: [{
        ...baseProject,
        gameContext: {
          ...baseProject.gameContext,
          scriptVault: [
            { id: 'script-1', scriptName: 'NPCSpawner.lua', platformLanguage: 'Luau', status: 'Working' },
            { id: 'script-2', scriptName: 'npcspawner.lua', platformLanguage: 'Luau', status: 'Buggy' },
          ],
        },
      }],
      activeProjectId: baseProject.id,
    });

    render(<ProjectEditor />);

    const vault = screen.getByRole('region', { name: 'Script Vault' });
    expect(within(vault).getByRole('button', { name: 'Open NPCSpawner.lua in Script Workspace' })).toBeInTheDocument();
    expect(within(vault).getByRole('button', { name: 'Open npcspawner.lua copy 2 in Script Workspace' })).toBeInTheDocument();
  });

  it('copies scripts and AI help prompts from Script Workspace without execution', async () => {
    useProjectStore.setState({
      projects: [{
        ...baseProject,
        gameContext: {
          ...baseProject.gameContext,
          scriptVault: [
            {
              id: 'script-copy',
              scriptName: 'NPCSpawner.lua',
              platformLanguage: 'Luau',
              purpose: 'Spawns enemy waves',
              relatedSystem: 'NPCs',
              status: 'Buggy',
              notes: 'Duplicates enemies after round 5.',
              codeSnippet: 'local enemy = Instance.new("Model")',
            },
          ],
        },
      }],
      activeProjectId: baseProject.id,
    });

    render(<ProjectEditor />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Script Workspace' }));
    const workspace = screen.getByRole('dialog', { name: 'Script Workspace' });

    fireEvent.click(within(workspace).getByRole('button', { name: 'Copy script' }));
    await waitFor(() => expect(clipboardWriteText).toHaveBeenLastCalledWith('local enemy = Instance.new("Model")'));

    fireEvent.click(within(workspace).getByRole('button', { name: 'Copy AI help prompt' }));
    await waitFor(() => expect(clipboardWriteText).toHaveBeenLastCalledWith(expect.stringContaining('Script name:\nNPCSpawner.lua')));
    expect(clipboardWriteText).toHaveBeenLastCalledWith(expect.stringContaining('Purpose:\nSpawns enemy waves'));
    expect(clipboardWriteText).toHaveBeenLastCalledWith(expect.stringContaining('```lua\nlocal enemy = Instance.new("Model")\n```'));

    fireEvent.click(within(workspace).getByRole('button', { name: 'Copy script context' }));
    await waitFor(() => expect(clipboardWriteText).toHaveBeenLastCalledWith(expect.stringContaining('Script context')));
    expect(clipboardWriteText).toHaveBeenLastCalledWith(expect.stringContaining('Related system: NPCs'));
  });

  it('uses the workspace include toggle before adding full snippets to Context Passport', () => {
    useProjectStore.setState({
      projects: [{
        ...baseProject,
        gameContext: {
          ...baseProject.gameContext,
          scriptVault: [
            {
              id: 'script-passport',
              scriptName: 'SaveService.lua',
              platformLanguage: 'Luau',
              purpose: 'Saves player stats',
              relatedSystem: 'DataStores',
              status: 'Working',
              notes: 'Uses profile service later.',
              codeSnippet: 'local DataStoreService = game:GetService("DataStoreService")',
              includeInContextPassport: false,
            },
          ],
        },
      }],
      activeProjectId: baseProject.id,
    });

    render(<ProjectEditor />);

    let project = useProjectStore.getState().projects[0];
    let passport = generateContextPassport(project);
    expect(passport.formats.markdown).toContain('SaveService.lua');
    expect(passport.formats.markdown).not.toContain('local DataStoreService');

    fireEvent.click(screen.getByRole('button', { name: 'Open Script Workspace' }));
    const workspace = screen.getByRole('dialog', { name: 'Script Workspace' });
    fireEvent.click(within(workspace).getByLabelText('Include full snippet in Context Passport'));

    project = useProjectStore.getState().projects[0];
    passport = generateContextPassport(project);
    expect(project.gameContext?.scriptVault?.[0]?.includeInContextPassport).toBe(true);
    expect(passport.formats.markdown).toContain('local DataStoreService');
  });

  it('does not show Script Workspace for non-game projects', () => {
    useProjectStore.setState({
      projects: [{
        ...baseProject,
        id: 'general-project',
        projectCategory: undefined,
        gamePlatform: undefined,
        gameContext: undefined,
      }],
      activeProjectId: 'general-project',
    });

    render(<ProjectEditor />);

    expect(screen.queryByRole('button', { name: 'Open Script Workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Script Workspace' })).not.toBeInTheDocument();
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

  it('shows connected folder status and actions without exposing the local path', () => {
    useProjectStore.setState({
      projects: [{
        ...baseProject,
        linkedFolder: {
          path: 'C:\\Users\\thoma\\repos\\private-roblox-game',
          scanHash: 'scan-123',
          lastScannedAt: '2026-06-05T10:15:00.000Z',
        },
      }],
      activeProjectId: baseProject.id,
    });

    render(<ProjectEditor />);

    const panel = screen.getByRole('region', { name: 'Connected Folder' });
    expect(within(panel).getByText('Status: Connected')).toBeInTheDocument();
    expect(within(panel).getByText(/Last Scan:/)).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Rescan Folder' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Change Folder' })).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Unlink Folder' })).toBeInTheDocument();
    expect(panel).not.toHaveTextContent('C:\\Users\\thoma\\repos\\private-roblox-game');
  });

  it('renders scan results from linked folder assets without exposing local paths', () => {
    useProjectStore.setState({
      projects: [{
        ...baseProject,
        importantAssets: [
          'README.md',
          'ServerScriptService/NPCSpawner.lua',
          'ReplicatedStorage/DoorController.luau',
          'C:\\Users\\thoma\\repos\\private-roblox-game\\SecretServer.lua',
        ],
        linkedFolder: {
          path: 'C:\\Users\\thoma\\repos\\private-roblox-game',
          scanHash: 'scan-roblox',
          lastScannedAt: '2026-06-05T14:27:00.000Z',
        },
      }],
      activeProjectId: baseProject.id,
    });

    render(<ProjectEditor />);

    const scanResults = screen.getByRole('region', { name: 'Scan Results' });
    expect(within(scanResults).getByText(/Detected Project Type:/)).toHaveTextContent('Roblox');
    expect(within(scanResults).getByText(/Files Analysed:/)).toHaveTextContent('4');
    expect(within(scanResults).getByText(/Scripts Found:/)).toHaveTextContent('3');
    expect(within(scanResults).getByText('README.md')).toBeInTheDocument();
    expect(within(scanResults).getAllByText('NPCSpawner.lua').length).toBeGreaterThan(0);
    expect(within(scanResults).getAllByText('DoorController.luau').length).toBeGreaterThan(0);
    expect(within(scanResults).getAllByText('SecretServer.lua').length).toBeGreaterThan(0);
    expect(scanResults).not.toHaveTextContent('C:\\Users\\thoma');
    expect(scanResults).not.toHaveTextContent('private-roblox-game');
  });

  it('shows a safe empty scan result state when no useful files were stored', () => {
    useProjectStore.setState({
      projects: [{
        ...baseProject,
        importantAssets: [],
        linkedFolder: {
          path: 'C:\\Users\\thoma\\repos\\empty-game',
          scanHash: 'scan-empty',
          lastScannedAt: '2026-06-05T14:27:00.000Z',
        },
      }],
      activeProjectId: baseProject.id,
    });

    render(<ProjectEditor />);

    const scanResults = screen.getByRole('region', { name: 'Scan Results' });
    expect(within(scanResults).getByText('No useful project files found yet.')).toBeInTheDocument();
    expect(within(scanResults).getByText('Try selecting the root folder of your project.')).toBeInTheDocument();
    expect(scanResults).not.toHaveTextContent('C:\\Users\\thoma');
  });

  it('shows Luau Script Vault suggestions and adds one suggested script', () => {
    useProjectStore.setState({
      projects: [{
        ...baseProject,
        importantAssets: [
          'ServerScriptService/NPCSpawner.lua',
          'StarterPlayer/StarterPlayerScripts/ClientInput.luau',
        ],
        linkedFolder: {
          path: 'C:\\Users\\thoma\\repos\\roblox-game',
          scanHash: 'scan-scripts',
          lastScannedAt: '2026-06-05T14:27:00.000Z',
        },
      }],
      activeProjectId: baseProject.id,
    });

    render(<ProjectEditor />);

    const scanResults = screen.getByRole('region', { name: 'Scan Results' });
    expect(within(scanResults).getByRole('region', { name: 'Suggested Script Vault entries' })).toBeInTheDocument();
    expect(within(scanResults).getAllByText('NPCSpawner.lua').length).toBeGreaterThan(0);
    expect(within(scanResults).getAllByText('ClientInput.luau').length).toBeGreaterThan(0);
    expect(within(scanResults).getByText('LocalScript')).toBeInTheDocument();

    fireEvent.click(within(scanResults).getByRole('button', { name: 'Add NPCSpawner.lua to Script Vault' }));

    const project = useProjectStore.getState().projects[0];
    expect(project.gameContext?.scriptVault).toEqual([
      expect.objectContaining({
        scriptName: 'NPCSpawner.lua',
        platformLanguage: 'Luau',
        relatedSystem: 'NPCs',
        status: 'Planned',
        notes: 'Suggested from linked folder scan',
        codeSnippet: '',
      }),
    ]);
  });

  it('adds all new script suggestions without duplicating existing Script Vault records', () => {
    useProjectStore.setState({
      projects: [{
        ...baseProject,
        importantAssets: [
          'ServerScriptService/NPCSpawner.lua',
          'ReplicatedStorage/DoorController.lua',
        ],
        linkedFolder: {
          path: 'C:\\Users\\thoma\\repos\\roblox-game',
          scanHash: 'scan-add-all',
          lastScannedAt: '2026-06-05T14:27:00.000Z',
        },
        gameContext: {
          ...baseProject.gameContext,
          scriptVault: [
            {
              id: 'existing-door',
              scriptName: 'DoorController.lua',
              platformLanguage: 'Luau',
              relatedSystem: 'Door Interaction',
              status: 'Working',
            },
          ],
        },
      }],
      activeProjectId: baseProject.id,
    });

    render(<ProjectEditor />);

    const scanResults = screen.getByRole('region', { name: 'Scan Results' });
    fireEvent.click(within(scanResults).getByRole('button', { name: 'Add all to Script Vault' }));

    const scripts = useProjectStore.getState().projects[0].gameContext?.scriptVault ?? [];
    expect(scripts.map((script) => script.scriptName)).toEqual([
      'DoorController.lua',
      'NPCSpawner.lua',
    ]);
    expect(scripts.filter((script) => script.scriptName === 'DoorController.lua')).toHaveLength(1);
  });

  it('treats case-insensitive basename script suggestions as already added', () => {
    useProjectStore.setState({
      projects: [{
        ...baseProject,
        importantAssets: [
          'ServerScriptService/npcspawner.lua',
          'StarterPlayer/StarterPlayerScripts/ClientInput.luau',
        ],
        linkedFolder: {
          path: 'C:\\Users\\thoma\\repos\\roblox-game',
          scanHash: 'scan-basename-dupes',
          lastScannedAt: '2026-06-05T14:27:00.000Z',
        },
        gameContext: {
          ...baseProject.gameContext,
          scriptVault: [
            {
              id: 'existing-npc',
              scriptName: 'NPCSpawner',
              platformLanguage: 'Luau',
              relatedSystem: 'NPCs',
              status: 'Working',
            },
          ],
        },
      }],
      activeProjectId: baseProject.id,
    });

    render(<ProjectEditor />);

    const scanResults = screen.getByRole('region', { name: 'Scan Results' });
    const suggestions = within(scanResults).getByRole('region', { name: 'Suggested Script Vault entries' });
    expect(within(suggestions).queryByRole('button', { name: 'Add npcspawner.lua to Script Vault' })).not.toBeInTheDocument();
    expect(within(suggestions).getByRole('button', { name: 'Add ClientInput.luau to Script Vault' })).toBeInTheDocument();

    fireEvent.click(within(scanResults).getByRole('button', { name: 'Add all to Script Vault' }));

    const scripts = useProjectStore.getState().projects[0].gameContext?.scriptVault ?? [];
    expect(scripts.map((script) => script.scriptName)).toEqual(['NPCSpawner', 'ClientInput.luau']);
  });
});
