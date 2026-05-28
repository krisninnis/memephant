import { formatForPlatform } from '../utils/exportFormatters';
import { generateContextPassport } from '../utils/passportGenerator';
import { generateLaunchPassport } from '../utils/launchPassportGenerator';
import { normalizeOldProject } from '../utils/normalizeOldProject';
import type { ProjectMemory } from '../types/memphant-types';

const project: ProjectMemory = {
  schema_version: '1.2.0',
  id: 'workflow-mode-project',
  name: 'Workflow Mode Project',
  summary: 'A serious AI-assisted project.',
  currentState: 'Ready for the next focused session.',
  goals: ['Ship the MVP'],
  rules: ['Keep exports deterministic'],
  decisions: [],
  nextSteps: ['Implement the selector'],
  openQuestions: [],
  importantAssets: [],
  changelog: [],
  checkpoints: [],
  platformState: {},
  workflowMode: 'debug',
};

describe('AI Workflow Modes', () => {
  it('adds selected workflow mode context to platform exports', () => {
    const output = formatForPlatform(project, 'claude', undefined, 'full');

    expect(output).toContain('# AI Workflow Mode');
    expect(output).toContain('Mode: Debug Mode');
    expect(output).toContain('root-cause isolation');
    expect(output).toContain('Prioritise evidence');
  });

  it('adds selected workflow mode context to Context Passports', () => {
    const passport = generateContextPassport(project);

    expect(passport.formats.markdown).toContain('## AI Workflow Mode');
    expect(passport.formats.markdown).toContain('**Debug Mode**');
    expect(passport.formats.claude).toContain('<workflow_mode>');
    expect(passport.formats.codex).toContain('WORKFLOW_MODE: Debug Mode');
  });

  it('uses the workflow mode in Launch Passport drafts', () => {
    const passport = generateLaunchPassport({
      ...project,
      workflowMode: 'launch',
    }, '2026-05-28T12:00:00.000Z');

    expect(passport.markdown).toContain('Workflow mode: Launch Mode');
    expect(passport.markdown).toContain('Current working lens: Launch Mode');
  });

  it('normalizes valid workflow modes and ignores unknown values', () => {
    expect(normalizeOldProject({
      ...project,
      workflowMode: 'research',
    }).workflowMode).toBe('research');

    expect(normalizeOldProject({
      ...project,
      workflowMode: 'agent-army',
    } as Record<string, unknown>).workflowMode).toBeUndefined();
  });
});
