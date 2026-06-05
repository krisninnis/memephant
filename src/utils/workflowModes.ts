import type { AIWorkflowMode, ProjectMemory } from '../types/memphant-types';

export type WorkflowModeConfig = {
  id: AIWorkflowMode;
  label: string;
  focus: string;
  guidance: string;
  recommendedFor: string;
};

export const WORKFLOW_MODES: WorkflowModeConfig[] = [
  {
    id: 'build',
    label: 'Build Mode',
    focus: 'implementation, architecture, shipping, and execution',
    guidance: 'Prioritise concrete implementation steps, trade-offs, and shippable next actions.',
    recommendedFor: 'building features or planning technical work',
  },
  {
    id: 'debug',
    label: 'Debug Mode',
    focus: 'troubleshooting, logs, reproduction steps, and root-cause isolation',
    guidance: 'Prioritise evidence, reproduction steps, likely causes, and narrow fixes.',
    recommendedFor: 'finding and fixing broken behaviour',
  },
  {
    id: 'launch',
    label: 'Launch Mode',
    focus: 'marketing, onboarding, demo clarity, and launch prep',
    guidance: 'Prioritise clear positioning, user trust, launch assets, and first-user feedback.',
    recommendedFor: 'preparing demos, launches, and public updates',
  },
  {
    id: 'research',
    label: 'Research Mode',
    focus: 'exploration, learning, comparison, and analysis',
    guidance: 'Prioritise options, assumptions, evidence, comparisons, and open questions.',
    recommendedFor: 'evaluating approaches before committing',
  },
  {
    id: 'investor',
    label: 'Investor Mode',
    focus: 'business clarity, roadmap, positioning, and traction',
    guidance: 'Prioritise market framing, proof points, risks, roadmap, and business model clarity.',
    recommendedFor: 'pitch, strategy, or traction conversations',
  },
];

const WORKFLOW_MODE_BY_ID = new Map(WORKFLOW_MODES.map((mode) => [mode.id, mode]));

const GAME_WORKFLOW_MODE_OVERRIDES: Partial<Record<AIWorkflowMode, Pick<WorkflowModeConfig, 'focus' | 'guidance' | 'recommendedFor'>>> = {
  build: {
    focus: 'gameplay systems, scripts, maps, UI, mechanics, and feature implementation',
    guidance: 'Prioritise playable loops, system boundaries, script responsibilities, map changes, UI states, and shippable gameplay tasks.',
    recommendedFor: 'building mechanics, game systems, scripts, levels, or UI',
  },
  debug: {
    focus: 'reproduction steps, output errors, broken scripts, events, saving, and system interactions',
    guidance: 'Prioritise exact repro steps, console/output evidence, client/server boundaries, event flow, save state, and the smallest script fix.',
    recommendedFor: 'finding and fixing broken gameplay, scripts, saves, or events',
  },
  launch: {
    focus: 'playtesting, thumbnails, descriptions, retention, monetisation, updates, and feedback',
    guidance: 'Prioritise playtest questions, store/game-page clarity, thumbnail and icon readiness, retention hooks, monetisation fit, and feedback capture.',
    recommendedFor: 'preparing playtests, game launches, updates, and public devlogs',
  },
};

export function isAIWorkflowMode(value: unknown): value is AIWorkflowMode {
  return typeof value === 'string' && WORKFLOW_MODE_BY_ID.has(value as AIWorkflowMode);
}

export function getWorkflowModeConfig(mode: AIWorkflowMode | undefined): WorkflowModeConfig | null {
  return mode ? WORKFLOW_MODE_BY_ID.get(mode) ?? null : null;
}

export function getWorkflowModeConfigForProject(
  mode: AIWorkflowMode | undefined,
  project?: Pick<ProjectMemory, 'projectCategory'>,
): WorkflowModeConfig | null {
  const config = getWorkflowModeConfig(mode);
  if (!config || project?.projectCategory !== 'game') return config;

  const override = GAME_WORKFLOW_MODE_OVERRIDES[config.id];
  return override ? { ...config, ...override } : config;
}

export function getWorkflowModeExportBlock(
  mode: AIWorkflowMode | undefined,
  project?: Pick<ProjectMemory, 'projectCategory'>,
): string | null {
  const config = getWorkflowModeConfigForProject(mode, project);
  if (!config) return null;

  return [
    '# AI Workflow Mode',
    `Mode: ${config.label}`,
    `Focus: ${config.focus}.`,
    `Guidance: ${config.guidance}`,
  ].join('\n');
}
