import type { AIWorkflowMode } from '../types/memphant-types';

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

export function isAIWorkflowMode(value: unknown): value is AIWorkflowMode {
  return typeof value === 'string' && WORKFLOW_MODE_BY_ID.has(value as AIWorkflowMode);
}

export function getWorkflowModeConfig(mode: AIWorkflowMode | undefined): WorkflowModeConfig | null {
  return mode ? WORKFLOW_MODE_BY_ID.get(mode) ?? null : null;
}

export function getWorkflowModeExportBlock(mode: AIWorkflowMode | undefined): string | null {
  const config = getWorkflowModeConfig(mode);
  if (!config) return null;

  return [
    '# AI Workflow Mode',
    `Mode: ${config.label}`,
    `Focus: ${config.focus}.`,
    `Guidance: ${config.guidance}`,
  ].join('\n');
}
