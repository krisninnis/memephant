import type { ProjectMemory } from '../types/memphant-types';
import { normalizeOldProject as normalizeProjectUtility } from '../utils/normalizeOldProject';
import {
  getWorkspaceDefaults,
  resolveProjectWorkspaceType,
} from '../utils/workspaceTypes';

const baseProject: ProjectMemory = {
  schema_version: '1.2.0',
  id: 'workspace-project',
  name: 'Workspace Project',
  summary: 'A project.',
  currentState: '',
  goals: [],
  rules: [],
  decisions: [],
  nextSteps: [],
  openQuestions: [],
  importantAssets: [],
  changelog: [],
  checkpoints: [],
  platformState: {},
};

describe('workspace type resolution', () => {
  it('maps explicit workspace types without changing project data', () => {
    expect(resolveProjectWorkspaceType({ ...baseProject, workspaceType: 'ai' })).toBe('ai');
    expect(resolveProjectWorkspaceType({ ...baseProject, workspaceType: 'software' })).toBe('software');
    expect(resolveProjectWorkspaceType({ ...baseProject, workspaceType: 'game' })).toBe('game');
    expect(resolveProjectWorkspaceType({ ...baseProject, workspaceType: 'jobHunt' })).toBe('jobHunt');
  });

  it('safely infers old projects from existing metadata', () => {
    expect(resolveProjectWorkspaceType({ ...baseProject, projectCategory: 'game' })).toBe('game');
    expect(resolveProjectWorkspaceType({
      ...baseProject,
      linkedFolder: { scanHash: 'abc', lastScannedAt: '2026-06-06T10:00:00.000Z' },
    })).toBe('software');
    expect(resolveProjectWorkspaceType({ ...baseProject, githubRepo: 'https://github.com/example/app' })).toBe('software');
    expect(resolveProjectWorkspaceType(baseProject)).toBe('ai');
  });

  it('normalizes existing projects without requiring a destructive migration', () => {
    expect(normalizeProjectUtility({ ...baseProject, projectCategory: 'game' } as unknown as Record<string, unknown>).workspaceType).toBe('game');
    expect(normalizeProjectUtility({
      ...baseProject,
      linkedFolder: { scanHash: 'abc', lastScannedAt: '2026-06-06T10:00:00.000Z' },
    } as unknown as Record<string, unknown>).workspaceType).toBe('software');
    expect(normalizeProjectUtility(baseProject as unknown as Record<string, unknown>).workspaceType).toBe('ai');
  });

  it('seeds game projects with game category and default game context', () => {
    const defaults = getWorkspaceDefaults('game');

    expect(defaults.workspaceType).toBe('game');
    expect(defaults.projectCategory).toBe('game');
    expect(defaults.gamePlatform).toBe('roblox');
    expect(defaults.gameContext?.overview?.platformTarget).toBe('Roblox');
  });
});
