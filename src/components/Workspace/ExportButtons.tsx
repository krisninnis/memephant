import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useActiveProject } from '../../hooks/useActiveProject';
import { useRecentActivity } from '../../hooks/useRecentActivity';
import {
  copyExportToClipboard,
  generateStateManifest,
  getFilesChangedSince,
} from '../../services/tauriActions';
import {
  formatForClaudeWithManifest,
  formatForPlatform,
  setScannerLevel,
} from '../../utils/exportFormatters';
import { buildContinuityPreamble } from '../../utils/platformConfig';
import {
  buildMemoryBridgeBlock,
  type MemoryBridgeMode,
} from '../../utils/memoryBridge';
import { getChangesSince } from '../../utils/getChangesSince';
import {
  buildFrontalLobeExportBlock,
  getFrontalLobeExportStatus,
  shouldIncludeFrontalLobe,
} from '../../utils/frontalLobeExport';
import { loadPersonalMemoryVault } from '../../services/personalMemoryVaultStorage';
import { scoreExport } from '../../utils/exportQuality';
import {
  analyzeExportHealth,
  compressExportForPaste,
  type ExportHealthResult,
} from '../../utils/exportHealth';
import { usePassportStore } from '../../features/passport/usePassportStore';
import {
  appendPassportAttachment,
  buildPassportAttachmentPreview,
  type PassportAttachmentPreview,
  type PassportAttachmentStatus,
} from '../../features/passport/passportAttachment';
import {
  isPassportLockEnabled,
  verifyPassportPasscode,
} from '../../services/passportLockStorage';
import {
  ensureValidPlatformId,
  getEnabledPlatforms,
  getPlatformConfig,
} from '../../utils/platformRegistry';
import type { AIWorkflowMode, ExportMode, HandoffMode } from '../../types/memphant-types';
import { ContextPassportModal } from './ContextPassportModal';
import { ExportHistoryModal } from './ExportHistoryModal';
import { ExportDiffPanel } from './ExportDiffPanel';
import { getExportDiffSummary } from '../../utils/getExportDiffSummary';
import { defaultPassportStyleSettings } from '../../utils/passportStyleSettings';
import { applyPassportStyleSettings } from '../../utils/passportStyleTransform';
import { DEMO_PROJECT_ID } from '../../utils/demoProject';
import { WORKFLOW_MODES, getWorkflowModeConfig } from '../../utils/workflowModes';

function formatSyncAge(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffM = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (diffM < 2) return 'Just now';
  if (diffH < 1) return `${diffM}m ago`;
  if (diffD < 1) return `${diffH}h ago`;
  if (diffD === 1) return 'Yesterday';
  return `${diffD}d ago`;
}

function formatCheckpointTime(isoString: string): string {
  return new Date(isoString).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type CopyOption = {
  id: 'quick' | 'full' | 'delta' | 'specialist' | 'deep-state';
  label: string;
  busyLabel?: string;
  onSelect: () => Promise<void>;
  disabled?: boolean;
};

type PreviewMode = ExportMode | 'deep-state';

type ExportPreview = {
  mode: PreviewMode;
  modeLabel: string;
  targetPlatformId: string;
  targetPlatformName: string;
  copyPlatformId: string;
  baseExportText: string;
  exportText: string;
  aiWorkingStyleStatus: string;
  aiWorkingStyleIncluded: boolean;
  recentActivityIncluded: boolean;
  characterCount: number;
  compressedExportText: string;
  health: ExportHealthResult;
  changedFiles: string[];
  passportAttachment: PassportAttachmentPreview | null;
  passportAttachmentIncluded: boolean;
  passportAttachmentStatus: PassportAttachmentStatus;
};

function getPreviewModeLabel(mode: PreviewMode): string {
  if (mode === 'quick') return 'Quick Start Export';
  if (mode === 'delta') return 'Essentials';
  if (mode === 'specialist') return 'Specific task';
  if (mode === 'deep-state') return 'Full context + deep state';
  if (mode === 'smart') return 'Smart';
  return 'Full context';
}

function getCopiedModeLabel(mode: PreviewMode): string {
  if (mode === 'quick') return 'quick start context';
  if (mode === 'delta') return 'just the essentials';
  if (mode === 'specialist') return 'a specific task';
  if (mode === 'deep-state') return 'full context and deeper project memory';
  if (mode === 'smart') return 'concise context';
  return 'full context';
}

function getDefaultPreviewMode(
  platformId: string,
  project?: { platformState?: Partial<Record<string, { lastExportedAt?: string }>> } | null,
): ExportMode {
  const isFirstExport = !project?.platformState?.[platformId]?.lastExportedAt;
  return platformId === 'chatgpt' || isFirstExport ? 'quick' : 'full';
}

function getPassportAttachmentExplanation(status: PassportAttachmentStatus): string {
  if (status === 'included') {
    return 'Your AI working identity will be included in this handoff.';
  }

  if (status === 'locked') {
    return 'Unlock Passport to attach it.';
  }

  return 'Your project context will be copied without your AI working identity.';
}

export function ExportButtons() {
  const [copied, setCopied] = useState(false);
  const [postCopyGuidanceVisible, setPostCopyGuidanceVisible] = useState(false);
  const [manifestCopied, setManifestCopied] = useState(false);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);
  const [exportHistoryOpen, setExportHistoryOpen] = useState(false);
  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [passportUnlocked, setPassportUnlocked] = useState(false);
  const [passportUnlockInput, setPassportUnlockInput] = useState('');
  const [passportUnlockError, setPassportUnlockError] = useState('');
  const [passportPreviewVisible, setPassportPreviewVisible] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [handoffMode, setHandoffMode] = useState<HandoffMode>('continue');
  const [contextOpen, setContextOpen] = useState(false);
  const [switchReason, setSwitchReason] = useState('');
  const [styleSettings, setStyleSettings] = useState(defaultPassportStyleSettings);
  const [writingOptionsOpen, setWritingOptionsOpen] = useState(false);
  const postCopyGuidanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Frontal Lobe / AI Working Style inclusion ─────────────────────────────
  const [vault] = useState(() => loadPersonalMemoryVault());
  const frontalLobeMode = vault.frontalLobeProfile?.mode ?? 'default_on';
  const [includeFrontalLobe, setIncludeFrontalLobe] = useState(false);
  const hasFrontalLobeProfile = Boolean(vault.frontalLobeProfile);
  const passportProfile = usePassportStore((s) => s.passport);
  const passportLockEnabled = isPassportLockEnabled();
  const passportLocked = passportLockEnabled && !passportUnlocked;
  const passportAttachmentPreview = passportProfile
    ? buildPassportAttachmentPreview(passportProfile, vault.frontalLobeProfile)
    : null;
  const frontalLobeStatus = getFrontalLobeExportStatus(
    frontalLobeMode,
    hasFrontalLobeProfile,
    includeFrontalLobe,
  );
  const frontalLobeBlock =
    vault.frontalLobeProfile && shouldIncludeFrontalLobe(frontalLobeMode, includeFrontalLobe)
      ? buildFrontalLobeExportBlock(vault.frontalLobeProfile)
      : undefined;
  const targetPlatform = useProjectStore((s) => s.targetPlatform);
  const setTargetPlatform = useProjectStore((s) => s.setTargetPlatform);
  const currentTask = useProjectStore((s) => s.currentTask);
  const showToast = useProjectStore((s) => s.showToast);
  const settings = useProjectStore((s) => s.settings);
  const memoryBridgeMode = useProjectStore((s) => s.memoryBridgeMode);
  const setMemoryBridgeMode = useProjectStore((s) => s.setMemoryBridgeMode);
  const updateLastAiSession = useProjectStore((s) => s.updateLastAiSession);
  const updateProject = useProjectStore((s) => s.updateProject);

  const activeProject = useActiveProject();
  const { markdown: recentActivity } = useRecentActivity(
    activeProject?.id ?? '',
    activeProject?.linkedFolder?.path ?? '',
  );

  const enabledPlatforms = useMemo(
    () => getEnabledPlatforms(settings.platforms),
    [settings.platforms],
  );

  useEffect(() => {
    const nextPlatformId = ensureValidPlatformId(
      targetPlatform,
      settings.platforms,
      settings.general.defaultPlatform,
    );

    if (nextPlatformId !== targetPlatform) {
      setTargetPlatform(nextPlatformId);
    }
  }, [targetPlatform, settings, setTargetPlatform]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  useEffect(() => () => {
    if (postCopyGuidanceTimerRef.current) {
      clearTimeout(postCopyGuidanceTimerRef.current);
    }
  }, []);

  const selectedPlatformId = ensureValidPlatformId(
    targetPlatform,
    settings.platforms,
    settings.general.defaultPlatform,
  );

  const selectedPlatform = getPlatformConfig(
    selectedPlatformId,
    settings.platforms,
  );

  const selectedProject = activeProject;

  const lastSeenAt = selectedProject?.platformState?.[selectedPlatform.id]?.lastSeenAt;

  const recentChanges = selectedProject
    ? getChangesSince(selectedProject, lastSeenAt)
    : [];

  const chatPlatforms = enabledPlatforms.filter((p) => p.category === 'chat');
  const devPlatforms = enabledPlatforms.filter((p) => p.category === 'dev');
  const localPlatforms = enabledPlatforms.filter((p) => p.category === 'local');

  const selectedPlatformState = selectedProject?.platformState?.[selectedPlatform.id];

  const syncLabel = selectedPlatformState?.lastExportedAt
    ? formatSyncAge(selectedPlatformState.lastExportedAt)
    : null;

  const quality = activeProject ? scoreExport(activeProject) : null;

  const allCheckpoints = activeProject?.checkpoints ?? [];

  const latestAnyCheckpoint =
    allCheckpoints.length > 0 ? allCheckpoints[allCheckpoints.length - 1] : undefined;

  const latestCheckpoint =
    [...allCheckpoints].reverse().find((c) => c.platform === selectedPlatform.id)
    ?? latestAnyCheckpoint;

  const checkpointSummary = latestCheckpoint
    ? `Last checkpoint saved ${formatSyncAge(latestCheckpoint.timestamp)}.`
    : 'Every copy saves a checkpoint before anything is pasted back in.';

  const changeSummary = !activeProject
    ? 'Open a project to prepare an AI handoff.'
    : recentChanges.length > 0
      ? `${recentChanges.length} tracked change${recentChanges.length === 1 ? '' : 's'} ready for the next handoff.`
      : syncLabel
        ? `No tracked changes since your last ${selectedPlatform.name} copy.`
        : `Your first copy for ${selectedPlatform.name} will create a checkpoint snapshot.`;
  const isDemoProject = activeProject?.id === DEMO_PROJECT_ID;
  const activeWorkflowMode = getWorkflowModeConfig(activeProject?.workflowMode);

  const handleWorkflowModeChange = useCallback((mode: AIWorkflowMode) => {
    if (!activeProject) return;

    updateProject(activeProject.id, {
      workflowMode: activeProject.workflowMode === mode ? undefined : mode,
    });
  }, [activeProject, updateProject]);

  const handleSelectPlatform = (platformId: string) => {
    if (platformId !== selectedPlatform.id) {
      setTargetPlatform(platformId);
    }
  };

  const prepareExportForMemoryMode = useCallback((exportText: string) => {
    if (!activeProject || memoryBridgeMode !== 'auto') {
      return exportText;
    }

    return buildMemoryBridgeBlock(activeProject, selectedPlatform.id);
  }, [activeProject, memoryBridgeMode, selectedPlatform.id]);

  const createPreviewResult = useCallback((
    preview: Omit<
      ExportPreview,
      | 'baseExportText'
      | 'exportText'
      | 'characterCount'
      | 'compressedExportText'
      | 'health'
      | 'passportAttachment'
      | 'passportAttachmentIncluded'
      | 'passportAttachmentStatus'
    > & { exportText: string },
  ): ExportPreview => {
    const passportAttachmentStatus: PassportAttachmentStatus = passportLocked
      ? 'locked'
      : 'excluded';
    const health = analyzeExportHealth(preview.exportText);

    return {
      ...preview,
      baseExportText: preview.exportText,
      exportText: preview.exportText,
      characterCount: preview.exportText.length,
      compressedExportText: compressExportForPaste(preview.exportText),
      health,
      passportAttachment: passportAttachmentPreview,
      passportAttachmentIncluded: false,
      passportAttachmentStatus,
    };
  }, [passportAttachmentPreview, passportLocked]);

  const buildExportPreview = useCallback(async (mode: ExportMode): Promise<ExportPreview> => {
    if (!activeProject) {
      throw new Error('Open a project first');
    }

    setScannerLevel(settings.privacy.secretsScannerLevel);

    const exportText = formatForPlatform(
      activeProject,
      selectedPlatform.id,
      currentTask,
      mode,
      selectedPlatform,
      recentActivity,
      frontalLobeBlock,
    );

    const lastExportAt = activeProject.platformState?.[selectedPlatform.id]?.lastExportedAt;
    const changedFiles = lastExportAt && activeProject.linkedFolder?.path
      ? await getFilesChangedSince(activeProject.linkedFolder.path, lastExportAt)
      : [];

    const sessionForPreamble = mode !== 'quick' && activeProject.lastAiSession
      ? { ...activeProject.lastAiSession, filesChangedSince: changedFiles }
      : undefined;
    const preamble = buildContinuityPreamble(sessionForPreamble, selectedPlatform.id);
    const preparedExportText = mode === 'quick'
      ? exportText
      : prepareExportForMemoryMode(exportText);
    const finalExportText = preamble + preparedExportText;
    const aiWorkingStyleIncluded = Boolean(frontalLobeBlock)
      && finalExportText.includes('# AI Working Style');

    return createPreviewResult({
      mode,
      modeLabel: getPreviewModeLabel(mode),
      targetPlatformId: selectedPlatform.id,
      targetPlatformName: selectedPlatform.name,
      copyPlatformId: selectedPlatform.id,
      exportText: finalExportText,
      aiWorkingStyleStatus: frontalLobeStatus,
      aiWorkingStyleIncluded,
      recentActivityIncluded: mode !== 'quick'
        && memoryBridgeMode !== 'auto'
        && Boolean(recentActivity?.trim()),
      changedFiles,
    });
  }, [
    activeProject,
    createPreviewResult,
    currentTask,
    frontalLobeBlock,
    frontalLobeStatus,
    memoryBridgeMode,
    prepareExportForMemoryMode,
    recentActivity,
    selectedPlatform,
    settings.privacy.secretsScannerLevel,
  ]);

  const buildDeepStatePreview = useCallback(async (): Promise<ExportPreview> => {
    if (!activeProject) {
      throw new Error('Open a project first');
    }

    setScannerLevel(settings.privacy.secretsScannerLevel);

    const manifest = await generateStateManifest(activeProject);
    const exportText = formatForClaudeWithManifest(
      activeProject,
      manifest.text,
      manifest.digest,
      currentTask,
      recentActivity,
      frontalLobeBlock,
    );

    const lastExportAt = activeProject.platformState?.[selectedPlatform.id]?.lastExportedAt;
    const changedFiles = lastExportAt && activeProject.linkedFolder?.path
      ? await getFilesChangedSince(activeProject.linkedFolder.path, lastExportAt)
      : [];

    const sessionForPreamble = activeProject.lastAiSession
      ? { ...activeProject.lastAiSession, filesChangedSince: changedFiles }
      : undefined;
    const preamble = buildContinuityPreamble(sessionForPreamble, selectedPlatform.id);
    const preparedExportText = prepareExportForMemoryMode(exportText);
    const finalExportText = preamble + preparedExportText;
    const aiWorkingStyleIncluded = Boolean(frontalLobeBlock)
      && finalExportText.includes('# AI Working Style');

    return createPreviewResult({
      mode: 'deep-state',
      modeLabel: getPreviewModeLabel('deep-state'),
      targetPlatformId: selectedPlatform.id,
      targetPlatformName: selectedPlatform.name,
      copyPlatformId: 'claude',
      exportText: finalExportText,
      aiWorkingStyleStatus: frontalLobeStatus,
      aiWorkingStyleIncluded,
      recentActivityIncluded: memoryBridgeMode !== 'auto' && Boolean(recentActivity?.trim()),
      changedFiles,
    });
  }, [
    activeProject,
    createPreviewResult,
    currentTask,
    frontalLobeBlock,
    frontalLobeStatus,
    memoryBridgeMode,
    prepareExportForMemoryMode,
    recentActivity,
    selectedPlatform.id,
    selectedPlatform.name,
    settings.privacy.secretsScannerLevel,
  ]);

  const handleInspectExport = useCallback(async (mode: PreviewMode = 'full') => {
    if (!activeProject) {
      showToast('Open a project first', 'error');
      return;
    }

    try {
      setPreviewLoading(true);
      if (mode === 'deep-state') setManifestLoading(true);

      const preview = mode === 'deep-state'
        ? await buildDeepStatePreview()
        : await buildExportPreview(mode);

      setExportPreview(preview);
      setPassportPreviewVisible(false);
      setMenuOpen(false);
    } catch (err) {
      console.error('Export preview failed:', err);
      showToast('Failed to prepare export preview', 'error');
    } finally {
      setPreviewLoading(false);
      if (mode === 'deep-state') setManifestLoading(false);
    }
  }, [
    activeProject,
    buildDeepStatePreview,
    buildExportPreview,
    showToast,
  ]);

  const updatePassportAttachment = useCallback((include: boolean) => {
    setExportPreview((preview) => {
      if (!preview) return preview;
      const canAttach = include
        && preview.passportAttachment
        && preview.passportAttachmentStatus !== 'locked';
      const exportText = canAttach
        ? appendPassportAttachment(preview.baseExportText, preview.passportAttachment?.text)
        : preview.baseExportText;
      const health = analyzeExportHealth(exportText);

      return {
        ...preview,
        exportText,
        characterCount: exportText.length,
        compressedExportText: compressExportForPaste(exportText),
        health,
        passportAttachmentIncluded: Boolean(canAttach),
        passportAttachmentStatus: canAttach ? 'included' : 'excluded',
      };
    });
  }, []);

  const handleTogglePassportAttachment = useCallback((include: boolean) => {
    if (!exportPreview?.passportAttachment) {
      showToast('Create your Passport Profile before attaching it.', 'error');
      return;
    }

    if (passportLocked) {
      setExportPreview((preview) => preview
        ? { ...preview, passportAttachmentStatus: 'locked' }
        : preview);
      setPassportUnlockError('');
      return;
    }

    updatePassportAttachment(include);
  }, [exportPreview?.passportAttachment, passportLocked, showToast, updatePassportAttachment]);

  const handleUnlockPassport = useCallback(async () => {
    setPassportUnlockError('');

    try {
      const verified = await verifyPassportPasscode(passportUnlockInput);
      if (!verified) {
        setPassportUnlockError('Passport Lock could not be unlocked.');
        return;
      }

      setPassportUnlocked(true);
      setPassportUnlockInput('');
      setExportPreview((preview) => preview
        ? { ...preview, passportAttachmentStatus: 'excluded' }
        : preview);
    } catch (err) {
      console.error('Passport unlock failed:', err);
      setPassportUnlockError('Passport Lock could not be unlocked.');
    }
  }, [passportUnlockInput]);

  const toggleAvoidEmDashes = useCallback(() => {
    setStyleSettings((current) => ({
      ...current,
      avoidEmDashes: !current.avoidEmDashes,
    }));
  }, []);

  const toggleReduceAiPhrases = useCallback(() => {
    setStyleSettings((current) => ({
      ...current,
      reduceAiPhrases: !current.reduceAiPhrases,
    }));
  }, []);

  const styledExportText = exportPreview
    ? applyPassportStyleSettings(exportPreview.exportText, styleSettings)
    : '';
  const styledExportHealth = exportPreview
    ? analyzeExportHealth(styledExportText)
    : null;

  const handleCopyPreview = useCallback(async (compressed = false) => {
    if (!activeProject || !exportPreview) return;

    try {
      const textToCopy = compressed
        ? applyPassportStyleSettings(exportPreview.compressedExportText, styleSettings)
        : applyPassportStyleSettings(exportPreview.exportText, styleSettings);

      await copyExportToClipboard(textToCopy, exportPreview.copyPlatformId);

      setCopied(true);
      setPostCopyGuidanceVisible(true);
      if (postCopyGuidanceTimerRef.current) {
        clearTimeout(postCopyGuidanceTimerRef.current);
      }
      postCopyGuidanceTimerRef.current = setTimeout(() => {
        setPostCopyGuidanceVisible(false);
      }, 10000);
      if (exportPreview.mode === 'deep-state') {
        setManifestCopied(true);
      }

      showToast(
        compressed
          ? `Copied compressed ${getCopiedModeLabel(exportPreview.mode)} for ${exportPreview.targetPlatformName}`
          : `Copied ${getCopiedModeLabel(exportPreview.mode)} for ${exportPreview.targetPlatformName}`,
      );

      updateLastAiSession(activeProject.id, {
        platform: exportPreview.targetPlatformId,
        mode: handoffMode,
        sessionAt: new Date().toISOString(),
        userTaskSummary: currentTask || undefined,
        userSwitchReason: switchReason || undefined,
        filesChangedSince: exportPreview.changedFiles,
      });

      updateProject(activeProject.id, {
        platformState: {
          ...activeProject.platformState,
          [exportPreview.targetPlatformId]: {
            ...activeProject.platformState?.[exportPreview.targetPlatformId],
            lastExportedAt: new Date().toISOString(),
          },
        },
      });

      setExportPreview(null);
      setTimeout(() => setCopied(false), 1800);
      if (exportPreview.mode === 'deep-state') {
        setTimeout(() => setManifestCopied(false), 1800);
      }
    } catch (err) {
      console.error('Export failed:', err);
      showToast('Failed to copy export', 'error');
    }
  }, [
    activeProject,
    currentTask,
    exportPreview,
    handoffMode,
    styleSettings,
    switchReason,
    updateLastAiSession,
    updateProject,
    showToast,
  ]);

  const handlePrimaryCopy = useCallback(async () => {
    await handleInspectExport(getDefaultPreviewMode(selectedPlatform.id, activeProject));
  }, [activeProject, handleInspectExport, selectedPlatform.id]);

  const menuOptions = useMemo<CopyOption[]>(() => {
    const options: CopyOption[] = [
      {
        id: 'quick',
        label: 'Quick Start Export',
        onSelect: () => handleInspectExport('quick'),
      },
      {
        id: 'full',
        label: 'Full Continuity Export',
        onSelect: () => handleInspectExport('full'),
      },
      {
        id: 'delta',
        label: 'Copy just the essentials',
        onSelect: () => handleInspectExport('delta'),
      },
      {
        id: 'specialist',
        label: 'Copy for a specific task',
        onSelect: () => handleInspectExport('specialist'),
      },
    ];

    if (selectedPlatform.id === 'claude') {
      options.push({
        id: 'deep-state',
        label: 'Copy with full context + deep state',
        busyLabel: 'Preparing deeper context...',
        onSelect: () => handleInspectExport('deep-state'),
        disabled: manifestLoading,
      });
    }

    return options;
  }, [handleInspectExport, manifestLoading, selectedPlatform.id]);

  const renderPillGroup = (platforms: typeof enabledPlatforms) =>
    platforms.map((platform) => {
      const isActive = selectedPlatform.id === platform.id;
      const state = activeProject?.platformState?.[platform.id];
      const age = state?.lastExportedAt ? formatSyncAge(state.lastExportedAt) : null;

      return (
        <button
          key={platform.id}
          type="button"
          className={`export-pill${isActive ? ' export-pill--active' : ''}`}
          style={{ '--pill-color': platform.color ?? '#64748b' } as CSSProperties}
          onClick={() => handleSelectPlatform(platform.id)}
          title={age ? `Switch to ${platform.name} — last copied ${age}` : `Switch handoff target to ${platform.name}`}
          aria-pressed={isActive}
        >
          <span className="export-pill__icon">{platform.icon ?? 'AI'}</span>
          <span className="export-pill__label">{platform.name}</span>
          {age && <span className="export-pill__age">{age}</span>}
        </button>
      );
    });

  return (
    <>
    <div className="export-controls" data-tour="export">
      {/* Context Passport button */}
      {activeProject && (
        <button
          type="button"
          className="action-bar__btn"
          onClick={() => setPassportOpen(true)}
          title="Generate a portable Context Passport you can copy into any AI tool"
          style={{ width: '100%', marginBottom: '8px', fontWeight: 600 }}
        >
          🗺️ Generate Context Passport
        </button>
      )}

      {activeProject && (
        <div className="export-core-loop-hint">
          <strong>{isDemoProject ? 'Demo next step' : 'Next step'}</strong>
          <span>
            Generate a Context Passport, inspect it, then paste it into ChatGPT, Claude,
            Gemini, Grok, Cursor, or another AI to continue.
          </span>
        </div>
      )}

      {activeProject && (
        <section className="workflow-mode-selector" aria-label="AI Workflow Mode">
          <div className="workflow-mode-selector__header">
            <div>
              <strong>AI Workflow Mode</strong>
              <span>How should the next AI think about this project?</span>
            </div>
            {activeWorkflowMode && (
              <span className="workflow-mode-selector__badge">{activeWorkflowMode.label}</span>
            )}
          </div>
          <div className="workflow-mode-selector__grid">
            {WORKFLOW_MODES.map((mode) => {
              const selected = activeProject.workflowMode === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  className={`workflow-mode-selector__option${selected ? ' workflow-mode-selector__option--active' : ''}`}
                  onClick={() => handleWorkflowModeChange(mode.id)}
                  aria-pressed={selected}
                  title={`Recommended for ${mode.recommendedFor}`}
                >
                  <span>{mode.label.replace(' Mode', '')}</span>
                  <small>{mode.recommendedFor}</small>
                </button>
              );
            })}
          </div>
          {activeWorkflowMode && (
            <p className="workflow-mode-selector__help">{activeWorkflowMode.guidance}</p>
          )}
        </section>
      )}

      <button
        type="button"
        className="export-history-btn"
        onClick={() => setExportHistoryOpen(true)}
        disabled={!activeProject}
        title="Review previous export checkpoints and compare what changed"
      >
        <span>Export History</span>
        <small>Compare current project state with previous AI handoffs</small>
      </button>

      <div className="frontal-lobe-export-status" aria-live="polite">
        {frontalLobeStatus}
      </div>

      <div className="passport-attachment-nudge">
        Attach your AI Passport to help the next AI understand how you like to work.
      </div>

      <button
        type="button"
        className="export-inspect-btn"
        onClick={() => void handleInspectExport(getDefaultPreviewMode(selectedPlatform.id, activeProject))}
        disabled={!activeProject || previewLoading}
        title="Preview the exact AI handoff before copying"
      >
        {previewLoading ? 'Preparing preview...' : 'Inspect export'}
      </button>

      {/* Frontal Lobe ask_each_time checkbox */}
      {frontalLobeMode === 'ask_each_time' && vault.frontalLobeProfile && (
        <label className="frontal-lobe-export-toggle">
          <input
            type="checkbox"
            aria-label="Include AI Working Style in handoff"
            checked={includeFrontalLobe}
            onChange={(e) => setIncludeFrontalLobe(e.target.checked)}
          />
          Include AI Working Style in this handoff
        </label>
      )}


            <div
        aria-label="Memory handoff mode"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          marginBottom: '10px',
        }}
      >
        {(['auto', 'manual'] as MemoryBridgeMode[]).map((mode) => {
          const isActive = memoryBridgeMode === mode;

          return (
            <button
              key={mode}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                setMemoryBridgeMode(mode);
                if (mode === 'auto') {
                  setMenuOpen(false);
                  setContextOpen(false);
                }
              }}
              title={
                mode === 'auto'
                  ? 'Automatic mode includes hippocampus.md and prefrontal.md in the AI handoff.'
                  : 'Manual mode keeps the classic export without the Memory Bridge files.'
              }
              style={{
                padding: '7px 10px',
                borderRadius: '999px',
                border: isActive
                  ? `1.5px solid ${selectedPlatform.color ?? '#64748b'}`
                  : '1.5px solid rgba(255,255,255,0.12)',
                background: isActive
                  ? `${selectedPlatform.color ?? '#64748b'}22`
                  : 'rgba(255,255,255,0.04)',
                color: isActive ? '#f8fafc' : 'rgba(248,250,252,0.58)',
                fontSize: '0.78rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {mode === 'auto' ? 'Auto Memory' : 'Manual'}
            </button>
          );
        })}
      </div>

      <div
        ref={menuRef}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'stretch',
          gap: '8px',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: memoryBridgeMode === 'manual'
              ? 'minmax(0, 1fr) 58px'
              : '1fr',
            gap: '2px',
            width: '100%',
            padding: '2px',
            borderRadius: '20px',
            background: `${selectedPlatform.color ?? '#64748b'}33`,
            boxShadow: `0 10px 24px ${selectedPlatform.color ?? '#64748b'}29`,
          }}
        >
          <button
            type="button"
            className={`export-copy-btn${copied ? ' export-copy-btn--copied' : ''}`}
            style={{
              '--pill-color': selectedPlatform.color ?? '#64748b',
              borderTopRightRadius: '16px',
              borderBottomRightRadius: '16px',
            } as CSSProperties}
            onClick={() => void handlePrimaryCopy()}
            disabled={!activeProject || previewLoading}
            title={
              memoryBridgeMode === 'auto'
                ? `Copy Auto Memory protocol with hippocampus.md and prefrontal.md for ${selectedPlatform.name}`
                : `Copy full project context for ${selectedPlatform.name}`
            }
          >
            {copied ? (
              <>
                <span className="export-copy-btn__icon">OK</span>
                <span className="export-copy-btn__text">
                  Copied. Paste into {selectedPlatform.name}.
                </span>
              </>
            ) : (
              <>
                <span className="export-copy-btn__icon">{selectedPlatform.icon ?? 'AI'}</span>
                <span className="export-copy-btn__text">
                  Copy for AI
                  <span className="export-copy-btn__target">{selectedPlatform.name}</span>
                  {syncLabel && <span className="export-copy-btn__age">{syncLabel}</span>}
                </span>
              </>
            )}
          </button>

          {memoryBridgeMode === 'manual' && (
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls="copy-options-menu"
            aria-label={menuOpen ? 'Hide copy options' : 'Show copy options'}
            disabled={!activeProject}
            onClick={() => setMenuOpen((open) => !open)}
            style={{
              border: 'none',
              borderRadius: '16px',
              background: copied
                ? 'linear-gradient(180deg, #0f9f6e 0%, #0a7f57 100%)'
                : `linear-gradient(180deg, ${selectedPlatform.color ?? '#64748b'} 0%, ${selectedPlatform.color ?? '#64748b'}dd 100%)`,
              color: '#fffaf2',
              fontSize: '1rem',
              fontWeight: 800,
              cursor: activeProject ? 'pointer' : 'not-allowed',
              opacity: activeProject ? 1 : 0.6,
              padding: '0 12px',
              boxShadow: copied
                ? '0 10px 24px rgba(15, 159, 110, 0.24)'
                : `0 10px 24px ${selectedPlatform.color ?? '#64748b'}47`,
            }}
            title="Choose a shorter or more focused copy option"
          >
            {menuOpen ? 'Hide options ▴' : 'Show options ▾'}
          </button>
          )}
        </div>

        {postCopyGuidanceVisible && (
          <div className="export-post-copy-guidance" role="status" aria-live="polite">
            <strong>Copied successfully.</strong>
            <span>
              Paste this into ChatGPT, Claude, Gemini, Cursor, Grok, or another AI and ask it
              to continue from this Context Passport.
            </span>
            <code>Continue this project from the attached Context Passport.</code>
          </div>
        )}

        {memoryBridgeMode === 'manual' && menuOpen && activeProject && (
          <div
            id="copy-options-menu"
            role="menu"
            aria-label="Copy options"
            style={{
              position: 'absolute',
              top: 'calc(100% + 10px)',
              right: 0,
              minWidth: '280px',
              padding: '10px',
              borderRadius: '18px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(20, 20, 20, 0.96)',
              boxShadow:
                '0 20px 40px rgba(0, 0, 0, 0.28), 0 4px 12px rgba(0, 0, 0, 0.18)',
              backdropFilter: 'blur(14px)',
              zIndex: 30,
            }}
          >
            {menuOptions.slice(0, 4).map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  void option.onSelect();
                }}
                title={
                  option.id === 'full'
                    ? `Copy full continuity context for ${selectedPlatform.name}`
                    : option.id === 'delta'
                      ? `Copy essential project context for ${selectedPlatform.name}`
                      : option.id === 'quick'
                        ? `Copy lightweight fresh-chat context for ${selectedPlatform.name}`
                        : `Copy task-focused project context for ${selectedPlatform.name}`
                }
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px 14px',
                  border: 'none',
                  borderRadius: '14px',
                  background: 'transparent',
                  color: '#f8fafc',
                  textAlign: 'left',
                  fontSize: '0.96rem',
                  lineHeight: 1.45,
                  cursor: 'pointer',
                }}
              >
                {option.label}
              </button>
            ))}

            {selectedPlatform.id === 'claude' && (
              <>
                <div
                  role="separator"
                  style={{
                    height: '1px',
                    margin: '8px 4px',
                    background: 'rgba(255, 255, 255, 0.12)',
                  }}
                />
                {menuOptions.slice(4).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitem"
                    disabled={option.disabled}
                    onClick={() => {
                      setMenuOpen(false);
                      void option.onSelect();
                    }}
                    title="Copy full project context with deeper project memory for Claude"
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '12px 14px',
                      border: 'none',
                      borderRadius: '14px',
                      background: manifestCopied ? 'rgba(15, 159, 110, 0.14)' : 'transparent',
                      color: option.disabled ? 'rgba(248, 250, 252, 0.6)' : '#f8fafc',
                      textAlign: 'left',
                      fontSize: '0.96rem',
                      lineHeight: 1.45,
                      cursor: option.disabled ? 'wait' : 'pointer',
                    }}
                  >
                    {option.disabled ? option.busyLabel ?? option.label : option.label}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

{memoryBridgeMode === 'manual' && (
<>
<div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
  {(['continue', 'debug', 'review'] as HandoffMode[]).map((m) => (
    <button
      key={m}
      type="button"
      onClick={() => setHandoffMode(m)}
      title={
        m === 'continue'
          ? 'Pick up where the last AI left off'
          : m === 'debug'
            ? 'Diagnose a problem — returns cause, fix, and verification steps'
            : 'Check decisions and risks — returns structured critique and next steps'
      }
      style={{
        flex: 1,
        padding: '6px 0',
        border: handoffMode === m
          ? `1.5px solid ${selectedPlatform.color ?? '#64748b'}`
          : '1.5px solid rgba(255,255,255,0.12)',
        borderRadius: '10px',
        background: handoffMode === m
          ? `${selectedPlatform.color ?? '#64748b'}22`
          : 'transparent',
        color: handoffMode === m ? '#f8fafc' : 'rgba(248,250,252,0.5)',
        fontSize: '0.82rem',
        fontWeight: handoffMode === m ? 600 : 400,
        cursor: 'pointer',
        textTransform: 'capitalize',
        transition: 'all 0.15s ease',
      }}
    >
      {m}
    </button>
  ))}
</div>

<div style={{ marginTop: '6px' }}>
  <button
    type="button"
    onClick={() => setContextOpen((o) => !o)}
    aria-expanded={contextOpen}
    aria-controls="handoff-context-note"
    title="Add a note about what you were working on and why you are switching"
    style={{
      background: 'none',
      border: 'none',
      color: 'rgba(248,250,252,0.45)',
      fontSize: '0.8rem',
      cursor: 'pointer',
      padding: '2px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '4px',
      width: '100%',
    }}
  >
    <span>Add context (optional)</span>
    <span>{contextOpen ? 'Hide context ▴' : 'Show context ▾'}</span>
  </button>
  {contextOpen && (
    <textarea
      id="handoff-context-note"
      value={switchReason}
      onChange={(e) => setSwitchReason(e.target.value)}
      placeholder="Why are you switching platforms or starting a new session?"
      title="Explain why you are switching tools for this handoff"
      rows={2}
      style={{
        width: '100%',
        marginTop: '6px',
        padding: '8px 10px',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.05)',
        color: '#f8fafc',
        fontSize: '0.85rem',
        resize: 'vertical',
        boxSizing: 'border-box',
      }}
    />
  )}
</div>
</>
)}
      <div className="export-platform-pills" role="tablist">
        {chatPlatforms.length > 0 && (
          <div className="export-pill-group">{renderPillGroup(chatPlatforms)}</div>
        )}
        {devPlatforms.length > 0 && (
          <div className="export-pill-group export-pill-group--dev">
            <span className="export-pill-group__label">Dev tools</span>
            {renderPillGroup(devPlatforms)}
          </div>
        )}
        {localPlatforms.length > 0 && (
          <div className="export-pill-group export-pill-group--local">
            <span className="export-pill-group__label">Local AI</span>
            {renderPillGroup(localPlatforms)}
          </div>
        )}
      </div>

      {memoryBridgeMode === 'manual' && quality && (
        <div className="export-quality">
          <div className="export-quality__bar">
            <div
              className="export-quality__fill"
              style={{ width: `${quality.score}%`, background: quality.color }}
            />
          </div>
          <span className="export-quality__label" style={{ color: quality.color }}>
            {quality.label}
          </span>
        </div>
      )}

      {memoryBridgeMode === 'manual' && (
        <div className="export-trust-card">
          <div className="export-trust-card__row">
            <span>Checkpoint</span>
            <span>{checkpointSummary}</span>
          </div>

          {latestCheckpoint && (
            <div className="export-trust-card__detail">
              {selectedPlatform.name} handoff from {formatCheckpointTime(latestCheckpoint.timestamp)}
            </div>
          )}

          <div className="export-trust-card__row">
            <span>Ready now</span>
            <span>{changeSummary}</span>
          </div>
        </div>
      )}
    </div>

      {/* Context Passport modal — rendered outside the scroll container so it overlays the full app */}
      {passportOpen && activeProject && (
        <ContextPassportModal
          project={activeProject}
          onClose={() => setPassportOpen(false)}
        />
      )}

      {exportHistoryOpen && activeProject && (
        <ExportHistoryModal
          project={activeProject}
          onClose={() => setExportHistoryOpen(false)}
        />
      )}

      {exportPreview && (
        <div className="export-preview-overlay" role="presentation">
          <section
            className="export-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-preview-title"
          >
            <div className="export-preview-modal__header">
              <div>
                <h2 id="export-preview-title">Inspect export</h2>
                <p>
                  This is the exact text Memephant will copy. Nothing leaves your device until you
                  choose Copy export.
                </p>
              </div>
              <button
                type="button"
                className="export-preview-modal__close"
                onClick={() => setExportPreview(null)}
                aria-label="Close export preview"
              >
                x
              </button>
            </div>

            <dl className="export-preview-summary">
              <div>
                <dt>Target</dt>
                <dd>{exportPreview.targetPlatformName}</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>
                  {exportPreview.modeLabel}
                  {exportPreview.mode === 'quick' && (
                    <span className="export-preview-badge">Fresh Chat Optimized</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>AI Working Style</dt>
                <dd>
                  {exportPreview.aiWorkingStyleStatus}
                  <span className="export-preview-summary__subvalue">
                    {exportPreview.aiWorkingStyleIncluded ? 'Included in preview' : 'Not in this export'}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Recent activity</dt>
                <dd>{exportPreview.recentActivityIncluded ? 'Included' : 'Not included'}</dd>
              </div>
              <div>
                <dt>Passport Attachment</dt>
                <dd>
                  {exportPreview.passportAttachmentStatus === 'included'
                    ? 'Included'
                    : exportPreview.passportAttachmentStatus === 'locked'
                      ? 'Locked'
                      : 'Excluded'}
                  <span className="export-preview-summary__subvalue">
                    {exportPreview.passportAttachment
                      ? 'Passport Profile available'
                      : 'No Passport Profile found'}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Approx. size</dt>
                <dd>
                  {styledExportText.length.toLocaleString()} characters
                  <span className="export-preview-summary__subvalue">
                    ~{(styledExportHealth ?? exportPreview.health).approximateTokens.toLocaleString()} tokens
                  </span>
                </dd>
              </div>
            </dl>

            <section className="export-preview-writing-options">
              <button
                type="button"
                className="export-preview-writing-options__toggle"
                aria-expanded={writingOptionsOpen}
                aria-controls="export-preview-writing-options-panel"
                onClick={() => setWritingOptionsOpen((open) => !open)}
              >
                <span>Advanced writing options</span>
                <span className="export-preview-writing-options__state">
                  {writingOptionsOpen ? 'Hide options ▴' : 'Show options ▾'}
                </span>
              </button>
              {writingOptionsOpen && (
                <div
                  id="export-preview-writing-options-panel"
                  className="export-preview-writing-options__panel"
                >
                  <p>
                    Control how AI-generated exports communicate and feel.
                  </p>
                  <label className="export-preview-writing-options__option">
                    <input
                      type="checkbox"
                      checked={styleSettings.avoidEmDashes}
                      onChange={toggleAvoidEmDashes}
                    />
                    Avoid em dashes
                  </label>
                  <label className="export-preview-writing-options__option">
                    <input
                      type="checkbox"
                      checked={styleSettings.reduceAiPhrases}
                      onChange={toggleReduceAiPhrases}
                    />
                    Simplify polished wording
                  </label>
                  <p className="export-preview-writing-options__help">
                    Remove or simplify common over-polished AI wording in copied passports.
                  </p>
                </div>
              )}
            </section>

            <section
              className={`passport-attachment-panel passport-attachment-panel--${exportPreview.passportAttachmentStatus}`}
              aria-labelledby="passport-attachment-title"
            >
              <div className="passport-attachment-panel__header">
                <div>
                  <h3 id="passport-attachment-title">AI Passport</h3>
                  <p>
                    {getPassportAttachmentExplanation(exportPreview.passportAttachmentStatus)}
                  </p>
                </div>
                <span className="passport-attachment-panel__state">
                  {exportPreview.passportAttachmentStatus === 'included'
                    ? 'Included'
                    : exportPreview.passportAttachmentStatus === 'locked'
                      ? 'Locked'
                      : 'Excluded'}
                </span>
              </div>

              {exportPreview.passportAttachment ? (
                <>
                  <ol className="passport-attachment-steps" aria-label="Passport Attachment steps">
                    <li>Preview what will be shared</li>
                    <li>Attach Passport</li>
                    <li>Copy handoff</li>
                  </ol>

                  <div className="passport-attachment-controls">
                    <button
                      type="button"
                      className="passport-attachment-controls__primary"
                      disabled={exportPreview.passportAttachmentStatus === 'locked'}
                      onClick={() => handleTogglePassportAttachment(!exportPreview.passportAttachmentIncluded)}
                    >
                      {exportPreview.passportAttachmentIncluded ? 'Remove Passport' : 'Attach Passport'}
                    </button>
                    <button
                      type="button"
                      className="passport-attachment-controls__secondary"
                      onClick={() => setPassportPreviewVisible((visible) => !visible)}
                      aria-expanded={passportPreviewVisible}
                      aria-controls="passport-attachment-preview"
                    >
                      {passportPreviewVisible ? 'Hide Passport ▴' : 'Show Passport ▾'}
                    </button>
                    <label className="passport-attachment-toggle">
                      <input
                        type="checkbox"
                        checked={exportPreview.passportAttachmentIncluded}
                        disabled={exportPreview.passportAttachmentStatus === 'locked'}
                        onChange={(event) => handleTogglePassportAttachment(event.target.checked)}
                      />
                      Include in this export
                    </label>
                  </div>

                  {exportPreview.passportAttachmentStatus === 'locked' && (
                    <div className="passport-attachment-unlock">
                      <label htmlFor="passport-unlock-input">Unlock Passport to attach</label>
                      <div>
                        <input
                          id="passport-unlock-input"
                          type="password"
                          value={passportUnlockInput}
                          onChange={(event) => setPassportUnlockInput(event.target.value)}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => void handleUnlockPassport()}
                        >
                          Unlock
                        </button>
                      </div>
                      {passportUnlockError && (
                        <p role="alert">{passportUnlockError}</p>
                      )}
                    </div>
                  )}

                  {passportPreviewVisible && (
                    <textarea
                      id="passport-attachment-preview"
                      className="passport-attachment-preview"
                      readOnly
                      value={exportPreview.passportAttachment.text}
                      aria-label="Passport Attachment preview text"
                    />
                  )}
                </>
              ) : (
                <p className="passport-attachment-panel__empty">
                  Create your Passport Profile before attaching it to a handoff.
                </p>
              )}
            </section>

            <p className="export-preview-warning">
              Private vault contents are excluded unless explicitly included. This preview shows the
              exact text that will be copied.
            </p>

            {(styledExportHealth ?? exportPreview.health).riskLevel !== 'safe' && (
              <div
                className={`export-preview-health export-preview-health--${(styledExportHealth ?? exportPreview.health).riskLevel}`}
                role="status"
                aria-live="polite"
              >
                <strong>
                  Export health: {(styledExportHealth ?? exportPreview.health).riskLevel === 'high' ? 'High risk' : 'Needs a look'}
                </strong>
                <span>
                  Approx. {(styledExportHealth ?? exportPreview.health).approximateTokens.toLocaleString()} tokens.
                </span>
                <ul>
                  {(styledExportHealth ?? exportPreview.health).warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {activeProject && (
              <ExportDiffPanel
                summary={getExportDiffSummary(
                  activeProject,
                  exportPreview.targetPlatformId,
                  exportPreview.aiWorkingStyleIncluded,
                )}
              />
            )}

            <textarea
              className="export-preview-textarea"
              readOnly
              value={styledExportText}
              aria-label="Export preview text"
            />

            <div className="export-preview-actions">
              <button
                type="button"
                className="export-preview-actions__secondary"
                onClick={() => setExportPreview(null)}
              >
                Close
              </button>
              {exportPreview.targetPlatformId === 'chatgpt'
                && (styledExportHealth ?? exportPreview.health).suggestedAction === 'compress' && (
                <button
                  type="button"
                  className="export-preview-actions__secondary"
                  onClick={() => void handleCopyPreview(true)}
                >
                  Copy compressed version
                </button>
              )}
              <button
                type="button"
                className="export-preview-actions__primary"
                onClick={() => void handleCopyPreview()}
              >
                Copy export
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default ExportButtons;
