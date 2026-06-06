import type {
  GamePlatform,
  ProjectMemory,
  ProjectWorkspaceType,
} from '../types/memphant-types';
import { createDefaultGameContext } from './gameProjectTypes';

export type WorkspaceTypeOption = {
  id: ProjectWorkspaceType;
  title: string;
  icon: string;
  description: string;
  enabledTools: string[];
};

export const WORKSPACE_TYPE_OPTIONS: WorkspaceTypeOption[] = [
  {
    id: 'ai',
    title: 'AI Project',
    icon: 'AI',
    description: 'For planning, research, writing, business ideas, and general AI continuity.',
    enabledTools: ['Context Passport', 'Summary', 'Goals', 'Rules', 'Decisions', 'Memory Core'],
  },
  {
    id: 'software',
    title: 'Software Project',
    icon: '{ }',
    description: 'For websites, apps, APIs, coding projects, VS Code, and Cursor workflows.',
    enabledTools: ['Context Passport', 'Linked Folder', 'Scan Results', 'Important Files', 'Developer exports'],
  },
  {
    id: 'game',
    title: 'Game Project',
    icon: 'GAME',
    description: 'For Roblox, Unity, Unreal, Godot, and game development projects.',
    enabledTools: ['Linked Folder', 'Game Platform', 'Game Systems', 'Known Bugs', 'Script Vault'],
  },
  {
    id: 'jobHunt',
    title: 'Job Hunt',
    icon: 'CV',
    description: 'For CVs, job tracking, interview prep, and applications.',
    enabledTools: ['Job Hunt Passport', 'Profile', 'Job Tracker', 'Paste Jobs', 'Interview Prep'],
  },
];

export function isProjectWorkspaceType(value: unknown): value is ProjectWorkspaceType {
  return value === 'ai' || value === 'software' || value === 'game' || value === 'jobHunt';
}

export function getWorkspaceTypeOption(type: ProjectWorkspaceType): WorkspaceTypeOption {
  return WORKSPACE_TYPE_OPTIONS.find((option) => option.id === type) ?? WORKSPACE_TYPE_OPTIONS[0];
}

export function getWorkspaceTypeLabel(type: ProjectWorkspaceType): string {
  return getWorkspaceTypeOption(type).title;
}

export function resolveProjectWorkspaceType(
  project?: Pick<
    ProjectMemory,
    | 'workspaceType'
    | 'projectCategory'
    | 'gamePlatform'
    | 'gameContext'
    | 'linkedFolder'
    | 'githubRepo'
    | 'scanInfo'
    | 'detectedStack'
    | 'importantAssets'
  > | null,
): ProjectWorkspaceType {
  if (!project) return 'ai';
  if (isProjectWorkspaceType(project.workspaceType)) return project.workspaceType;
  if (project.projectCategory === 'game' || project.gamePlatform || project.gameContext) return 'game';
  if (
    project.linkedFolder ||
    project.githubRepo?.trim() ||
    project.scanInfo ||
    (project.detectedStack?.length ?? 0) > 0
  ) {
    return 'software';
  }

  return 'ai';
}

export function getWorkspaceDefaults(
  workspaceType: ProjectWorkspaceType,
  gamePlatform: GamePlatform = 'roblox',
): Partial<ProjectMemory> {
  if (workspaceType === 'game') {
    return {
      workspaceType,
      projectCategory: 'game',
      gamePlatform,
      gameContext: createDefaultGameContext(gamePlatform),
    };
  }

  if (workspaceType === 'software') {
    return {
      workspaceType,
      projectCategory: 'general-software',
    };
  }

  return { workspaceType };
}
