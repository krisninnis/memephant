import type { GameProjectContext, ProjectMemory } from '../types/memphant-types';
import {
  GAME_SYSTEM_OPTIONS,
  ROBLOX_CONTEXT_PROMPTS,
  getGamePlatformLabel,
  getProjectCategoryLabel,
  isGameProject,
} from './gameProjectTypes';

type CleanText = (value: string) => string;

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function cleanValue(value: string | undefined, clean: CleanText): string | null {
  if (!hasText(value)) return null;
  return clean(value.trim());
}

function contextHasContent(context: GameProjectContext | undefined): boolean {
  if (!context) return false;
  const overview = context.overview ?? {};
  const systems = context.systems ?? {};
  return (
    Object.values(overview).some(hasText) ||
    Object.values(systems).some(hasText) ||
    (context.knownBugs ?? []).some((bug) => hasText(bug.title)) ||
    (context.scriptVault ?? []).some((script) => hasText(script.scriptName))
  );
}

export function shouldIncludeGameContext(project: ProjectMemory): boolean {
  return isGameProject(project) || contextHasContent(project.gameContext);
}

export function formatGameContextMarkdown(project: ProjectMemory, clean: CleanText): string | null {
  if (!shouldIncludeGameContext(project)) return null;

  const context = project.gameContext ?? {};
  const overview = context.overview ?? {};
  const lines: string[] = ['## Game Context', ''];

  lines.push(`Category: ${clean(getProjectCategoryLabel(project.projectCategory, project.projectCategoryOther))}`);
  lines.push(`Platform: ${clean(getGamePlatformLabel(project.gamePlatform, project.gamePlatformOther))}`);

  const overviewRows: Array<[string, string | undefined]> = [
    ['Genre', overview.genre],
    ['Core Loop', overview.coreLoop],
    ['Target Player', overview.targetPlayer],
    ['Art Style', overview.artStyle],
    ['Platform Target', overview.platformTarget],
    ['Monetisation Plan', overview.monetisationPlan],
    ['Current Playable State', overview.currentPlayableState],
  ];
  const filledOverview = overviewRows
    .map(([label, value]) => [label, cleanValue(value, clean)] as const)
    .filter(([, value]) => value);

  if (filledOverview.length > 0) {
    lines.push('');
    lines.push('Game Overview:');
    filledOverview.forEach(([label, value]) => {
      lines.push(`- ${label}: ${value}`);
    });
  }

  const systemRows = GAME_SYSTEM_OPTIONS
    .map((system) => [system.label, cleanValue(context.systems?.[system.value], clean)] as const)
    .filter(([, value]) => value);
  if (systemRows.length > 0) {
    lines.push('');
    lines.push('Key Systems:');
    systemRows.forEach(([label, value]) => {
      lines.push(`- ${label}: ${value}`);
    });
  }

  const scripts = (context.scriptVault ?? []).filter((script) => hasText(script.scriptName));
  if (scripts.length > 0) {
    lines.push('');
    lines.push('Important Scripts:');
    scripts.forEach((script) => {
      lines.push(`- ${clean(script.scriptName.trim())}${script.purpose ? `: ${clean(script.purpose.trim())}` : ''}`);
      if (script.platformLanguage) lines.push(`  - Platform/language: ${clean(script.platformLanguage)}`);
      if (script.relatedSystem) lines.push(`  - Related system: ${clean(script.relatedSystem)}`);
      if (script.status) lines.push(`  - Status: ${clean(script.status)}`);
      if (script.notes) lines.push(`  - Notes: ${clean(script.notes)}`);
      if (script.includeInContextPassport === true && script.codeSnippet) {
        lines.push('  - Code snippet:');
        lines.push('```');
        lines.push(clean(script.codeSnippet));
        lines.push('```');
      }
    });
  }

  const bugs = (context.knownBugs ?? []).filter((bug) => hasText(bug.title));
  if (bugs.length > 0) {
    lines.push('');
    lines.push('Known Bugs:');
    bugs.forEach((bug) => {
      lines.push(`- ${clean(bug.title.trim())}`);
      if (bug.systemAffected) lines.push(`  - System affected: ${clean(bug.systemAffected)}`);
      if (bug.reproductionNotes) lines.push(`  - Reproduction notes: ${clean(bug.reproductionNotes)}`);
      if (bug.currentTheory) lines.push(`  - Current theory: ${clean(bug.currentTheory)}`);
      if (bug.status) lines.push(`  - Status: ${clean(bug.status)}`);
    });
  }

  if (project.gamePlatform === 'roblox') {
    lines.push('');
    lines.push('Roblox Context Prompts:');
    ROBLOX_CONTEXT_PROMPTS.forEach((item) => lines.push(`- ${clean(item)}`));
  }

  return lines.join('\n');
}

export function formatGameContextXml(project: ProjectMemory, clean: CleanText): string | null {
  if (!shouldIncludeGameContext(project)) return null;

  const context = project.gameContext ?? {};
  const overview = context.overview ?? {};
  const lines = [
    '  <game_context>',
    `    <category>${clean(getProjectCategoryLabel(project.projectCategory, project.projectCategoryOther))}</category>`,
    `    <platform>${clean(getGamePlatformLabel(project.gamePlatform, project.gamePlatformOther))}</platform>`,
  ];

  const overviewRows: Array<[string, string | undefined]> = [
    ['genre', overview.genre],
    ['core_loop', overview.coreLoop],
    ['target_player', overview.targetPlayer],
    ['art_style', overview.artStyle],
    ['platform_target', overview.platformTarget],
    ['monetisation_plan', overview.monetisationPlan],
    ['current_playable_state', overview.currentPlayableState],
  ];

  if (overviewRows.some(([, value]) => hasText(value))) {
    lines.push('    <overview>');
    overviewRows.forEach(([tag, value]) => {
      const cleaned = cleanValue(value, clean);
      if (cleaned) lines.push(`      <${tag}>${cleaned}</${tag}>`);
    });
    lines.push('    </overview>');
  }

  const systems = GAME_SYSTEM_OPTIONS
    .map((system) => [system.value, system.label, cleanValue(context.systems?.[system.value], clean)] as const)
    .filter(([, , value]) => value);
  if (systems.length > 0) {
    lines.push('    <systems>');
    systems.forEach(([key, label, value]) => {
      lines.push(`      <system key="${key}" label="${clean(label)}">${value}</system>`);
    });
    lines.push('    </systems>');
  }

  const scripts = (context.scriptVault ?? []).filter((script) => hasText(script.scriptName));
  if (scripts.length > 0) {
    lines.push('    <script_vault>');
    scripts.forEach((script) => {
      lines.push('      <script>');
      lines.push(`        <name>${clean(script.scriptName)}</name>`);
      if (script.platformLanguage) lines.push(`        <platform_language>${clean(script.platformLanguage)}</platform_language>`);
      if (script.purpose) lines.push(`        <purpose>${clean(script.purpose)}</purpose>`);
      if (script.relatedSystem) lines.push(`        <related_system>${clean(script.relatedSystem)}</related_system>`);
      if (script.status) lines.push(`        <status>${clean(script.status)}</status>`);
      if (script.notes) lines.push(`        <notes>${clean(script.notes)}</notes>`);
      if (script.includeInContextPassport === true && script.codeSnippet) {
        lines.push(`        <code_snippet>${clean(script.codeSnippet)}</code_snippet>`);
      }
      lines.push('      </script>');
    });
    lines.push('    </script_vault>');
  }

  const bugs = (context.knownBugs ?? []).filter((bug) => hasText(bug.title));
  if (bugs.length > 0) {
    lines.push('    <known_bugs>');
    bugs.forEach((bug) => {
      lines.push('      <bug>');
      lines.push(`        <title>${clean(bug.title)}</title>`);
      if (bug.systemAffected) lines.push(`        <system_affected>${clean(bug.systemAffected)}</system_affected>`);
      if (bug.reproductionNotes) lines.push(`        <reproduction_notes>${clean(bug.reproductionNotes)}</reproduction_notes>`);
      if (bug.currentTheory) lines.push(`        <current_theory>${clean(bug.currentTheory)}</current_theory>`);
      if (bug.status) lines.push(`        <status>${clean(bug.status)}</status>`);
      lines.push('      </bug>');
    });
    lines.push('    </known_bugs>');
  }

  if (project.gamePlatform === 'roblox') {
    lines.push('    <roblox_context_prompts>');
    ROBLOX_CONTEXT_PROMPTS.forEach((item) => lines.push(`      - ${clean(item)}`));
    lines.push('    </roblox_context_prompts>');
  }

  lines.push('  </game_context>');
  return lines.join('\n');
}

export function formatGameContextCodex(project: ProjectMemory, clean: CleanText): string | null {
  if (!shouldIncludeGameContext(project)) return null;

  const context = project.gameContext ?? {};
  const overview = context.overview ?? {};
  const lines = [
    'GAME_CONTEXT:',
    `  CATEGORY: ${clean(getProjectCategoryLabel(project.projectCategory, project.projectCategoryOther))}`,
    `  PLATFORM: ${clean(getGamePlatformLabel(project.gamePlatform, project.gamePlatformOther))}`,
  ];

  if (overview.genre) lines.push(`  GENRE: ${clean(overview.genre)}`);
  if (overview.coreLoop) lines.push(`  CORE_LOOP: ${clean(overview.coreLoop)}`);
  if (overview.currentPlayableState) lines.push(`  CURRENT_PLAYABLE_STATE: ${clean(overview.currentPlayableState)}`);

  const systems = GAME_SYSTEM_OPTIONS
    .map((system) => [system.label, cleanValue(context.systems?.[system.value], clean)] as const)
    .filter(([, value]) => value);
  if (systems.length > 0) {
    lines.push('  SYSTEMS:');
    systems.forEach(([label, value]) => lines.push(`    - ${label}: ${value}`));
  }

  const scripts = (context.scriptVault ?? []).filter((script) => hasText(script.scriptName));
  if (scripts.length > 0) {
    lines.push('  SCRIPT_VAULT:');
    scripts.forEach((script) => {
      lines.push(`    - ${clean(script.scriptName)}${script.purpose ? `: ${clean(script.purpose)}` : ''}`);
      if (script.relatedSystem) lines.push(`      RELATED_SYSTEM: ${clean(script.relatedSystem)}`);
      if (script.status) lines.push(`      STATUS: ${clean(script.status)}`);
      if (script.notes) lines.push(`      NOTES: ${clean(script.notes)}`);
      if (script.includeInContextPassport === true && script.codeSnippet) {
        lines.push(`      CODE_SNIPPET: ${clean(script.codeSnippet)}`);
      }
    });
  }

  const bugs = (context.knownBugs ?? []).filter((bug) => hasText(bug.title));
  if (bugs.length > 0) {
    lines.push('  KNOWN_BUGS:');
    bugs.forEach((bug) => {
      lines.push(`    - ${clean(bug.title)}`);
      if (bug.systemAffected) lines.push(`      SYSTEM_AFFECTED: ${clean(bug.systemAffected)}`);
      if (bug.reproductionNotes) lines.push(`      REPRODUCTION: ${clean(bug.reproductionNotes)}`);
      if (bug.currentTheory) lines.push(`      CURRENT_THEORY: ${clean(bug.currentTheory)}`);
      if (bug.status) lines.push(`      STATUS: ${clean(bug.status)}`);
    });
  }

  if (project.gamePlatform === 'roblox') {
    lines.push('  ROBLOX_CONTEXT_PROMPTS:');
    ROBLOX_CONTEXT_PROMPTS.forEach((item) => lines.push(`    - ${clean(item)}`));
  }

  return lines.join('\n');
}
