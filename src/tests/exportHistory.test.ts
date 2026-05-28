import {
  compareCurrentProjectToExport,
  getChangesSinceExport,
  getExportHistory,
} from '../utils/exportHistory';
import type { ProjectCheckpoint, ProjectMemory } from '../types/memphant-types';

const snapshot = {
  schema_version: '1.2.0',
  id: 'history-project',
  name: 'History Project',
  summary: 'Old summary',
  goals: ['Old goal'],
  rules: [],
  decisions: [],
  currentState: 'Old state',
  nextSteps: ['Old next step'],
  openQuestions: [],
  importantAssets: [],
  changelog: [],
  platformState: {},
  workflowMode: 'build' as const,
};

const checkpoint: ProjectCheckpoint = {
  id: 'checkpoint-1',
  platform: 'claude',
  timestamp: '2026-05-28T10:00:00.000Z',
  summary: 'Exported old state',
  snapshot,
  hash: 'hash-1',
};

const project: ProjectMemory = {
  ...snapshot,
  summary: 'New summary',
  currentState: 'New state',
  goals: ['Old goal', 'New goal'],
  nextSteps: ['New next step'],
  workflowMode: 'launch',
  checkpoints: [checkpoint],
  changelog: [
    {
      timestamp: '2026-05-28T11:00:00.000Z',
      field: 'goals',
      action: 'added',
      summary: 'Added Launch Passport polish.',
    },
  ],
};

describe('exportHistory', () => {
  it('maps checkpoints into newest-first export history items', () => {
    const history = getExportHistory(project);

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      id: 'checkpoint-1',
      platform: 'claude',
      exportType: 'Project context export',
      workflowModeLabel: 'Build Mode',
    });
  });

  it('compares current project state to an export snapshot', () => {
    const comparison = compareCurrentProjectToExport(project, checkpoint);

    expect(comparison.filter((item) => item.changed).map((item) => item.field))
      .toEqual(['summary', 'currentState', 'goals', 'nextSteps', 'workflowMode']);
    expect(comparison.find((item) => item.field === 'workflowMode')).toMatchObject({
      before: 'Build Mode',
      after: 'Launch Mode',
    });
  });

  it('summarizes changelog entries since the selected export', () => {
    expect(getChangesSinceExport(project, checkpoint)).toEqual([
      'Added Launch Passport polish.',
    ]);
  });
});
