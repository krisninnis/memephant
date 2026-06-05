import { useState, useCallback, useMemo, useId } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useActiveProject } from '../../hooks/useActiveProject';
import { useRecentActivity } from '../../hooks/useRecentActivity';
import EditableField from './EditableField';
import EditableList from './EditableList';
import { DecisionList } from './DecisionCard';
import { generateSuggestions } from '../../utils/autoSuggest';
import { generateHippocampusMarkdown } from '../../utils/hippocampusFormat';
import { generatePrefrontalMarkdown } from '../../utils/prefrontalFormat';
import {
  getProjectMemoryCleanupPreview,
  type ProjectMemoryCleanupPreview,
} from '../../utils/projectMemoryCleanup';
import { GitHubScanPreview } from './GitHubScanPreview';
import { scanGitHubRepo, mergeScanResult, parseGitHubUrl } from '../../services/githubScanner';
import {
  getFolderActionLabel,
  linkFolder,
  rescanLinkedFolder,
  restoreProjectFromHistory,
  unlinkFolder,
} from '../../services/tauriActions';
import { RecentActivityBlock } from '../RecentActivityBlock';
import type { GitHubScanResult } from '../../services/githubScanner';
import type {
  GameOverview,
  GamePlatform,
  GameProjectContext,
  GameSystemKey,
  KnownGameBug,
  ProjectMemory,
  ProjectCategory,
  ScriptVaultEntry,
} from '../../types/memphant-types';
import {
  GAME_PLATFORM_LINKS,
  GAME_PLATFORM_OPTIONS,
  GAME_SYSTEM_OPTIONS,
  PROJECT_CATEGORY_OPTIONS,
  createDefaultGameContext,
} from '../../utils/gameProjectTypes';

type ScanState = 'idle' | 'scanning' | 'preview' | 'error';

const OTHER_PRESET_VALUE = '__other__';

const GAME_GENRE_PRESETS = [
  'Obby',
  'Tycoon',
  'Simulator',
  'Survival',
  'RPG',
  'Tower Defense',
  'Horror',
  'Roleplay',
  'Adventure',
  'Puzzle',
  'Sandbox',
];

const TARGET_PLAYER_PRESETS = [
  'Casual Roblox players',
  'Younger players',
  'Teen players',
  'Competitive players',
  'Co-op players',
  'Solo players',
  'Friends playing together',
];

const ART_STYLE_PRESETS = [
  'Bright low-poly',
  'Cartoony',
  'Realistic',
  'Pixel art',
  'Horror/dark',
  'Sci-fi',
  'Fantasy',
  'Minimalist',
];

const MONETISATION_PRESETS = [
  'None yet',
  'Gamepasses',
  'Developer products',
  'Cosmetics',
  'Boosts',
  'Premium payouts',
  'Private servers',
  'Ads/sponsorship later',
];

const PLAYABLE_STATE_PRESETS = [
  'Idea only',
  'Prototype',
  'Basic map built',
  'One mechanic working',
  'First playable loop working',
  'Playtesting',
  'Soft launch',
  'Live game',
];

const CORE_LOOP_PRESETS = [
  'Complete obby stages, earn rewards, unlock harder levels',
  'Build base, earn currency, upgrade systems',
  'Collect items/pets, upgrade, unlock new areas',
  'Survive waves, earn rewards, improve equipment',
  'Complete quests, level up, unlock abilities',
  'Explore world, discover secrets, progress story',
];

const SCRIPT_STATUS_PRESETS = [
  'Planned',
  'In progress',
  'Working',
  'Buggy',
  'Needs refactor',
  'Deprecated',
];

const RELATED_SYSTEM_PRESETS = [
  'Movement',
  'Combat',
  'Inventory',
  'Economy',
  'Quests',
  'NPCs',
  'UI',
  'Multiplayer',
  'Saving/progression',
  'Monetisation',
  'Analytics/playtesting',
  'Door Interaction',
  'RemoteEvents',
  'DataStores',
];

const BUG_STATUS_PRESETS = [
  'Open',
  'Investigating',
  'Reproduced',
  'Fix planned',
  'Fixed',
  'Won\'t fix',
  'Needs retest',
];

const SCRIPT_LANGUAGE_PRESETS = [
  'Luau',
  'Lua',
  'TypeScript',
  'JavaScript',
  'C#',
  'GDScript',
  'Python',
];

interface GuidedPresetFieldProps {
  label: string;
  value: string;
  presets: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  customPlaceholder?: string;
  multilineCustom?: boolean;
}

function GuidedPresetField({
  label,
  value,
  presets,
  onChange,
  placeholder = 'Choose a preset...',
  customPlaceholder = 'Type a custom value',
  multilineCustom = false,
}: GuidedPresetFieldProps) {
  const selectId = useId();
  const customId = useId();
  const isPreset = presets.includes(value);
  const hasCustomValue = value.trim().length > 0 && !isPreset;
  const selectedValue = hasCustomValue ? OTHER_PRESET_VALUE : value;

  const handleSelectChange = (nextValue: string) => {
    if (nextValue === OTHER_PRESET_VALUE) {
      if (!hasCustomValue) onChange('');
      return;
    }

    onChange(nextValue);
  };

  return (
    <div className="guided-preset-field">
      <label htmlFor={selectId}>{label}</label>
      <select
        id={selectId}
        className="field-input"
        value={selectedValue}
        onChange={(event) => handleSelectChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {presets.map((preset) => (
          <option key={preset} value={preset}>{preset}</option>
        ))}
        <option value={OTHER_PRESET_VALUE}>Other</option>
      </select>
      {selectedValue === OTHER_PRESET_VALUE && (
        multilineCustom ? (
          <>
            <label className="guided-preset-field__custom-label" htmlFor={customId}>
              Custom {label}
            </label>
            <textarea
              id={customId}
              className="field-textarea"
              value={hasCustomValue ? value : ''}
              onChange={(event) => onChange(event.target.value)}
              placeholder={customPlaceholder}
            />
          </>
        ) : (
          <>
            <label className="guided-preset-field__custom-label" htmlFor={customId}>
              Custom {label}
            </label>
            <input
              id={customId}
              className="field-input"
              value={hasCustomValue ? value : ''}
              onChange={(event) => onChange(event.target.value)}
              placeholder={customPlaceholder}
            />
          </>
        )
      )}
    </div>
  );
}

function mergeGameContextDefaults(
  current: GameProjectContext | undefined,
  platform: GamePlatform,
): GameProjectContext {
  const defaults = createDefaultGameContext(platform);
  return {
    overview: {
      ...defaults.overview,
      ...current?.overview,
    },
    systems: {
      ...defaults.systems,
      ...current?.systems,
    },
    knownBugs: current?.knownBugs ?? defaults.knownBugs ?? [],
    scriptVault: current?.scriptVault ?? defaults.scriptVault ?? [],
  };
}

function nextRecordId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

type ScanScriptKind = 'LocalScript' | 'ModuleScript' | 'Server Script' | 'Unknown script';

type ScriptScanSuggestion = {
  fileName: string;
  relativePath: string;
  scriptKind: ScanScriptKind;
  relatedSystem: string;
};

type FolderScanSummary = {
  projectType: string;
  filesAnalysed: number;
  importantFiles: string[];
  scripts: ScriptScanSuggestion[];
  suggestions: ScriptScanSuggestion[];
};

type PendingScriptDuplicateConfirmation = {
  existingName: string;
  onConfirm: () => void;
};

function fileNameFromPath(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).pop() ?? normalized;
}

function scriptBaseName(value: string): string {
  const fileName = fileNameFromPath(value).trim();
  return fileName.replace(/\.[^.]+$/, '').trim();
}

function looksLikeAbsoluteLocalPath(value: string): boolean {
  return (
    /^[A-Za-z]:[\\/]/.test(value) ||
    /^\\\\/.test(value) ||
    /^\/(?:Users|home|var|tmp|private|Volumes)\//i.test(value)
  );
}

function safeScanAssetLabel(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/\\/g, '/').replace(/^\.\/+/, '');
  if (looksLikeAbsoluteLocalPath(trimmed)) {
    return fileNameFromPath(trimmed);
  }

  return normalized;
}

function uniqueSafeScanAssets(assets: string[]): string[] {
  const seen = new Set<string>();
  const safeAssets: string[] = [];

  for (const asset of assets) {
    const label = safeScanAssetLabel(asset);
    if (!label) continue;

    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    safeAssets.push(label);
  }

  return safeAssets;
}

function isLuauScriptFile(path: string): boolean {
  return /\.(lua|luau)$/i.test(path);
}

function classifyScriptByName(fileName: string): ScanScriptKind {
  const lower = fileName.toLowerCase();
  if (lower.includes('module')) return 'ModuleScript';
  if (lower.includes('localscript') || lower.includes('local') || lower.includes('client')) {
    return 'LocalScript';
  }
  if (lower.includes('serverscript') || lower.includes('server')) return 'Server Script';
  return 'Unknown script';
}

function inferRelatedSystemFromScriptName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (/(npc|enemy|spawn)/.test(lower)) return 'NPCs';
  if (/door/.test(lower)) return 'Door Interaction';
  if (/(remote|event)/.test(lower)) return 'RemoteEvents';
  if (/(datastore|data-store|save|profile)/.test(lower)) return 'DataStores';
  if (/(move|movement|walk|sprint|jump)/.test(lower)) return 'Movement';
  if (/(combat|weapon|damage|hit)/.test(lower)) return 'Combat';
  if (/(inventory|item|bag)/.test(lower)) return 'Inventory';
  if (/(economy|currency|coin|shop)/.test(lower)) return 'Economy';
  if (/quest/.test(lower)) return 'Quests';
  if (/(ui|hud|menu|screen)/.test(lower)) return 'UI';
  if (/(multi|network|matchmaking|team)/.test(lower)) return 'Multiplayer';
  if (/(gamepass|developerproduct|product|monetis)/.test(lower)) return 'Monetisation';
  return 'Unknown';
}

function scriptVaultNameKey(scriptName: string): string {
  const baseName = scriptBaseName(scriptName);
  return (baseName || 'Untitled script').toLowerCase();
}

function scriptVaultDisplayName(scriptName: string): string {
  return fileNameFromPath(scriptName).trim() || 'Untitled script';
}

function findDuplicateScript(
  scripts: ScriptVaultEntry[],
  scriptName: string,
  ignoreIndex?: number,
): ScriptVaultEntry | undefined {
  const key = scriptVaultNameKey(scriptName);
  return scripts.find((script, index) => index !== ignoreIndex && scriptVaultNameKey(script.scriptName) === key);
}

function makeScriptCopyName(scriptName: string, existingScripts: ScriptVaultEntry[]): string {
  const displayName = scriptVaultDisplayName(scriptName);
  const dotIndex = displayName.lastIndexOf('.');
  const hasExtension = dotIndex > 0;
  const stem = hasExtension ? displayName.slice(0, dotIndex) : displayName;
  const extension = hasExtension ? displayName.slice(dotIndex) : '';
  const existingNames = new Set(existingScripts.map((script) => scriptVaultDisplayName(script.scriptName).toLowerCase()));

  for (let copyNumber = 1; copyNumber < 1000; copyNumber += 1) {
    const suffix = copyNumber === 1 ? ' copy' : ` copy ${copyNumber}`;
    const candidate = `${stem}${suffix}${extension}`;
    if (!existingNames.has(candidate.toLowerCase())) return candidate;
  }

  return `${stem} copy ${Date.now().toString(36)}${extension}`;
}

function scriptSummaryLabel(script: ScriptVaultEntry, index: number, scripts: ScriptVaultEntry[]): string {
  const displayName = scriptVaultDisplayName(script.scriptName);
  const key = scriptVaultNameKey(script.scriptName);
  const matchingScripts = scripts.filter((item) => scriptVaultNameKey(item.scriptName) === key);
  if (matchingScripts.length <= 1) return displayName;

  const occurrence = scripts.slice(0, index + 1).filter((item) => scriptVaultNameKey(item.scriptName) === key).length;
  return occurrence === 1 ? displayName : `${displayName} copy ${occurrence}`;
}

function detectFolderProjectType(
  project: ProjectMemory,
  activeGamePlatform: GamePlatform,
  activeProjectCategory: ProjectCategory,
  safeAssets: string[],
): string {
  const stack = (project.detectedStack ?? []).map((item) => item.toLowerCase());
  const platformTarget = project.gameContext?.overview?.platformTarget?.toLowerCase() ?? '';
  const isGameContext = activeProjectCategory === 'game' || Boolean(project.gamePlatform || project.gameContext);

  if (
    (isGameContext && activeGamePlatform === 'roblox') ||
    project.gamePlatform === 'roblox' ||
    platformTarget.includes('roblox') ||
    stack.some((item) => item.includes('roblox') || item.includes('luau')) ||
    (activeProjectCategory === 'game' && safeAssets.some(isLuauScriptFile))
  ) {
    return 'Roblox';
  }

  if (activeProjectCategory === 'game') {
    const platform = GAME_PLATFORM_OPTIONS.find((option) => option.value === activeGamePlatform);
    return platform?.label ?? 'Game';
  }

  if (project.detectedStack && project.detectedStack.length > 0) {
    return project.detectedStack.slice(0, 3).join(', ');
  }

  return 'Project folder';
}

function buildFolderScanSummary(
  project: ProjectMemory,
  activeGamePlatform: GamePlatform,
  activeProjectCategory: ProjectCategory,
  scriptVault: ScriptVaultEntry[],
): FolderScanSummary {
  const safeAssets = uniqueSafeScanAssets(project.importantAssets ?? []);
  const existingScriptNames = new Set(
    scriptVault
      .map((script) => scriptVaultNameKey(script.scriptName))
      .filter(Boolean),
  );
  const scripts = safeAssets
    .filter(isLuauScriptFile)
    .map((relativePath) => {
      const fileName = fileNameFromPath(relativePath);
      return {
        fileName,
        relativePath,
        scriptKind: classifyScriptByName(fileName),
        relatedSystem: inferRelatedSystemFromScriptName(fileName),
      };
    });

  return {
    projectType: detectFolderProjectType(project, activeGamePlatform, activeProjectCategory, safeAssets),
    filesAnalysed: safeAssets.length,
    importantFiles: safeAssets.slice(0, 8),
    scripts,
    suggestions: scripts.filter((script) => !existingScriptNames.has(scriptVaultNameKey(script.fileName))),
  };
}

function scriptVaultEntryFromSuggestion(
  suggestion: ScriptScanSuggestion,
  id: string,
): ScriptVaultEntry {
  return {
    id,
    scriptName: suggestion.fileName,
    platformLanguage: 'Luau',
    purpose: '',
    relatedSystem: suggestion.relatedSystem,
    status: 'Planned',
    notes: 'Suggested from linked folder scan',
    codeSnippet: '',
    includeInContextPassport: false,
  };
}

function buildScriptAiHelpPrompt(script: ScriptVaultEntry, activeGamePlatform: GamePlatform): string {
  const language = script.platformLanguage?.trim() || (activeGamePlatform === 'roblox' ? 'Luau' : 'the project language');
  const projectLabel = activeGamePlatform === 'roblox' || /luau|lua/i.test(language)
    ? 'Roblox/Luau'
    : language;
  const codeFenceLanguage = /luau|lua/i.test(language) ? 'lua' : '';

  return [
    `I am working on this ${projectLabel} script.`,
    '',
    'Script name:',
    script.scriptName?.trim() || '(unnamed script)',
    '',
    'Purpose:',
    script.purpose?.trim() || '(not specified)',
    '',
    'Related system:',
    script.relatedSystem?.trim() || '(not specified)',
    '',
    'Status:',
    script.status?.trim() || '(not specified)',
    '',
    'Known notes:',
    script.notes?.trim() || '(none)',
    '',
    'Please help me understand, debug or improve this script. Explain changes clearly and do not assume missing project details.',
    '',
    'Script:',
    `\`\`\`${codeFenceLanguage}`,
    script.codeSnippet ?? '',
    '```',
  ].join('\n');
}

function buildScriptContextText(script: ScriptVaultEntry): string {
  return [
    'Script context',
    '',
    `Script name: ${script.scriptName?.trim() || '(unnamed script)'}`,
    `Platform/language: ${script.platformLanguage?.trim() || '(not specified)'}`,
    `Related system: ${script.relatedSystem?.trim() || '(not specified)'}`,
    `Status: ${script.status?.trim() || '(not specified)'}`,
    `Purpose: ${script.purpose?.trim() || '(not specified)'}`,
    `Notes: ${script.notes?.trim() || '(none)'}`,
    '',
    'Script:',
    script.codeSnippet ?? '',
  ].join('\n');
}

function formatRestorePointTime(isoString: string): string {
  return new Date(isoString).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatLinkedFolderTime(isoString: string | undefined): string {
  if (!isoString) return 'Not scanned yet';
  return new Date(isoString).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ProjectEditor() {
  const activeProject = useActiveProject();
  const updateProject = useProjectStore((s) => s.updateProject);
  const showToast = useProjectStore((s) => s.showToast);

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [scanResult, setScanResult] = useState<GitHubScanResult | null>(null);
  const [scanError, setScanError] = useState<string>('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreHistoryOpen, setRestoreHistoryOpen] = useState(false);
  const [cleanupPreview, setCleanupPreview] = useState<ProjectMemoryCleanupPreview | null>(null);
  const [scriptWorkspaceOpen, setScriptWorkspaceOpen] = useState(false);
  const [selectedScriptIndex, setSelectedScriptIndex] = useState(0);
  const [pendingScriptDuplicateConfirmation, setPendingScriptDuplicateConfirmation] =
    useState<PendingScriptDuplicateConfirmation | null>(null);

  const project = activeProject;

  const { markdown, loading, error } = useRecentActivity(
    project?.id ?? '',
    project?.linkedFolder?.path ?? '',
  );

  const recentRestorePoints = project
    ? [...(project.restorePoints ?? [])]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5)
    : [];
  const hippocampusPreview = useMemo(
    () => (project ? generateHippocampusMarkdown(project) : ''),
    [project],
  );

  const prefrontalPreview = useMemo(
    () => (project ? generatePrefrontalMarkdown(project) : ''),
    [project],
  );

  const update = (field: string, value: unknown) => {
    if (!project) return;
    updateProject(project.id, { [field]: value } as Parameters<typeof updateProject>[1]);
  };

  const handleScan = useCallback(async () => {
    if (!project?.githubRepo) return;
    setScanState('scanning');
    setScanError('');
    setScanResult(null);
    try {
      const result = await scanGitHubRepo(project.githubRepo);
      setScanResult(result);
      setScanState('preview');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed - please try again.');
      setScanState('error');
    }
  }, [project?.githubRepo]);

  const handleScanAccept = useCallback(() => {
    if (!project || !scanResult) return;
    const merged = mergeScanResult(project, scanResult);
    updateProject(project.id, {
      summary: merged.summary,
      currentState: merged.currentState,
      goals: merged.goals,
      nextSteps: merged.nextSteps,
      openQuestions: merged.openQuestions,
      importantAssets: merged.importantAssets,
      decisions: merged.decisions,
      detectedStack: merged.detectedStack,
      scanInfo: merged.scanInfo,
    } as Parameters<typeof updateProject>[1]);
    showToast('Repo scan merged into your project.');
    setScanState('idle');
    setScanResult(null);
  }, [project, scanResult, updateProject, showToast]);

  const handleScanDismiss = useCallback(() => {
    setScanState('idle');
    setScanResult(null);
    setScanError('');
  }, []);

  function handleSuggest(field: 'summary' | 'currentState' | 'goals') {
    if (!project) return;
    const suggestions = generateSuggestions(project);
    const suggested = suggestions[field];

    if (field === 'goals') {
      const existing = project.goals ?? [];
      if (existing.length > 0) {
        const newItems = (suggested as string[]).filter((g) => !existing.includes(g));
        if (newItems.length === 0) {
          showToast('Goals already look complete - edit them manually if needed.');
          return;
        }
        update('goals', [...existing, ...newItems]);
        showToast(`Added ${newItems.length} suggested goal${newItems.length !== 1 ? 's' : ''}.`);
      } else {
        update('goals', suggested);
        showToast('Goals auto-filled - edit them to match your project.');
      }
    } else {
      update(field, suggested);
      showToast('Auto-filled - edit it to make it your own.');
    }
  }

  const handleCopyHippocampus = useCallback(async () => {
    if (!project) return;

    try {
      await navigator.clipboard.writeText(generateHippocampusMarkdown(project));
      showToast('Copied hippocampus.md.');
    } catch {
      showToast('Could not copy hippocampus.md.');
    }
  }, [project, showToast]);

  const handleCopyPrefrontal = useCallback(async () => {
    if (!project) return;

    try {
      await navigator.clipboard.writeText(generatePrefrontalMarkdown(project));
      showToast('Copied prefrontal.md.');
    } catch {
      showToast('Could not copy prefrontal.md.');
    }
  }, [project, showToast]);

  const handleDownloadPrefrontal = useCallback(() => {
    if (!project) return;

    try {
      const content = generatePrefrontalMarkdown(project);
      const blob = new Blob([content], { type: 'text/markdown; charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'prefrontal.md';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      showToast('Downloaded prefrontal.md.');
    } catch {
      showToast('Could not download prefrontal.md.');
    }
  }, [project, showToast]);

  const handleDownloadHippocampus = useCallback(() => {
    if (!project) return;

    try {
      const content = generateHippocampusMarkdown(project);
      const blob = new Blob([content], { type: 'text/markdown; charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'hippocampus.md';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      showToast('Downloaded hippocampus.md.');
    } catch {
      showToast('Could not download hippocampus.md.');
    }
  }, [project, showToast]);

  const handlePreviewCleanup = useCallback(() => {
    if (!project) return;

    const preview = getProjectMemoryCleanupPreview(project);
    setCleanupPreview(preview);

    if (!preview.hasChanges) {
      showToast('Project memory already looks clean.');
    }
  }, [project, showToast]);

  const handleApplyCleanup = useCallback(() => {
    if (!project || !cleanupPreview?.hasChanges) return;

    updateProject(project.id, {
      summary: cleanupPreview.draft.summary,
      currentState: cleanupPreview.draft.currentState,
      lastSessionSummary: cleanupPreview.draft.lastSessionSummary,
      openQuestion: cleanupPreview.draft.openQuestion,
      goals: cleanupPreview.draft.goals,
      rules: cleanupPreview.draft.rules,
      nextSteps: cleanupPreview.draft.nextSteps,
      openQuestions: cleanupPreview.draft.openQuestions,
      importantAssets: cleanupPreview.draft.importantAssets,
      projectCharter: cleanupPreview.draft.projectCharter,
      decisions: cleanupPreview.draft.decisions,
    } as Parameters<typeof updateProject>[1]);

    setCleanupPreview(null);
    showToast('Cleaned project memory. Review the fields before exporting.');
  }, [project, cleanupPreview, updateProject, showToast]);

  const handleRestore = useCallback(
    async (restorePointId: string) => {
      if (!project) return;
      setRestoringId(restorePointId);

      try {
        await restoreProjectFromHistory(project.id, restorePointId);
      } finally {
        setRestoringId((current) => (current === restorePointId ? null : current));
      }
    },
    [project],
  );

  if (!project) {
    return (
      <div className="project-editor project-editor--empty">
        <p>Select a project from the sidebar to get started.</p>
      </div>
    );
  }

  const activeGamePlatform = activeProject.gamePlatform ?? 'roblox';
  const activeGameContext = activeProject.gameContext ?? createDefaultGameContext(activeGamePlatform);
  const activeProjectCategory = activeProject.projectCategory ?? 'general-software';
  const activePlatformLinks = GAME_PLATFORM_LINKS[activeGamePlatform] ?? [];
  const folderActionLabel = getFolderActionLabel();
  const hasLinkedFolder = Boolean(activeProject.linkedFolder?.path);
  const folderScanSummary = useMemo(
    () => buildFolderScanSummary(
      activeProject,
      activeGamePlatform,
      activeProjectCategory,
      activeGameContext.scriptVault ?? [],
    ),
    [activeProject, activeGamePlatform, activeProjectCategory, activeGameContext.scriptVault],
  );
  const scriptVaultEntries = activeGameContext.scriptVault ?? [];
  const safeSelectedScriptIndex =
    scriptVaultEntries.length === 0
      ? 0
      : Math.min(selectedScriptIndex, scriptVaultEntries.length - 1);
  const selectedScript = scriptVaultEntries[safeSelectedScriptIndex];
  const showScriptWorkspace = scriptWorkspaceOpen && activeProjectCategory === 'game';

  const updateGameContext = (next: GameProjectContext) => {
    update('gameContext', next);
  };

  const updateGameOverview = (field: keyof GameOverview, value: string) => {
    updateGameContext({
      ...activeGameContext,
      overview: {
        ...activeGameContext.overview,
        [field]: value,
      },
    });
  };

  const updateGameSystem = (field: GameSystemKey, value: string) => {
    updateGameContext({
      ...activeGameContext,
      systems: {
        ...activeGameContext.systems,
        [field]: value,
      },
    });
  };

  const updateKnownBug = (index: number, value: KnownGameBug) => {
    const bugs = [...(activeGameContext.knownBugs ?? [])];
    bugs[index] = value;
    updateGameContext({ ...activeGameContext, knownBugs: bugs });
  };

  const removeKnownBug = (index: number) => {
    updateGameContext({
      ...activeGameContext,
      knownBugs: (activeGameContext.knownBugs ?? []).filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const addKnownBug = () => {
    updateGameContext({
      ...activeGameContext,
      knownBugs: [
        ...(activeGameContext.knownBugs ?? []),
        {
          id: nextRecordId('bug'),
          title: '',
          status: 'Open',
        },
      ],
    });
  };

  const updateScriptVaultEntry = (index: number, value: ScriptVaultEntry) => {
    const scripts = [...(activeGameContext.scriptVault ?? [])];
    scripts[index] = value;
    updateGameContext({ ...activeGameContext, scriptVault: scripts });
  };

  const requestScriptDuplicateConfirmation = (
    duplicateOf: ScriptVaultEntry,
    onConfirm: () => void,
  ) => {
    setPendingScriptDuplicateConfirmation({
      existingName: scriptVaultDisplayName(duplicateOf.scriptName),
      onConfirm,
    });
  };

  const confirmScriptDuplicate = () => {
    const confirmation = pendingScriptDuplicateConfirmation;
    if (!confirmation) return;

    setPendingScriptDuplicateConfirmation(null);
    confirmation.onConfirm();
  };

  const cancelScriptDuplicate = () => {
    setPendingScriptDuplicateConfirmation(null);
  };

  const updateScriptVaultEntryWithDuplicateGuard = (index: number, value: ScriptVaultEntry) => {
    const currentScripts = activeGameContext.scriptVault ?? [];
    const duplicate = findDuplicateScript(currentScripts, value.scriptName, index);

    if (duplicate) {
      requestScriptDuplicateConfirmation(duplicate, () => updateScriptVaultEntry(index, value));
      return;
    }

    updateScriptVaultEntry(index, value);
  };

  const removeScriptVaultEntry = (index: number) => {
    updateGameContext({
      ...activeGameContext,
      scriptVault: (activeGameContext.scriptVault ?? []).filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const addScriptVaultEntry = (allowDuplicate = false, openAfterCreate = false) => {
    const currentScripts = activeGameContext.scriptVault ?? [];
    const nextScript: ScriptVaultEntry = {
      id: nextRecordId('script'),
      scriptName: '',
      platformLanguage: activeGamePlatform === 'roblox' ? 'Luau' : '',
      status: 'Planned',
      includeInContextPassport: false,
    };
    const duplicate = findDuplicateScript(currentScripts, nextScript.scriptName);

    const addScript = () => {
      updateGameContext({
        ...activeGameContext,
        scriptVault: [
          ...currentScripts,
          nextScript,
        ],
      });
      setSelectedScriptIndex(currentScripts.length);
      if (openAfterCreate) setScriptWorkspaceOpen(true);
    };

    if (duplicate && !allowDuplicate) {
      requestScriptDuplicateConfirmation(duplicate, addScript);
      return;
    }

    addScript();
  };

  const addScriptVaultEntryFromSuggestion = (suggestion: ScriptScanSuggestion, allowDuplicate = false) => {
    const currentScripts = activeGameContext.scriptVault ?? [];
    const duplicate = findDuplicateScript(currentScripts, suggestion.fileName);

    const addSuggestion = () => {
      updateGameContext({
        ...activeGameContext,
        scriptVault: [
          ...currentScripts,
          scriptVaultEntryFromSuggestion(suggestion, nextRecordId('script')),
        ],
      });
    };

    if (duplicate && !allowDuplicate) {
      requestScriptDuplicateConfirmation(duplicate, addSuggestion);
      return;
    }

    addSuggestion();
  };

  const openScriptWorkspace = () => {
    const currentScripts = activeGameContext.scriptVault ?? [];
    if (currentScripts.length === 0) {
      addScriptVaultEntry(false, true);
    } else {
      setSelectedScriptIndex(Math.min(selectedScriptIndex, currentScripts.length - 1));
      setScriptWorkspaceOpen(true);
    }
  };

  const openScriptWorkspaceForScript = (index: number) => {
    setSelectedScriptIndex(index);
    setScriptWorkspaceOpen(true);
  };

  const addScriptFromWorkspace = () => {
    addScriptVaultEntry();
  };

  const deleteScriptFromWorkspace = () => {
    if (!selectedScript) return;
    removeScriptVaultEntry(safeSelectedScriptIndex);
    setSelectedScriptIndex(Math.max(0, safeSelectedScriptIndex - 1));
  };

  const duplicateScriptFromWorkspace = () => {
    if (!selectedScript) return;
    const currentScripts = activeGameContext.scriptVault ?? [];
    const duplicate: ScriptVaultEntry = {
      ...selectedScript,
      id: nextRecordId('script'),
      scriptName: makeScriptCopyName(selectedScript.scriptName, currentScripts),
    };

    updateGameContext({
      ...activeGameContext,
      scriptVault: [
        ...currentScripts.slice(0, safeSelectedScriptIndex + 1),
        duplicate,
        ...currentScripts.slice(safeSelectedScriptIndex + 1),
      ],
    });
    setSelectedScriptIndex(safeSelectedScriptIndex + 1);
  };

  const updateSelectedScript = (patch: Partial<ScriptVaultEntry>) => {
    if (!selectedScript) return;
    const nextScript = { ...selectedScript, ...patch };
    if (Object.prototype.hasOwnProperty.call(patch, 'scriptName')) {
      updateScriptVaultEntryWithDuplicateGuard(safeSelectedScriptIndex, nextScript);
      return;
    }

    updateScriptVaultEntry(safeSelectedScriptIndex, nextScript);
  };

  const copyScriptWorkspaceText = async (
    text: string,
    successMessage: string,
    errorMessage = 'Could not copy to clipboard.',
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage, 'info');
    } catch {
      showToast(errorMessage, 'error');
    }
  };

  const copySelectedScript = () => {
    if (!selectedScript) return;
    void copyScriptWorkspaceText(selectedScript.codeSnippet ?? '', 'Script copied.');
  };

  const copySelectedScriptAiPrompt = () => {
    if (!selectedScript) return;
    void copyScriptWorkspaceText(
      buildScriptAiHelpPrompt(selectedScript, activeGamePlatform),
      'AI help prompt copied.',
    );
  };

  const copySelectedScriptContext = () => {
    if (!selectedScript) return;
    void copyScriptWorkspaceText(
      buildScriptContextText(selectedScript),
      'Script context copied.',
    );
  };

  const addScriptVaultSuggestion = (suggestion: ScriptScanSuggestion) => {
    addScriptVaultEntryFromSuggestion(suggestion);
  };

  const addAllScriptVaultSuggestions = () => {
    const currentScripts = activeGameContext.scriptVault ?? [];
    const existingScriptNames = new Set(
      currentScripts
        .map((script) => scriptVaultNameKey(script.scriptName))
        .filter(Boolean),
    );
    const additions = folderScanSummary.suggestions.filter((suggestion) => {
      const key = scriptVaultNameKey(suggestion.fileName);
      if (!key || existingScriptNames.has(key)) return false;
      existingScriptNames.add(key);
      return true;
    });

    if (additions.length === 0) {
      showToast('No new script suggestions to add.', 'info');
      return;
    }

    updateGameContext({
      ...activeGameContext,
      scriptVault: [
        ...currentScripts,
        ...additions.map((suggestion, index) =>
          scriptVaultEntryFromSuggestion(suggestion, `${nextRecordId('script')}-${index}`),
        ),
      ],
    });
  };

  const handleProjectCategoryChange = (category: ProjectCategory) => {
    if (category !== 'game') {
      update('projectCategory', category);
      return;
    }

    updateProject(activeProject.id, {
      projectCategory: 'game',
      gamePlatform: activeGamePlatform,
      gameContext: mergeGameContextDefaults(activeProject.gameContext, activeGamePlatform),
    } as Parameters<typeof updateProject>[1]);
  };

  const handleGamePlatformChange = (platform: GamePlatform) => {
    updateProject(activeProject.id, {
      gamePlatform: platform,
      gameContext: mergeGameContextDefaults(activeProject.gameContext, platform),
    } as Parameters<typeof updateProject>[1]);
  };

  return (
    <div className="project-editor" data-tour="editor">
      {recentRestorePoints.length > 0 && (
        <div className="project-history-card">
          <button
            type="button"
            className="project-history-card__header project-history-card__header--button"
            onClick={() => setRestoreHistoryOpen((open) => !open)}
            aria-expanded={restoreHistoryOpen}
            title="Show or hide restore history"
          >
            <div>
              <div className="field-label">Restore History</div>
              <div className="project-history-card__hint">
                Restore the project to how it looked before a recent AI apply or rescan.
              </div>
            </div>
            <span className="project-history-card__badge">
              {recentRestorePoints.length} available
              <span className="project-history-card__chevron" aria-hidden="true">
                {restoreHistoryOpen ? '-' : '+'}
              </span>
            </span>
          </button>

          {restoreHistoryOpen && (
            <div className="project-history-list">
              {recentRestorePoints.map((restorePoint) => (
                <div key={restorePoint.id} className="project-history-item">
                  <div className="project-history-item__meta">
                    <strong>
                      {restorePoint.reason === 'rescan' ? 'Before rescan' : 'Before AI apply'}
                    </strong>
                    <span>{formatRestorePointTime(restorePoint.timestamp)}</span>
                  </div>
                  <div className="project-history-item__summary">{restorePoint.summary}</div>
                  <button
                    type="button"
                    className="project-history-item__restore"
                    onClick={() => void handleRestore(restorePoint.id)}
                    disabled={restoringId === restorePoint.id}
                  >
                    {restoringId === restorePoint.id ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="field-group" data-tour="editor-name">
        <div className="field-label">Project Name</div>
        <input
          className="field-input project-name-input"
          type="text"
          value={activeProject.name}
          onChange={(e) => update('name', e.target.value)}
        />
      </div>

      <div className="field-group github-repo-field">
        <div className="field-label">
          GitHub Repository <span className="field-label-optional">(optional)</span>
          {activeProject.scanInfo && (
            <span
              className="github-scan-badge"
              title={`Last scanned ${new Date(activeProject.scanInfo.scannedAt).toLocaleString()}`}
            >
              Scanned
            </span>
          )}
        </div>
        <div className="github-repo-input-row">
          <input
            className="field-input github-repo-input"
            type="url"
            value={activeProject.githubRepo || ''}
            onChange={(e) => {
              update('githubRepo', e.target.value);
              if (scanState !== 'idle') handleScanDismiss();
            }}
            placeholder="https://github.com/username/repo"
            spellCheck={false}
            disabled={scanState === 'scanning'}
          />
          {parseGitHubUrl(activeProject.githubRepo || '') &&
            scanState !== 'scanning' &&
            scanState !== 'preview' && (
              <button
                type="button"
                className="github-scan-btn"
                onClick={() => void handleScan()}
                title="Scan this repo to extract project context"
              >
                Scan repo
              </button>
            )}
          {scanState === 'scanning' && (
            <button type="button" className="github-scan-btn github-scan-btn--loading" disabled>
              <span className="scan-spinner" />
              Scanning...
            </button>
          )}
          {activeProject.githubRepo?.startsWith('https://github.com/') && (
            <a
              className="github-repo-link"
              href={activeProject.githubRepo}
              target="_blank"
              rel="noopener noreferrer"
              title="Open repo in browser"
            >
              Open
            </a>
          )}
        </div>

        {scanState === 'error' && (
          <div className="scan-error-msg">
            {scanError}
            <button type="button" className="scan-error-retry" onClick={() => void handleScan()}>
              Try again
            </button>
          </div>
        )}

        {scanState !== 'preview' && scanState !== 'scanning' && (
          <p className="github-repo-hint">
            {parseGitHubUrl(activeProject.githubRepo || '')
              ? 'Click "Scan repo" to automatically extract project context from this repository.'
              : 'Paste a public GitHub URL - AIs can browse your code directly from this link.'}
          </p>
        )}
      </div>

      {scanState === 'preview' && scanResult && (
        <GitHubScanPreview
          result={scanResult}
          onAccept={handleScanAccept}
          onDismiss={handleScanDismiss}
        />
      )}

      {activeProject.detectedStack &&
        activeProject.detectedStack.length > 0 &&
        scanState === 'idle' && (
          <div className="field-group">
            <div className="field-label">Detected Stack</div>
            <div className="detected-stack-chips">
              {activeProject.detectedStack.map((tech) => (
                <span key={tech} className="detected-stack-chip">
                  {tech}
                </span>
              ))}
              <button
                type="button"
                className="detected-stack-rescan"
                onClick={() => void handleScan()}
                title="Re-scan repo to update stack detection"
              >
                Rescan
              </button>
            </div>
          </div>
        )}

      <section className="connected-folder-panel" aria-label="Connected Folder">
        <div className="connected-folder-panel__header">
          <div>
            <div className="field-label">Connected Folder</div>
            <p>
              Connect an existing project folder from your device. Memephant scans locally and
              builds context from useful files.
            </p>
          </div>
          <span className={`connected-folder-panel__status${hasLinkedFolder ? ' connected-folder-panel__status--connected' : ''}`}>
            {hasLinkedFolder ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <div className="connected-folder-panel__meta">
          <span>Status: {hasLinkedFolder ? 'Connected' : 'Not connected'}</span>
          <span>Last Scan: {formatLinkedFolderTime(activeProject.linkedFolder?.lastScannedAt)}</span>
        </div>
        <p className="connected-folder-panel__privacy">
          Secrets and local paths are excluded from AI exports. Folder contents are not uploaded or synced automatically.
        </p>
        <div className="connected-folder-panel__actions">
          {hasLinkedFolder ? (
            <>
              <button type="button" className="github-scan-btn" onClick={() => void rescanLinkedFolder()}>
                Rescan Folder
              </button>
              <button type="button" className="github-scan-btn" onClick={() => void linkFolder()}>
                Change Folder
              </button>
              <button type="button" className="memory-cleanup-preview__ghost-btn" onClick={() => void unlinkFolder()}>
                Unlink Folder
              </button>
            </>
          ) : (
            <button type="button" className="github-scan-btn" onClick={() => void linkFolder()}>
              {folderActionLabel}
            </button>
          )}
        </div>
      </section>

      {hasLinkedFolder && (
        <section className="folder-scan-results-card" role="region" aria-label="Scan Results">
          <div className="folder-scan-results-card__header">
            <div>
              <div className="field-label">Scan Results</div>
              <h3>I found your project context.</h3>
            </div>
            <span className="folder-scan-results-card__badge">
              {folderScanSummary.projectType}
            </span>
          </div>

          {folderScanSummary.filesAnalysed === 0 ? (
            <div className="folder-scan-results-card__empty">
              <strong>No useful project files found yet.</strong>
              <p>Try selecting the root folder of your project.</p>
              <span>Last Scan: {formatLinkedFolderTime(activeProject.linkedFolder?.lastScannedAt)}</span>
            </div>
          ) : (
            <>
              <div className="folder-scan-results-card__stats" aria-label="Folder scan summary">
                <span>Detected Project Type: <strong>{folderScanSummary.projectType}</strong></span>
                <span>Files Analysed: <strong>{folderScanSummary.filesAnalysed}</strong></span>
                <span>Scripts Found: <strong>{folderScanSummary.scripts.length}</strong></span>
                <span>Last Scan: <strong>{formatLinkedFolderTime(activeProject.linkedFolder?.lastScannedAt)}</strong></span>
              </div>

              <div className="folder-scan-results-card__section">
                <div className="folder-scan-results-card__section-title">Important Files</div>
                <ul className="folder-scan-results-card__file-list">
                  {folderScanSummary.importantFiles.map((file) => (
                    <li key={file}>{file}</li>
                  ))}
                </ul>
              </div>

              {folderScanSummary.scripts.length > 0 && (
                <div className="folder-scan-results-card__section">
                  <div className="folder-scan-results-card__section-title">Scripts Found</div>
                  <ul className="folder-scan-results-card__script-list">
                    {folderScanSummary.scripts.map((script) => (
                      <li key={script.relativePath}>
                        <span>{script.fileName}</span>
                        <small>{script.scriptKind}</small>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {folderScanSummary.scripts.length > 0 && (
                <div
                  className="folder-scan-results-card__suggestions"
                  role="region"
                  aria-label="Suggested Script Vault entries"
                >
                  <div className="folder-scan-results-card__suggestions-header">
                    <div>
                      <div className="folder-scan-results-card__section-title">
                        Suggested Script Vault entries
                      </div>
                      <p>Turn detected scripts into portable AI context without importing code.</p>
                    </div>
                    {folderScanSummary.suggestions.length > 0 && (
                      <button
                        type="button"
                        className="github-scan-btn"
                        onClick={addAllScriptVaultSuggestions}
                      >
                        Add all to Script Vault
                      </button>
                    )}
                  </div>

                  {folderScanSummary.suggestions.length > 0 ? (
                    <ul className="folder-scan-results-card__suggestion-list">
                      {folderScanSummary.suggestions.map((suggestion) => (
                        <li key={suggestion.relativePath}>
                          <div>
                            <strong>{suggestion.fileName}</strong>
                            <small>
                              Luau - {suggestion.relatedSystem === 'Unknown'
                                ? 'Related system unknown'
                                : suggestion.relatedSystem}
                            </small>
                          </div>
                          <button
                            type="button"
                            className="memory-cleanup-preview__ghost-btn"
                            onClick={() => addScriptVaultSuggestion(suggestion)}
                            aria-label={`Add ${suggestion.fileName} to Script Vault`}
                          >
                            Add individually
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="folder-scan-results-card__all-added">
                      All detected scripts are already in the Script Vault.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}

      <div className="field-group">
        <div className="field-label">Project Category</div>
        <select
          className="field-input"
          value={activeProjectCategory}
          onChange={(event) => handleProjectCategoryChange(event.target.value as ProjectCategory)}
        >
          {PROJECT_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      {activeProjectCategory === 'other' && (
        <div className="field-group">
          <div className="field-label">Other Category</div>
          <input
            className="field-input"
            type="text"
            value={activeProject.projectCategoryOther ?? ''}
            onChange={(event) => update('projectCategoryOther', event.target.value)}
            placeholder="Describe this project category"
          />
        </div>
      )}

      {activeProjectCategory === 'game' && (
        <section className="game-context-panel" aria-label="Game project context">
          <div className="field-group">
            <div className="field-label">Game Platform</div>
            <select
              className="field-input"
              value={activeGamePlatform}
              onChange={(event) => handleGamePlatformChange(event.target.value as GamePlatform)}
            >
              {GAME_PLATFORM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          {activeGamePlatform === 'other' && (
            <div className="field-group">
              <div className="field-label">Other Game Platform</div>
              <input
                className="field-input"
                type="text"
                value={activeProject.gamePlatformOther ?? ''}
                onChange={(event) => update('gamePlatformOther', event.target.value)}
                placeholder="Example: custom web game engine"
              />
            </div>
          )}

          {activePlatformLinks.length > 0 && (
            <div className="game-platform-links" aria-label="Game platform links">
              {activePlatformLinks.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.label}
                </a>
              ))}
            </div>
          )}

          <div className="game-context-section">
            <div className="field-label">Game Overview</div>
            <div className="game-context-grid">
              <GuidedPresetField
                label="Genre"
                value={activeGameContext.overview?.genre ?? ''}
                presets={GAME_GENRE_PRESETS}
                onChange={(value) => updateGameOverview('genre', value)}
                customPlaceholder="Example: Survival tycoon"
              />
              <GuidedPresetField
                label="Target player"
                value={activeGameContext.overview?.targetPlayer ?? ''}
                presets={TARGET_PLAYER_PRESETS}
                onChange={(value) => updateGameOverview('targetPlayer', value)}
                customPlaceholder="Example: Roblox players who like social building"
              />
              <GuidedPresetField
                label="Art style"
                value={activeGameContext.overview?.artStyle ?? ''}
                presets={ART_STYLE_PRESETS}
                onChange={(value) => updateGameOverview('artStyle', value)}
                customPlaceholder="Example: Cozy farm fantasy"
              />
              <label>
                Platform target
                <input
                  className="field-input"
                  value={activeGameContext.overview?.platformTarget ?? ''}
                  onChange={(event) => updateGameOverview('platformTarget', event.target.value)}
                  placeholder="Example: Roblox mobile and desktop"
                />
              </label>
              <GuidedPresetField
                label="Monetisation plan"
                value={activeGameContext.overview?.monetisationPlan ?? ''}
                presets={MONETISATION_PRESETS}
                onChange={(value) => updateGameOverview('monetisationPlan', value)}
                customPlaceholder="Example: Optional gamepasses, cosmetics, and boosts"
                multilineCustom
              />
              <GuidedPresetField
                label="Current playable state"
                value={activeGameContext.overview?.currentPlayableState ?? ''}
                presets={PLAYABLE_STATE_PRESETS}
                onChange={(value) => updateGameOverview('currentPlayableState', value)}
                customPlaceholder="Example: Basic map, doors, currency, and one wave working"
                multilineCustom
              />
            </div>
            <div className="game-context-wide-field">
              <GuidedPresetField
                label="Core gameplay loop"
                value={activeGameContext.overview?.coreLoop ?? ''}
                presets={CORE_LOOP_PRESETS}
                onChange={(value) => updateGameOverview('coreLoop', value)}
                customPlaceholder="Example: Build base, defend waves, earn currency, upgrade systems"
                multilineCustom
              />
            </div>
          </div>

          <div className="game-context-section">
            <div className="field-label">Game Systems</div>
            <div className="game-context-grid">
              {GAME_SYSTEM_OPTIONS.map((system) => (
                <label key={system.value}>
                  {system.label}
                  <textarea
                    className="field-textarea"
                    value={activeGameContext.systems?.[system.value] ?? ''}
                    onChange={(event) => updateGameSystem(system.value, event.target.value)}
                    placeholder={`Notes for ${system.label.toLowerCase()}`}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="game-context-section">
            <div className="game-context-section__header">
              <div className="field-label">Known Bugs</div>
              <button type="button" className="list-item-add-btn" onClick={addKnownBug}>
                Add bug
              </button>
            </div>
            <div className="game-record-list">
              {(activeGameContext.knownBugs ?? []).map((bug, index) => (
                <article className="game-record-card" key={bug.id ?? index}>
                  <div className="game-record-card__header">
                    <input
                      className="field-input"
                      value={bug.title}
                      onChange={(event) => updateKnownBug(index, { ...bug, title: event.target.value })}
                      placeholder="Bug title"
                    />
                    <button
                      type="button"
                      className="list-item-remove"
                      onClick={() => removeKnownBug(index)}
                      aria-label="Remove bug"
                    >
                      x
                    </button>
                  </div>
                  <div className="game-context-grid">
                    <label>
                      System affected
                      <input
                        className="field-input"
                        value={bug.systemAffected ?? ''}
                        onChange={(event) => updateKnownBug(index, { ...bug, systemAffected: event.target.value })}
                      />
                    </label>
                    <GuidedPresetField
                      label="Status"
                      value={bug.status ?? ''}
                      presets={BUG_STATUS_PRESETS}
                      onChange={(value) => updateKnownBug(index, { ...bug, status: value })}
                      customPlaceholder="Example: Blocked until animation is replaced"
                    />
                    <label>
                      Reproduction notes
                      <textarea
                        className="field-textarea"
                        value={bug.reproductionNotes ?? ''}
                        onChange={(event) => updateKnownBug(index, { ...bug, reproductionNotes: event.target.value })}
                      />
                    </label>
                    <label>
                      Current theory
                      <textarea
                        className="field-textarea"
                        value={bug.currentTheory ?? ''}
                        onChange={(event) => updateKnownBug(index, { ...bug, currentTheory: event.target.value })}
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="game-context-section script-vault-section">
            <div className="script-vault-card" role="region" aria-label="Script Vault">
              <div className="script-vault-card__header">
                <div>
                  <div className="field-label">Script Vault</div>
                  <h3>Important scripts</h3>
                </div>
                <div className="script-vault-card__actions">
                  <button type="button" className="github-scan-btn" onClick={openScriptWorkspace}>
                    Open Script Workspace
                  </button>
                  <button type="button" className="list-item-add-btn script-vault-add-btn" onClick={() => addScriptVaultEntry(false, true)}>
                    Add script
                  </button>
                </div>
              </div>
              <p className="script-vault-card__help">
                Store important scripts here as context. This is not an IDE or Git replacement.
              </p>
              {activeGamePlatform === 'roblox' && (
                <p className="script-vault-card__help script-vault-card__help--roblox">
                  For Roblox, track LocalScripts, ModuleScripts, ServerScriptService, ReplicatedStorage,
                  RemoteEvents and DataStores.
                </p>
              )}

              {(activeGameContext.scriptVault ?? []).length === 0 ? (
                <div className="script-vault-empty-state">
                  <strong>No scripts stored yet.</strong>
                  <p>Add a lightweight record for scripts an AI should understand before helping with this game.</p>
                  <button type="button" className="github-scan-btn" onClick={() => addScriptVaultEntry(false, true)}>
                    Add first script
                  </button>
                </div>
              ) : (
                <div className="script-vault-summary">
                  <div className="script-vault-summary__meta">
                    <strong>{scriptVaultEntries.length}</strong>
                    <span>{scriptVaultEntries.length === 1 ? 'script stored' : 'scripts stored'}</span>
                  </div>
                  <div className="script-vault-summary__list" aria-label="Stored scripts">
                    {scriptVaultEntries.map((script, index) => (
                      <button
                        key={script.id ?? index}
                        type="button"
                        className="script-vault-summary__item"
                        onClick={() => openScriptWorkspaceForScript(index)}
                        aria-label={`Open ${scriptSummaryLabel(script, index, scriptVaultEntries)} in Script Workspace`}
                      >
                        <span>{scriptSummaryLabel(script, index, scriptVaultEntries)}</span>
                        <small>{script.status || 'No status'} / {script.relatedSystem || 'No system'}</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {showScriptWorkspace && (
        <div className="script-workspace-backdrop" role="presentation">
          <section className="script-workspace" role="dialog" aria-modal="true" aria-label="Script Workspace">
            <div className="script-workspace__header">
              <div>
                <div className="field-label">Script Workspace</div>
                <h2>Script context workspace</h2>
                {activeGamePlatform === 'roblox' && (
                  <p>
                    Useful for LocalScripts, ModuleScripts, ServerScriptService scripts,
                    RemoteEvent handlers and DataStore logic.
                  </p>
                )}
              </div>
              <button
                type="button"
                className="script-workspace__close"
                onClick={() => setScriptWorkspaceOpen(false)}
                aria-label="Close Script Workspace"
              >
                Close
              </button>
            </div>

            <div className="script-workspace__body">
              <aside className="script-workspace__list" aria-label="Script list">
                <div className="script-workspace__list-header">
                  <span>Scripts</span>
                  <button type="button" className="list-item-add-btn" onClick={addScriptFromWorkspace}>
                    Add script
                  </button>
                </div>

                {scriptVaultEntries.length === 0 ? (
                  <div className="script-workspace__empty">
                    <strong>No scripts yet.</strong>
                    <p>Add a script record to paste and preserve context.</p>
                  </div>
                ) : (
                  <div className="script-workspace__script-list">
                    {scriptVaultEntries.map((script, index) => (
                      <button
                        key={script.id ?? `${script.scriptName}-${index}`}
                        type="button"
                        className={`script-workspace__script-item${index === safeSelectedScriptIndex ? ' script-workspace__script-item--active' : ''}`}
                        onClick={() => setSelectedScriptIndex(index)}
                        aria-label={`Select script ${scriptSummaryLabel(script, index, scriptVaultEntries)}`}
                      >
                        <span>{scriptSummaryLabel(script, index, scriptVaultEntries)}</span>
                        <small>{script.status || 'No status'} / {script.relatedSystem || 'No system'}</small>
                        <em>{script.includeInContextPassport ? 'Snippet included' : 'Snippet excluded'}</em>
                      </button>
                    ))}
                  </div>
                )}

                <div className="script-workspace__list-actions">
                  <button type="button" className="memory-cleanup-preview__ghost-btn" onClick={duplicateScriptFromWorkspace} disabled={!selectedScript}>
                    Duplicate script
                  </button>
                  <button type="button" className="memory-cleanup-preview__ghost-btn" onClick={deleteScriptFromWorkspace} disabled={!selectedScript}>
                    Delete script
                  </button>
                </div>
              </aside>

              <main className="script-workspace__editor">
                <label>
                  Script content
                  <textarea
                    className="script-workspace__code"
                    value={selectedScript?.codeSnippet ?? ''}
                    onChange={(event) => updateSelectedScript({ codeSnippet: event.target.value })}
                    placeholder="Paste a Roblox Studio, VS Code, Cursor, or AI-generated script snippet here."
                    spellCheck={false}
                    disabled={!selectedScript}
                  />
                </label>
              </main>

              <aside className="script-workspace__details" aria-label="Script details">
                {selectedScript ? (
                  <>
                    <label>
                      Script name
                      <input
                        className="field-input"
                        value={selectedScript.scriptName}
                        onChange={(event) => updateSelectedScript({ scriptName: event.target.value })}
                        placeholder="NPCSpawner.lua"
                      />
                    </label>

                    <GuidedPresetField
                      label="Platform/language"
                      value={selectedScript.platformLanguage ?? ''}
                      presets={SCRIPT_LANGUAGE_PRESETS}
                      onChange={(value) => updateSelectedScript({ platformLanguage: value })}
                      placeholder="Choose language..."
                      customPlaceholder="Example: Roblox Lua variant"
                    />

                    <GuidedPresetField
                      label="Related system"
                      value={selectedScript.relatedSystem ?? ''}
                      presets={RELATED_SYSTEM_PRESETS}
                      onChange={(value) => updateSelectedScript({ relatedSystem: value })}
                      customPlaceholder="Example: NPC waves"
                    />

                    <GuidedPresetField
                      label="Status"
                      value={selectedScript.status ?? ''}
                      presets={SCRIPT_STATUS_PRESETS}
                      onChange={(value) => updateSelectedScript({ status: value })}
                      customPlaceholder="Example: Works locally, not multiplayer-safe"
                    />

                    <label>
                      Purpose
                      <textarea
                        className="field-textarea"
                        value={selectedScript.purpose ?? ''}
                        onChange={(event) => updateSelectedScript({ purpose: event.target.value })}
                        placeholder="What this script is responsible for"
                      />
                    </label>

                    <label>
                      Notes
                      <textarea
                        className="field-textarea"
                        value={selectedScript.notes ?? ''}
                        onChange={(event) => updateSelectedScript({ notes: event.target.value })}
                        placeholder="Known issues, assumptions, handoff notes"
                      />
                    </label>

                    <label className="script-workspace__toggle">
                      <input
                        type="checkbox"
                        aria-label="Include full snippet in Context Passport"
                        checked={selectedScript.includeInContextPassport === true}
                        onChange={(event) => updateSelectedScript({ includeInContextPassport: event.target.checked })}
                      />
                      <span>
                        Include full snippet in Context Passport
                        <small>Metadata stays available; full code is opt-in.</small>
                      </span>
                    </label>

                    <div className="script-workspace__copy-actions">
                      <button type="button" className="github-scan-btn" onClick={copySelectedScript}>
                        Copy script
                      </button>
                      <button type="button" className="github-scan-btn" onClick={copySelectedScriptAiPrompt}>
                        Copy AI help prompt
                      </button>
                      <button type="button" className="github-scan-btn" onClick={copySelectedScriptContext}>
                        Copy script context
                      </button>
                    </div>

                    <button
                      type="button"
                      className="script-workspace__done"
                      onClick={() => setScriptWorkspaceOpen(false)}
                    >
                      Done
                    </button>
                  </>
                ) : (
                  <div className="script-workspace__empty">
                    <strong>No script selected.</strong>
                    <p>Add a script to start preserving script context.</p>
                    <button type="button" className="github-scan-btn" onClick={addScriptFromWorkspace}>
                      Add script
                    </button>
                  </div>
                )}
              </aside>
            </div>
          </section>
        </div>
      )}

      {pendingScriptDuplicateConfirmation && (
        <div className="script-duplicate-confirmation-backdrop" role="presentation">
          <section
            className="script-duplicate-confirmation"
            role="dialog"
            aria-modal="true"
            aria-label="Duplicate script confirmation"
          >
            <h2>Duplicate script name</h2>
            <p>
              A script named {pendingScriptDuplicateConfirmation.existingName} already exists.
            </p>
            <p>Do you want to create another copy anyway?</p>
            <div className="script-duplicate-confirmation__actions">
              <button
                type="button"
                className="memory-cleanup-preview__ghost-btn"
                onClick={cancelScriptDuplicate}
              >
                Cancel
              </button>
              <button
                type="button"
                className="github-scan-btn"
                onClick={confirmScriptDuplicate}
              >
                Create duplicate
              </button>
            </div>
          </section>
        </div>
      )}

      <EditableField
        label="Summary"
        value={activeProject.summary}
        onChange={(v) => update('summary', v)}
        multiline
        placeholder="Write a simple explanation so any AI can quickly understand this project."
        onSuggest={() => handleSuggest('summary')}
        suggestLabel={activeProject.summary?.trim() ? 'Regenerate' : 'Auto-fill'}
      />

      <EditableField
        label="What this project is about"
        value={activeProject.currentState}
        onChange={(v) => update('currentState', v)}
        multiline
        placeholder="Describe what's been built and what still needs doing."
        onSuggest={() => handleSuggest('currentState')}
        suggestLabel={activeProject.currentState?.trim() ? 'Regenerate' : 'Auto-fill'}
      />

      <EditableList
        label="Goals"
        items={activeProject.goals}
        onChange={(v) => update('goals', v)}
        placeholder="Add a goal..."
        onSuggest={() => handleSuggest('goals')}
      />

      <EditableList
        label="Rules"
        items={activeProject.rules}
        onChange={(v) => update('rules', v)}
        placeholder="Add a rule..."
      />

      <DecisionList decisions={activeProject.decisions} onChange={(v) => update('decisions', v)} />

      <EditableList
        label="Next Steps"
        items={activeProject.nextSteps}
        onChange={(v) => update('nextSteps', v)}
        placeholder="Add a next step..."
      />

      <EditableList
        label="Open Questions"
        items={activeProject.openQuestions}
        onChange={(v) => update('openQuestions', v)}
        placeholder="Add a question..."
      />

      <EditableList
        label="Important Files & Assets"
        items={activeProject.importantAssets}
        onChange={(v) => update('importantAssets', v)}
        placeholder="Add a file or asset path..."
        collapsibleSelectedItems
      />

      <div className="field-group">
        <div className="field-label">Memory Core File</div>
        <div className="github-repo-input-row">
          <button
            type="button"
            className="github-scan-btn"
            onClick={() => void handleCopyHippocampus()}
            title="Copy generated .memephant/hippocampus.md markdown to clipboard"
          >
            Copy hippocampus.md
          </button>
          <button
            type="button"
            className="github-scan-btn"
            onClick={() => handleDownloadHippocampus()}
            title="Download .memephant/hippocampus.md as a file"
          >
            Download hippocampus.md
          </button>
          <button
            type="button"
            className="github-scan-btn"
            onClick={() => handlePreviewCleanup()}
            title="Preview cleanup of placeholder, duplicate, and noisy memory values"
          >
            Clean project memory
          </button>
        </div>
        <p className="github-repo-hint">
          Copies or downloads a portable Memory Core markdown file. This does not write to your linked folder yet.
        </p>
        {cleanupPreview && (
          <div className="memory-cleanup-preview">
            <div className="memory-cleanup-preview__header">
              <div>
                <div className="memory-cleanup-preview__title">Cleanup preview</div>
                <div className="memory-cleanup-preview__meta">
                  {cleanupPreview.hasChanges
                    ? `${cleanupPreview.fieldsChanged.length} field${cleanupPreview.fieldsChanged.length === 1 ? '' : 's'} would change`
                    : 'No cleanup changes found'}
                </div>
              </div>
              <button
                type="button"
                className="memory-cleanup-preview__ghost-btn"
                onClick={() => setCleanupPreview(null)}
              >
                Dismiss
              </button>
            </div>

            {cleanupPreview.hasChanges ? (
              <>
                <div className="memory-cleanup-preview__section">
                  <strong>Fields changed</strong>
                  <p>{cleanupPreview.fieldsChanged.join(', ')}</p>
                </div>

                {cleanupPreview.removedPlaceholderValues.length > 0 && (
                  <div className="memory-cleanup-preview__section">
                    <strong>Placeholder values removed</strong>
                    <ul>
                      {cleanupPreview.removedPlaceholderValues.slice(0, 6).map((item, index) => (
                        <li key={`${item.field}-${index}`}>
                          {item.field}: {item.value}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {cleanupPreview.removedDuplicateValues.length > 0 && (
                  <div className="memory-cleanup-preview__section">
                    <strong>Duplicates removed</strong>
                    <ul>
                      {cleanupPreview.removedDuplicateValues.slice(0, 6).map((item, index) => (
                        <li key={`${item.field}-${index}`}>
                          {item.field}: {item.value}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {cleanupPreview.removedNoisyAssets.length > 0 && (
                  <div className="memory-cleanup-preview__section">
                    <strong>Noisy assets removed</strong>
                    <ul>
                      {cleanupPreview.removedNoisyAssets.slice(0, 6).map((asset) => (
                        <li key={asset}>{asset}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="memory-cleanup-preview__actions">
                  <button
                    type="button"
                    className="github-scan-btn"
                    onClick={() => handleApplyCleanup()}
                  >
                    Apply cleanup
                  </button>
                  <button
                    type="button"
                    className="memory-cleanup-preview__ghost-btn"
                    onClick={() => setCleanupPreview(null)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <p className="memory-cleanup-preview__empty">
                No known placeholder, duplicate, or noisy memory values were found.
              </p>
            )}
          </div>
        )}
        <details className="hippocampus-preview">
          <summary>Preview hippocampus.md</summary>
          <pre>{hippocampusPreview}</pre>
        </details>
      </div>

      <div className="field-group">
        <div className="field-label">Working Memory File</div>
        <div className="github-repo-input-row">
          <button
            type="button"
            className="github-scan-btn"
            onClick={() => void handleCopyPrefrontal()}
            title="Copy generated .memephant/prefrontal.md markdown to clipboard"
          >
            Copy prefrontal.md
          </button>
          <button
            type="button"
            className="github-scan-btn"
            onClick={() => handleDownloadPrefrontal()}
            title="Download .memephant/prefrontal.md as a file"
          >
            Download prefrontal.md
          </button>
        </div>
        <p className="github-repo-hint">
          Short-term working memory for the current session — what is happening right now. This does not write to your linked folder.
        </p>
        <details className="hippocampus-preview">
          <summary>Preview prefrontal.md</summary>
          <pre>{prefrontalPreview}</pre>
        </details>
      </div>

      <EditableField
        label="Memory Core"
        value={activeProject.projectCharter || ''}
        onChange={(v) => update('projectCharter', v)}
        multiline
        helpText="The permanent project identity layer: values, working rules, boundaries, communication style, and long-term context every AI should remember."
        placeholder="Describe how AI agents should understand this project: values, working style, boundaries, communication rules, and things that must not be forgotten."
      />

      <EditableField
        label="How the AI should help"
        value={activeProject.aiInstructions || ''}
        onChange={(v) => update('aiInstructions', v)}
        multiline
        placeholder="Any specific instructions for how AIs should work on this project."
      />

      <RecentActivityBlock
        markdown={markdown}
        loading={loading}
        error={error}
      />
    </div>
  );
}

export default ProjectEditor;
