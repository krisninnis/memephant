import type {
  GamePlatform,
  GameProjectContext,
  GameSystemKey,
  ProjectCategory,
  ProjectMemory,
} from '../types/memphant-types';

export const PROJECT_CATEGORY_OPTIONS: Array<{ value: ProjectCategory; label: string }> = [
  { value: 'general-software', label: 'General Software' },
  { value: 'website', label: 'Website' },
  { value: 'saas', label: 'SaaS' },
  { value: 'desktop-app', label: 'Desktop App' },
  { value: 'mobile-app', label: 'Mobile App' },
  { value: 'game', label: 'Game' },
  { value: 'content-project', label: 'Content Project' },
  { value: 'other', label: 'Other' },
];

export const GAME_PLATFORM_OPTIONS: Array<{ value: GamePlatform; label: string }> = [
  { value: 'roblox', label: 'Roblox' },
  { value: 'unity', label: 'Unity' },
  { value: 'unreal', label: 'Unreal Engine' },
  { value: 'godot', label: 'Godot' },
  { value: 'gamemaker', label: 'GameMaker' },
  { value: 'construct', label: 'Construct' },
  { value: 'rpg-maker', label: 'RPG Maker' },
  { value: 'uefn', label: 'Fortnite Creative / UEFN' },
  { value: 'core', label: 'Core' },
  { value: 'sbox', label: 'S&box' },
  { value: 'defold', label: 'Defold' },
  { value: 'other', label: 'Other' },
];

export const GAME_SYSTEM_OPTIONS: Array<{ value: GameSystemKey; label: string }> = [
  { value: 'movement', label: 'Movement' },
  { value: 'combat', label: 'Combat' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'economy', label: 'Economy' },
  { value: 'quests', label: 'Quests' },
  { value: 'npcs', label: 'NPCs' },
  { value: 'ui', label: 'UI' },
  { value: 'multiplayer', label: 'Multiplayer' },
  { value: 'savingProgression', label: 'Saving/progression' },
  { value: 'monetisation', label: 'Monetisation' },
  { value: 'analyticsPlaytesting', label: 'Analytics/playtesting' },
];

export const ROBLOX_CONTEXT_PROMPTS = [
  'Roblox Studio hierarchy',
  'Lua / Luau scripts',
  'LocalScripts',
  'ModuleScripts',
  'RemoteEvents',
  'BindableEvents',
  'DataStores',
  'ReplicatedStorage',
  'ServerScriptService',
  'StarterGui',
  'Workspace',
  'game loop',
  'player progression',
  'monetisation/gamepasses',
  'thumbnails/icons',
  'playtesting feedback',
  'known bugs',
];

export const GAME_PLATFORM_LINKS: Record<GamePlatform, Array<{ label: string; url: string }>> = {
  roblox: [{ label: 'Roblox Creator Hub', url: 'https://create.roblox.com/docs' }],
  unity: [{ label: 'Unity Learn', url: 'https://learn.unity.com/' }],
  unreal: [{ label: 'Unreal Engine docs', url: 'https://dev.epicgames.com/documentation/en-us/unreal-engine' }],
  godot: [{ label: 'Godot docs', url: 'https://docs.godotengine.org/' }],
  gamemaker: [{ label: 'GameMaker manual', url: 'https://manual.gamemaker.io/' }],
  construct: [{ label: 'Construct manual', url: 'https://www.construct.net/en/make-games/manuals/construct-3' }],
  'rpg-maker': [{ label: 'RPG Maker docs', url: 'https://www.rpgmakerweb.com/support' }],
  uefn: [{ label: 'UEFN docs', url: 'https://dev.epicgames.com/documentation/en-us/uefn' }],
  core: [{ label: 'Core docs', url: 'https://docs.coregames.com/' }],
  sbox: [{ label: 'S&box docs', url: 'https://sbox.game/dev/doc/' }],
  defold: [{ label: 'Defold manual', url: 'https://defold.com/manuals/' }],
  other: [],
};

export function isProjectCategory(value: unknown): value is ProjectCategory {
  return PROJECT_CATEGORY_OPTIONS.some((option) => option.value === value);
}

export function isGamePlatform(value: unknown): value is GamePlatform {
  return GAME_PLATFORM_OPTIONS.some((option) => option.value === value);
}

export function getProjectCategoryLabel(
  category: ProjectCategory | undefined,
  other?: string,
): string {
  if (category === 'other' && other?.trim()) return other.trim();
  return PROJECT_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? 'General Software';
}

export function getGamePlatformLabel(
  platform: GamePlatform | undefined,
  other?: string,
): string {
  if (platform === 'other' && other?.trim()) return other.trim();
  return GAME_PLATFORM_OPTIONS.find((option) => option.value === platform)?.label ?? 'Roblox';
}

export function isGameProject(project: Pick<ProjectMemory, 'projectCategory' | 'gamePlatform' | 'gameContext'>): boolean {
  return project.projectCategory === 'game' || Boolean(project.gamePlatform || project.gameContext);
}

export function createDefaultGameContext(platform: GamePlatform = 'roblox'): GameProjectContext {
  if (platform === 'roblox') {
    return {
      overview: {
        platformTarget: 'Roblox',
      },
      systems: {
        multiplayer: 'Track RemoteEvents, BindableEvents, server/client boundaries, and replication assumptions.',
        savingProgression: 'Track DataStores, player progression, save timing, and rollback risks.',
        monetisation: 'Track gamepasses, developer products, premium payouts, and player-facing value.',
        ui: 'Track StarterGui screens, prompts, HUD, thumbnails/icons, and playtest feedback.',
      },
      knownBugs: [],
      scriptVault: [],
    };
  }

  return {
    overview: {
      platformTarget: getGamePlatformLabel(platform),
    },
    systems: {},
    knownBugs: [],
    scriptVault: [],
  };
}
