import type {
  ChangelogEntry,
  Decision,
  GitHubScanInfo,
  Platform,
  PlatformState,
  ProjectCheckpoint,
  ProjectMemory,
  ProjectNextIds,
  ProjectRestorePoint,
  GameProjectContext,
  GameSystemKey,
  KnownGameBug,
  ScriptVaultEntry,
} from '../types/memphant-types';
import { SCHEMA_VERSION } from '../types/memphant-types';
import {
  GAME_SYSTEM_OPTIONS,
  createDefaultGameContext,
  isGamePlatform,
  isProjectCategory,
} from './gameProjectTypes';
import { isAIWorkflowMode } from './workflowModes';

type LegacyProject = Partial<ProjectMemory> & Record<string, unknown>;

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );
}

function normalizeDecisions(value: unknown): Decision[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : undefined,
      decision: typeof item.decision === 'string' ? item.decision : '',
      rationale: typeof item.rationale === 'string' ? item.rationale : undefined,
      alternativesConsidered: normalizeOptionalStringArray(item.alternativesConsidered),
      source: typeof item.source === 'string' ? item.source : undefined,
      timestamp: typeof item.timestamp === 'string' ? item.timestamp : undefined,
    }))
    .filter((item) => item.decision.trim().length > 0);
}

function normalizeOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );
  return result.length > 0 ? result : undefined;
}

function normalizeStableIdArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );
}

function normalizeNextIds(value: unknown): ProjectNextIds | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const candidate = value as Record<string, unknown>;
  const D = typeof candidate.D === 'number' && candidate.D > 0 ? candidate.D : undefined;
  const R = typeof candidate.R === 'number' && candidate.R > 0 ? candidate.R : undefined;
  const G = typeof candidate.G === 'number' && candidate.G > 0 ? candidate.G : undefined;
  const Q = typeof candidate.Q === 'number' && candidate.Q > 0 ? candidate.Q : undefined;

  if (!D || !R || !G || !Q) return undefined;

  return { D, R, G, Q };
}

function normalizeChangelog(value: unknown): ChangelogEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item): ChangelogEntry => {
      const action: ChangelogEntry['action'] =
        item.action === 'added' || item.action === 'updated' || item.action === 'removed'
          ? item.action
          : 'updated';

      return {
        timestamp: typeof item.timestamp === 'string' ? item.timestamp : '',
        field: typeof item.field === 'string' ? item.field : '',
        action,
        summary: typeof item.summary === 'string' ? item.summary : '',
        source: typeof item.source === 'string' ? item.source : undefined,
      };
    })
    .filter(
      (item) =>
        item.timestamp.trim().length > 0 &&
        item.field.trim().length > 0 &&
        item.summary.trim().length > 0,
    );
}

function normalizePlatformEntry(value: unknown): PlatformState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const entry = value as Record<string, unknown>;

  return {
    lastExportedAt:
      typeof entry.lastExportedAt === 'string' ? entry.lastExportedAt : undefined,
    lastExportHash:
      typeof entry.lastExportHash === 'string' ? entry.lastExportHash : undefined,
    lastSeenAt: typeof entry.lastSeenAt === 'string' ? entry.lastSeenAt : undefined,
    lastReplyAt: typeof entry.lastReplyAt === 'string' ? entry.lastReplyAt : undefined,
    exportCount: typeof entry.exportCount === 'number' ? entry.exportCount : undefined,
    lastSessionNote:
      typeof entry.lastSessionNote === 'string' ? entry.lastSessionNote : undefined,
  };
}

function normalizePlatformState(
  value: unknown,
): Partial<Record<Platform, PlatformState>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const result: Partial<Record<Platform, PlatformState>> = {};

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizePlatformEntry(entry);
    if (normalized) {
      result[key] = normalized;
    }
  }

  return result;
}

function normalizeScanInfo(value: unknown): GitHubScanInfo | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const info = value as Record<string, unknown>;

  if (
    typeof info.scannedAt !== 'string' ||
    typeof info.repoUrl !== 'string'
  ) {
    return undefined;
  }

  return {
    scannedAt: info.scannedAt,
    repoUrl: info.repoUrl,
    keyFilesFound: normalizeStringArray(info.keyFilesFound),
  };
}

function normalizeCheckpoints(value: unknown): ProjectCheckpoint[] {
  if (!Array.isArray(value)) return [];
  return value as ProjectCheckpoint[];
}

function normalizeRestorePoints(value: unknown): ProjectRestorePoint[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value as ProjectRestorePoint[];
}

function normalizeLinkedFolder(
  value: unknown,
): ProjectMemory['linkedFolder'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const folder = value as Record<string, unknown>;
  const path =
    typeof folder.path === 'string' && folder.path.trim().length > 0
      ? folder.path
      : undefined;
  const scanHash = typeof folder.scanHash === 'string' ? folder.scanHash : undefined;
  const lastScannedAt =
    typeof folder.lastScannedAt === 'string' ? folder.lastScannedAt : undefined;

  if (!path && !scanHash && !lastScannedAt) {
    return undefined;
  }

  return {
    path,
    scanHash,
    lastScannedAt,
  };
}

function normalizeProjectBlueprint(value: unknown): ProjectMemory['projectBlueprint'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as { version?: unknown };
  return candidate.version === '1.0' ? (candidate as ProjectMemory['projectBlueprint']) : undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function normalizeGameSystems(value: unknown): GameProjectContext['systems'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const source = value as Record<string, unknown>;
  const systems: Partial<Record<GameSystemKey, string>> = {};

  for (const option of GAME_SYSTEM_OPTIONS) {
    const normalized = normalizeOptionalString(source[option.value]);
    if (normalized) systems[option.value] = normalized;
  }

  return Object.keys(systems).length > 0 ? systems : undefined;
}

function normalizeKnownGameBugs(value: unknown): KnownGameBug[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const bugs = value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item): KnownGameBug => ({
      id: normalizeOptionalString(item.id),
      title: normalizeOptionalString(item.title) ?? '',
      systemAffected: normalizeOptionalString(item.systemAffected),
      reproductionNotes: normalizeOptionalString(item.reproductionNotes),
      currentTheory: normalizeOptionalString(item.currentTheory),
      status: normalizeOptionalString(item.status),
    }))
    .filter((bug) => bug.title.trim().length > 0);

  return bugs.length > 0 ? bugs : undefined;
}

function normalizeScriptVault(value: unknown): ScriptVaultEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const scripts = value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item): ScriptVaultEntry => ({
      id: normalizeOptionalString(item.id),
      scriptName: normalizeOptionalString(item.scriptName) ?? '',
      platformLanguage: normalizeOptionalString(item.platformLanguage),
      purpose: normalizeOptionalString(item.purpose),
      relatedSystem: normalizeOptionalString(item.relatedSystem),
      status: normalizeOptionalString(item.status),
      notes: normalizeOptionalString(item.notes),
      codeSnippet: normalizeOptionalString(item.codeSnippet),
      includeInContextPassport:
        typeof item.includeInContextPassport === 'boolean'
          ? item.includeInContextPassport
          : undefined,
    }))
    .filter((script) => script.scriptName.trim().length > 0);

  return scripts.length > 0 ? scripts : undefined;
}

function normalizeGameContext(value: unknown, platform: ProjectMemory['gamePlatform']): GameProjectContext | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return platform ? createDefaultGameContext(platform) : undefined;
  }

  const source = value as Record<string, unknown>;
  const overviewSource =
    source.overview && typeof source.overview === 'object' && !Array.isArray(source.overview)
      ? source.overview as Record<string, unknown>
      : {};

  const overview = {
    genre: normalizeOptionalString(overviewSource.genre),
    coreLoop: normalizeOptionalString(overviewSource.coreLoop),
    targetPlayer: normalizeOptionalString(overviewSource.targetPlayer),
    artStyle: normalizeOptionalString(overviewSource.artStyle),
    platformTarget: normalizeOptionalString(overviewSource.platformTarget),
    monetisationPlan: normalizeOptionalString(overviewSource.monetisationPlan),
    currentPlayableState: normalizeOptionalString(overviewSource.currentPlayableState),
  };
  const cleanOverview = Object.fromEntries(
    Object.entries(overview).filter(([, field]) => typeof field === 'string' && field.trim().length > 0),
  ) as GameProjectContext['overview'];

  const normalized: GameProjectContext = {
    overview: cleanOverview && Object.keys(cleanOverview).length > 0 ? cleanOverview : undefined,
    systems: normalizeGameSystems(source.systems),
    knownBugs: normalizeKnownGameBugs(source.knownBugs),
    scriptVault: normalizeScriptVault(source.scriptVault),
  };

  return Object.values(normalized).some(Boolean) ? normalized : undefined;
}

export function normalizeOldProject(raw: LegacyProject): ProjectMemory {
  const projectCategory = isProjectCategory(raw.projectCategory) ? raw.projectCategory : undefined;
  const gamePlatform = isGamePlatform(raw.gamePlatform) ? raw.gamePlatform : undefined;
  const gameContext = normalizeGameContext(raw.gameContext, gamePlatform);

  return {
    schema_version: SCHEMA_VERSION,
    id: typeof raw.id === 'string' && raw.id.trim().length > 0 ? raw.id : crypto.randomUUID(),
    name:
      typeof raw.name === 'string' && raw.name.trim().length > 0
        ? raw.name
        : 'Untitled Project',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    goals: normalizeStringArray(raw.goals),
    goalIds: normalizeStableIdArray(raw.goalIds),
    rules: normalizeStringArray(raw.rules),
    ruleIds: normalizeStableIdArray(raw.ruleIds),
    decisions: normalizeDecisions(raw.decisions),
    currentState: typeof raw.currentState === 'string' ? raw.currentState : '',
    nextSteps: normalizeStringArray(raw.nextSteps),
    openQuestions: normalizeStringArray(raw.openQuestions),
    openQuestionIds: normalizeStableIdArray(raw.openQuestionIds),
    importantAssets: normalizeStringArray(raw.importantAssets),
    projectCharter: typeof raw.projectCharter === 'string' ? raw.projectCharter : undefined,
    aiInstructions: typeof raw.aiInstructions === 'string' ? raw.aiInstructions : undefined,
    githubRepo: typeof raw.githubRepo === 'string' ? raw.githubRepo : undefined,
    detectedStack: normalizeOptionalStringArray(raw.detectedStack),
    scanInfo: normalizeScanInfo(raw.scanInfo),
    linkedFolder: normalizeLinkedFolder(raw.linkedFolder),
    changelog: normalizeChangelog(raw.changelog),
    platformState: normalizePlatformState(raw.platformState),
    inProgress: Array.isArray(raw.inProgress)
      ? raw.inProgress.filter(
          (item): item is string => typeof item === 'string' && item.trim().length > 0,
        )
      : undefined,
    lastSessionSummary:
      typeof raw.lastSessionSummary === 'string' ? raw.lastSessionSummary : undefined,
    openQuestion:
      typeof raw.openQuestion === 'string' ? raw.openQuestion : undefined,
    projectReason:
      typeof raw.projectReason === 'string' && raw.projectReason.trim()
        ? raw.projectReason
        : undefined,
    recentProgressNote:
      typeof raw.recentProgressNote === 'string' && raw.recentProgressNote.trim()
        ? raw.recentProgressNote
        : undefined,
    projectBlueprint: normalizeProjectBlueprint(raw.projectBlueprint),
    workflowMode: isAIWorkflowMode(raw.workflowMode) ? raw.workflowMode : undefined,
    projectCategory,
    projectCategoryOther: normalizeOptionalString(raw.projectCategoryOther),
    gamePlatform,
    gamePlatformOther: normalizeOptionalString(raw.gamePlatformOther),
    gameContext,
    nextIds: normalizeNextIds(raw.nextIds),
    checkpoints: normalizeCheckpoints(raw.checkpoints),
    restorePoints: normalizeRestorePoints(raw.restorePoints),
  };
}
