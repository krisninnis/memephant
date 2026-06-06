import { formatForPlatform } from '../utils/exportFormatters';
import { generateBuildUpdate } from '../utils/buildUpdateGenerator';
import { generateContextPassport } from '../utils/passportGenerator';
import { generateLaunchPassport } from '../utils/launchPassportGenerator';
import { createDefaultProjectBlueprintInput, createProjectFromBlueprint } from '../utils/projectBlueprintGenerator';
import { normalizeOldProject } from '../utils/normalizeOldProject';
import type { ProjectMemory } from '../types/memphant-types';

const FAKE_SECRET = ['sk', 'abcdefghijklmnopqrstuvwxyz123456'].join('-');

const gameProject: ProjectMemory = {
  schema_version: '1.2.0',
  id: 'game-project',
  name: 'Flood Farm Tycoon',
  summary: 'A Roblox survival tycoon where players build a farm before flood waves arrive.',
  currentState: 'Basic map, door interaction, and one flood timer are playable.',
  goals: ['Make the flood loop fun', 'Run a five-player playtest'],
  rules: ['Keep Roblox scripts lightweight in exports'],
  decisions: [],
  nextSteps: ['Fix door pivot bug', 'Add animal collection rewards'],
  openQuestions: ['Is the round length too long?'],
  importantAssets: [],
  changelog: [
    {
      timestamp: '2026-06-01T10:00:00.000Z',
      field: 'gameplay',
      action: 'added',
      summary: 'Added flood timer prototype.',
    },
  ],
  checkpoints: [],
  platformState: {},
  workflowMode: 'debug',
  projectCategory: 'game',
  gamePlatform: 'roblox',
  gameContext: {
    overview: {
      genre: 'Survival tycoon',
      coreLoop: 'Build base, defend waves, earn currency, upgrade systems',
      targetPlayer: 'Roblox players who enjoy cooperative base building',
      artStyle: 'Bright low-poly farm',
      platformTarget: 'Roblox mobile and desktop',
      monetisationPlan: 'Optional gamepasses for cosmetics and boosts',
      currentPlayableState: 'Basic map and door system working',
    },
    systems: {
      movement: 'Default Roblox character movement with sprint planned.',
      savingProgression: 'DataStores planned for currency, pets, and unlocked doors.',
    },
    knownBugs: [
      {
        title: 'Door pivots upward instead of sideways',
        systemAffected: 'Door interaction',
        reproductionNotes: 'Open the barn door twice after round 1.',
        currentTheory: 'Hinge axis is wrong.',
        status: 'Open',
      },
    ],
    scriptVault: [
      {
        scriptName: 'NPCSpawner.lua',
        platformLanguage: 'Luau',
        purpose: 'Spawns enemy waves',
        relatedSystem: 'NPC waves',
        status: 'Buggy after round 5',
        notes: 'Duplicates enemies after round 5.',
        codeSnippet: `local apiKey = "${FAKE_SECRET}"`,
        includeInContextPassport: true,
      },
    ],
  },
};

describe('game project support', () => {
  it('normalizes optional game metadata without requiring a migration', () => {
    const normalized = normalizeOldProject(JSON.parse(JSON.stringify(gameProject)));

    expect(normalized.projectCategory).toBe('game');
    expect(normalized.gamePlatform).toBe('roblox');
    expect(normalized.gameContext?.overview?.coreLoop).toContain('Build base');
    expect(normalized.gameContext?.scriptVault?.[0]?.scriptName).toBe('NPCSpawner.lua');

    const oldProject = normalizeOldProject({
      ...gameProject,
      projectCategory: 'unknown',
      gamePlatform: 'not-a-platform',
      gameContext: undefined,
    } as Record<string, unknown>);

    expect(oldProject.projectCategory).toBeUndefined();
    expect(oldProject.gamePlatform).toBeUndefined();
    expect(oldProject.gameContext).toBeUndefined();
  });

  it('seeds game projects from Project Blueprint with Roblox defaults', () => {
    const project = createProjectFromBlueprint({
      ...createDefaultProjectBlueprintInput(),
      projectName: 'Wave Ranch',
      idea: 'A Roblox co-op ranch defense game.',
      problem: 'Creators need persistent gameplay and script context when moving between AI tools.',
      targetAudience: 'Roblox game developers',
      desiredOutcome: 'ship a playable wave defense loop',
      projectType: 'game',
      gamePlatform: 'roblox',
    }, '2026-06-05T10:00:00.000Z');

    expect(project.projectCategory).toBe('game');
    expect(project.gamePlatform).toBe('roblox');
    expect(project.gameContext?.overview?.platformTarget).toBe('Roblox');
    expect(project.aiInstructions).toContain('Roblox Studio hierarchy');
  });

  it('adds sanitized game context to Context Passport and platform exports', () => {
    const passport = generateContextPassport(gameProject);
    const exportText = formatForPlatform(gameProject, 'claude', undefined, 'full');

    expect(passport.formats.markdown).toContain('## Game Context');
    expect(passport.formats.markdown).toContain('Platform: Roblox');
    expect(passport.formats.markdown).toContain('NPCSpawner.lua');
    expect(passport.formats.markdown).toContain('Platform/language: Luau');
    expect(passport.formats.markdown).toContain('Spawns enemy waves');
    expect(passport.formats.markdown).toContain('Related system: NPC waves');
    expect(passport.formats.markdown).toContain('Status: Buggy after round 5');
    expect(passport.formats.markdown).toContain('Notes: Duplicates enemies after round 5.');
    expect(passport.formats.markdown).toContain('Code snippet:');
    expect(passport.formats.markdown).toContain('Door pivots upward instead of sideways');
    expect(passport.formats.markdown).toContain('RemoteEvents');
    expect(passport.formats.markdown).not.toContain(FAKE_SECRET);
    expect(passport.formats.claude).toContain('<script_vault>');
    expect(passport.formats.claude).toContain('<code_snippet>local apiKey = "[REDACTED]"</code_snippet>');
    expect(passport.formats.codex).toContain('SCRIPT_VAULT:');
    expect(passport.formats.codex).toContain('CODE_SNIPPET: local apiKey = "[REDACTED]"');
    expect(exportText).toContain('## Game Context');
    expect(exportText).toContain('NPCSpawner.lua');
    expect(exportText).not.toContain(FAKE_SECRET);
  });

  it('keeps Script Vault code snippets out of Context Passport until explicitly included', () => {
    const optedOutProject: ProjectMemory = {
      ...gameProject,
      gameContext: {
        ...gameProject.gameContext,
        scriptVault: gameProject.gameContext?.scriptVault?.map((script) => ({
          ...script,
          includeInContextPassport: false,
        })),
      },
    };

    const passport = generateContextPassport(optedOutProject);

    expect(passport.formats.markdown).toContain('NPCSpawner.lua');
    expect(passport.formats.markdown).toContain('Platform/language: Luau');
    expect(passport.formats.markdown).not.toContain('Code snippet:');
    expect(passport.formats.markdown).not.toContain('local apiKey');
    expect(passport.formats.claude).not.toContain('<code_snippet>');
    expect(passport.formats.codex).not.toContain('CODE_SNIPPET:');
  });

  it('emits script run context in exports only when known', () => {
    const project: ProjectMemory = {
      ...gameProject,
      gameContext: {
        ...gameProject.gameContext,
        scriptVault: [
          { scriptName: 'Foo.server.lua', platformLanguage: 'Luau', runContext: 'Script', runContextBasis: 'filename' },
          { scriptName: 'Bar.client.luau', platformLanguage: 'Luau', runContext: 'LocalScript', runContextBasis: 'filename' },
          { scriptName: 'Baz.lua', platformLanguage: 'Luau', runContext: 'ModuleScript', runContextBasis: 'path' },
          { scriptName: 'Mystery.lua', platformLanguage: 'Luau', runContext: 'Unknown', runContextBasis: 'none' },
          { scriptName: 'Plain.lua', platformLanguage: 'Luau' },
        ],
      },
    };

    const passport = generateContextPassport(project);

    expect(passport.formats.markdown).toContain('Run context: Script');
    expect(passport.formats.markdown).toContain('Run context: LocalScript');
    expect(passport.formats.markdown).toContain('Run context: ModuleScript');
    expect(passport.formats.claude).toContain('<run_context>Script</run_context>');
    expect(passport.formats.claude).toContain('<run_context>LocalScript</run_context>');
    expect(passport.formats.claude).toContain('<run_context>ModuleScript</run_context>');
    expect(passport.formats.codex).toContain('RUN_CONTEXT: Script');
    expect(passport.formats.codex).toContain('RUN_CONTEXT: LocalScript');
    expect(passport.formats.codex).toContain('RUN_CONTEXT: ModuleScript');

    // Unknown / unclassified scripts never emit a run context.
    expect(passport.formats.markdown).not.toContain('Run context: Unknown');
    expect(passport.formats.claude).not.toContain('<run_context>Unknown</run_context>');
    expect(passport.formats.codex).not.toContain('RUN_CONTEXT: Unknown');
  });

  it('uses game-aware workflow guidance for game projects', () => {
    const output = formatForPlatform(gameProject, 'chatgpt', undefined, 'full');

    expect(output).toContain('Mode: Debug Mode');
    expect(output).toContain('broken scripts');
    expect(output).toContain('event flow');
  });

  it('adds game-aware Launch Passport and Build Update sections', () => {
    const launch = generateLaunchPassport(gameProject, '2026-06-05T10:00:00.000Z');
    const buildUpdate = generateBuildUpdate(gameProject, '2026-06-05T10:00:00.000Z');

    expect(launch.markdown).toContain('## Roblox game description');
    expect(launch.markdown).toContain('## Playtest request');
    expect(launch.markdown).toContain('## Discord announcement');
    expect(launch.markdown).toContain('## Monetisation checklist');
    expect(launch.markdown).toContain('Build base, defend waves, earn currency, upgrade systems');
    expect(buildUpdate.markdown).toContain('## Gameplay progress update');
    expect(buildUpdate.markdown).toContain('Scripts in focus: NPCSpawner.lua');
  });
});
