import type { ProjectCheckpoint, ProjectMemory } from '../types/memphant-types';
import { getWorkflowModeConfig } from './workflowModes';

export type ExportHistoryItem = {
  id: string;
  timestamp: string;
  platform: string;
  exportType: string;
  summary: string;
  workflowModeLabel: string;
  checkpoint: ProjectCheckpoint;
};

export type ExportCompareItem = {
  field: 'summary' | 'currentState' | 'goals' | 'nextSteps' | 'workflowMode';
  label: string;
  before: string;
  after: string;
  changed: boolean;
};

const FIELD_LABELS: Record<ExportCompareItem['field'], string> = {
  summary: 'Project summary',
  currentState: 'Current state',
  goals: 'Goals',
  nextSteps: 'Next steps',
  workflowMode: 'Workflow mode',
};

function formatList(items: string[] | undefined): string {
  return items && items.length > 0 ? items.join('; ') : '(none)';
}

function workflowLabel(mode: ProjectMemory['workflowMode']): string {
  return getWorkflowModeConfig(mode)?.label ?? 'Not set';
}

function exportTypeForPlatform(platform: string): string {
  if (platform === 'launch-passport') return 'Launch Kit copy';
  if (platform === 'build-update') return 'Build Update copy';
  if (platform === 'daily-content-pack') return 'Daily Content Pack copy';
  if (platform === 'context-passport') return 'Context Passport copy';
  return 'Project context export';
}

export function getExportHistory(project: ProjectMemory): ExportHistoryItem[] {
  return [...(project.checkpoints ?? [])]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .map((checkpoint) => ({
      id: checkpoint.id,
      timestamp: checkpoint.timestamp,
      platform: checkpoint.platform,
      exportType: exportTypeForPlatform(checkpoint.platform),
      summary: checkpoint.summary || 'Export checkpoint',
      workflowModeLabel: workflowLabel(checkpoint.snapshot.workflowMode),
      checkpoint,
    }));
}

export function compareCurrentProjectToExport(
  project: ProjectMemory,
  checkpoint: ProjectCheckpoint,
): ExportCompareItem[] {
  const snapshot = checkpoint.snapshot;
  const comparisons: ExportCompareItem[] = [
    {
      field: 'summary',
      label: FIELD_LABELS.summary,
      before: snapshot.summary || '(not set)',
      after: project.summary || '(not set)',
      changed: (snapshot.summary || '') !== (project.summary || ''),
    },
    {
      field: 'currentState',
      label: FIELD_LABELS.currentState,
      before: snapshot.currentState || '(not set)',
      after: project.currentState || '(not set)',
      changed: (snapshot.currentState || '') !== (project.currentState || ''),
    },
    {
      field: 'goals',
      label: FIELD_LABELS.goals,
      before: formatList(snapshot.goals),
      after: formatList(project.goals),
      changed: formatList(snapshot.goals) !== formatList(project.goals),
    },
    {
      field: 'nextSteps',
      label: FIELD_LABELS.nextSteps,
      before: formatList(snapshot.nextSteps),
      after: formatList(project.nextSteps),
      changed: formatList(snapshot.nextSteps) !== formatList(project.nextSteps),
    },
    {
      field: 'workflowMode',
      label: FIELD_LABELS.workflowMode,
      before: workflowLabel(snapshot.workflowMode),
      after: workflowLabel(project.workflowMode),
      changed: snapshot.workflowMode !== project.workflowMode,
    },
  ];

  return comparisons;
}

export function getChangesSinceExport(project: ProjectMemory, checkpoint: ProjectCheckpoint): string[] {
  return (project.changelog ?? [])
    .filter((entry) => entry.timestamp > checkpoint.timestamp)
    .map((entry) => entry.summary.trim())
    .filter(Boolean)
    .slice(-6);
}
