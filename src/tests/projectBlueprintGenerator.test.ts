import {
  createDefaultProjectBlueprintInput,
  createProjectFromBlueprint,
  generateProjectBlueprint,
  projectBlueprintToMarkdown,
} from '../utils/projectBlueprintGenerator';
import { normalizeOldProject } from '../utils/normalizeOldProject';

const input = {
  ...createDefaultProjectBlueprintInput(),
  projectName: 'Context Client Hub',
  idea: 'A local-first workspace for carrying client project context between AI tools.',
  problem: 'Freelancers have to re-explain the same client project whenever they switch AI tools.',
  targetAudience: 'Freelancers managing several client projects',
  desiredOutcome: 'continue client work instantly without rebuilding context',
  projectType: 'desktop-app' as const,
  quality: 'production-grade' as const,
  preferredStack: 'Tauri, React, SQLite',
  localFirst: 'yes' as const,
  authentication: 'no' as const,
  payments: 'unsure' as const,
  database: 'yes' as const,
  aiIntegrations: 'yes' as const,
  workingStyle: 'solo-founder' as const,
  primaryAI: 'codex' as const,
};

describe('project blueprint generator', () => {
  it('generates deterministic context-first blueprint outputs', () => {
    const blueprint = generateProjectBlueprint(input, '2026-05-31T10:00:00.000Z');

    expect(blueprint.projectSummary.vision)
      .toContain('Context Client Hub is a Desktop App');
    expect(blueprint.productDefinition.mvpScope).toEqual(expect.arrayContaining([
      expect.stringContaining('local desktop workflow'),
    ]));
    expect(blueprint.recommendedStack).toEqual(expect.arrayContaining([
      'Preferred stack to consider: Tauri, React, SQLite.',
      expect.stringContaining('local first'),
    ]));
    expect(blueprint.folderStructureMarkdown).toContain('.memephant/');
    expect(blueprint.firstTenTasks).toHaveLength(10);
    expect(blueprint.contextPassportSeed).toContain('## Problem');
    expect(projectBlueprintToMarkdown(blueprint)).toContain('## Launch Checklist');
  });

  it('creates a normal Memephant project seed without generating code', () => {
    const project = createProjectFromBlueprint(input, '2026-05-31T10:00:00.000Z');

    expect(project.id).toBe('context_client_hub_1780221600000');
    expect(project.projectBlueprint?.input.projectName).toBe('Context Client Hub');
    expect(project.projectCharter).toContain('# Project Blueprint: Context Client Hub');
    expect(project.aiInstructions).toContain('Do not generate application code unless the user explicitly asks for code.');
    expect(project.currentState).toContain('no implementation has been generated');
    expect(project.changelog[0]?.summary).toBe('Project Blueprint created');
    expect(project.importantAssets).toEqual([]);
  });

  it('survives project normalization for later editing or export', () => {
    const project = createProjectFromBlueprint(input, '2026-05-31T10:00:00.000Z');
    const normalized = normalizeOldProject(JSON.parse(JSON.stringify(project)));

    expect(normalized.projectBlueprint?.projectSummary.vision)
      .toBe(project.projectBlueprint?.projectSummary.vision);
    expect(normalized.projectBlueprint?.input.preferredStack).toBe('Tauri, React, SQLite');
  });
});
