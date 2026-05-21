import { searchProjectMemory } from '../utils/searchProjectMemory';
import type { ProjectMemory } from '../types/memphant-types';

function makeProject(overrides: Partial<ProjectMemory>): ProjectMemory {
  return {
    schema_version: '1.2.0',
    id: 'project-1',
    name: 'Default Project',
    summary: '',
    goals: [],
    rules: [],
    decisions: [],
    currentState: '',
    nextSteps: [],
    openQuestions: [],
    importantAssets: [],
    changelog: [],
    checkpoints: [],
    platformState: {},
    ...overrides,
  };
}

describe('searchProjectMemory', () => {
  it('finds project name matches', () => {
    const projects = [
      makeProject({ id: 'launchpad', name: 'LaunchPad CRM' }),
    ];

    const results = searchProjectMemory(projects, 'launchpad');

    expect(results[0]).toMatchObject({
      projectId: 'launchpad',
      projectName: 'LaunchPad CRM',
      section: 'Project',
      snippet: 'LaunchPad CRM',
    });
  });

  it('finds goals, decisions, and rules', () => {
    const projects = [
      makeProject({
        id: 'memephant',
        name: 'Memephant',
        goals: ['Improve fresh ChatGPT handoffs'],
        decisions: [{ decision: 'Use local-only search for privacy' }],
        rules: ['Never sync search queries'],
      }),
    ];

    expect(searchProjectMemory(projects, 'handoffs')[0].section).toBe('Goal');
    expect(searchProjectMemory(projects, 'local-only')[0].section).toBe('Decision');
    expect(searchProjectMemory(projects, 'queries')[0].section).toBe('Rule');
  });

  it('ranks project name matches above deep matches', () => {
    const projects = [
      makeProject({
        id: 'deep',
        name: 'Planning Notes',
        goals: ['LaunchPad onboarding work'],
      }),
      makeProject({
        id: 'name',
        name: 'LaunchPad CRM',
        summary: 'A simple CRM.',
      }),
    ];

    const results = searchProjectMemory(projects, 'LaunchPad');

    expect(results[0].projectId).toBe('name');
    expect(results[0].section).toBe('Project');
  });

  it('returns useful snippets around the match', () => {
    const projects = [
      makeProject({
        currentState:
          'This project has a long current state with many details before the reminder workflow and many details after it.',
      }),
    ];

    const [result] = searchProjectMemory(projects, 'reminder workflow');

    expect(result.snippet).toContain('reminder workflow');
    expect(result.snippet.length).toBeLessThanOrEqual(102);
  });

  it('returns no results for an empty query', () => {
    const projects = [makeProject({ name: 'Memephant' })];

    expect(searchProjectMemory(projects, '')).toEqual([]);
    expect(searchProjectMemory(projects, '   ')).toEqual([]);
  });

  it('does not mutate project objects', () => {
    const project = makeProject({
      goals: ['Keep search local'],
      importantAssets: ['src/utils/searchProjectMemory.ts'],
    });
    const before = JSON.stringify(project);

    searchProjectMemory([project], 'search');

    expect(JSON.stringify(project)).toBe(before);
  });
});
