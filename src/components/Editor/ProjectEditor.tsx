import { useState, useCallback, useMemo } from 'react';
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
import { restoreProjectFromHistory } from '../../services/tauriActions';
import { RecentActivityBlock } from '../RecentActivityBlock';
import type { GitHubScanResult } from '../../services/githubScanner';
import type {
  GameOverview,
  GamePlatform,
  GameProjectContext,
  GameSystemKey,
  KnownGameBug,
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

function formatRestorePointTime(isoString: string): string {
  return new Date(isoString).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
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

  const removeScriptVaultEntry = (index: number) => {
    updateGameContext({
      ...activeGameContext,
      scriptVault: (activeGameContext.scriptVault ?? []).filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const addScriptVaultEntry = () => {
    updateGameContext({
      ...activeGameContext,
      scriptVault: [
        ...(activeGameContext.scriptVault ?? []),
        {
          id: nextRecordId('script'),
          scriptName: '',
          platformLanguage: activeGamePlatform === 'roblox' ? 'Luau' : '',
          status: 'Active',
        },
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
              <label>
                Genre
                <input
                  className="field-input"
                  value={activeGameContext.overview?.genre ?? ''}
                  onChange={(event) => updateGameOverview('genre', event.target.value)}
                  placeholder="Example: Survival tycoon"
                />
              </label>
              <label>
                Target player
                <input
                  className="field-input"
                  value={activeGameContext.overview?.targetPlayer ?? ''}
                  onChange={(event) => updateGameOverview('targetPlayer', event.target.value)}
                  placeholder="Example: Casual Roblox players"
                />
              </label>
              <label>
                Art style
                <input
                  className="field-input"
                  value={activeGameContext.overview?.artStyle ?? ''}
                  onChange={(event) => updateGameOverview('artStyle', event.target.value)}
                  placeholder="Example: Bright low-poly"
                />
              </label>
              <label>
                Platform target
                <input
                  className="field-input"
                  value={activeGameContext.overview?.platformTarget ?? ''}
                  onChange={(event) => updateGameOverview('platformTarget', event.target.value)}
                  placeholder="Example: Roblox mobile and desktop"
                />
              </label>
              <label>
                Monetisation plan
                <textarea
                  className="field-textarea"
                  value={activeGameContext.overview?.monetisationPlan ?? ''}
                  onChange={(event) => updateGameOverview('monetisationPlan', event.target.value)}
                  placeholder="Example: Optional gamepasses, cosmetics, and boosts"
                />
              </label>
              <label>
                Current playable state
                <textarea
                  className="field-textarea"
                  value={activeGameContext.overview?.currentPlayableState ?? ''}
                  onChange={(event) => updateGameOverview('currentPlayableState', event.target.value)}
                  placeholder="Example: Basic map, doors, currency, and one wave working"
                />
              </label>
            </div>
            <label className="game-context-wide-field">
              Core gameplay loop
              <textarea
                className="field-textarea"
                value={activeGameContext.overview?.coreLoop ?? ''}
                onChange={(event) => updateGameOverview('coreLoop', event.target.value)}
                placeholder="Example: Build base, defend waves, earn currency, upgrade systems"
              />
            </label>
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
                    <label>
                      Status
                      <input
                        className="field-input"
                        value={bug.status ?? ''}
                        onChange={(event) => updateKnownBug(index, { ...bug, status: event.target.value })}
                      />
                    </label>
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

          <div className="game-context-section">
            <div className="game-context-section__header">
              <div className="field-label">Script Vault</div>
              <button type="button" className="list-item-add-btn" onClick={addScriptVaultEntry}>
                Add script
              </button>
            </div>
            <div className="game-record-list">
              {(activeGameContext.scriptVault ?? []).map((script, index) => (
                <article className="game-record-card" key={script.id ?? index}>
                  <div className="game-record-card__header">
                    <input
                      className="field-input"
                      value={script.scriptName}
                      onChange={(event) => updateScriptVaultEntry(index, { ...script, scriptName: event.target.value })}
                      placeholder={activeGamePlatform === 'roblox' ? 'NPCSpawner.lua' : 'Script name'}
                    />
                    <button
                      type="button"
                      className="list-item-remove"
                      onClick={() => removeScriptVaultEntry(index)}
                      aria-label="Remove script"
                    >
                      x
                    </button>
                  </div>
                  <div className="game-context-grid">
                    <label>
                      Platform/language
                      <input
                        className="field-input"
                        value={script.platformLanguage ?? ''}
                        onChange={(event) => updateScriptVaultEntry(index, { ...script, platformLanguage: event.target.value })}
                        placeholder={activeGamePlatform === 'roblox' ? 'Luau' : 'Language'}
                      />
                    </label>
                    <label>
                      Related system
                      <input
                        className="field-input"
                        value={script.relatedSystem ?? ''}
                        onChange={(event) => updateScriptVaultEntry(index, { ...script, relatedSystem: event.target.value })}
                        placeholder="Example: NPC waves"
                      />
                    </label>
                    <label>
                      Status
                      <input
                        className="field-input"
                        value={script.status ?? ''}
                        onChange={(event) => updateScriptVaultEntry(index, { ...script, status: event.target.value })}
                        placeholder="Example: Working, buggy, planned"
                      />
                    </label>
                    <label>
                      Purpose
                      <textarea
                        className="field-textarea"
                        value={script.purpose ?? ''}
                        onChange={(event) => updateScriptVaultEntry(index, { ...script, purpose: event.target.value })}
                      />
                    </label>
                    <label>
                      Notes
                      <textarea
                        className="field-textarea"
                        value={script.notes ?? ''}
                        onChange={(event) => updateScriptVaultEntry(index, { ...script, notes: event.target.value })}
                      />
                    </label>
                    <label>
                      Optional code snippet
                      <textarea
                        className="field-textarea game-code-snippet"
                        value={script.codeSnippet ?? ''}
                        onChange={(event) => updateScriptVaultEntry(index, { ...script, codeSnippet: event.target.value })}
                        spellCheck={false}
                      />
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
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
