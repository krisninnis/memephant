/**
 * Standalone Tauri action functions that operate on the Zustand store.
 * These are NOT hooks — they can be called from anywhere.
 *
 * Browser fallback: when running in a regular browser (phone preview / web mode)
 * all Tauri invoke() calls fall back to localStorage so the app remains usable.
 */
import { useProjectStore } from '../store/projectStore';
import { isDesktopApp, isBrowserApp } from '../utils/runtime';
import type {
  ChangelogEntry,
  PlatformState,
  ProjectMemory,
  Platform,
  ProjectCheckpoint,
  ProjectRestorePoint,
  GitCommit,
} from '../types/memphant-types';
import { cloneCheckpointSnapshot, hashProjectState, SCHEMA_VERSION } from '../types/memphant-types';
import { pushProject, deleteCloudProject } from './cloudSync';
import { dequeue } from './syncQueue';
import { suggestEmptyFields } from '../utils/autoSuggest';
import type { ProjectTemplate } from '../utils/projectTemplates';
import { track } from '../lib/analytics';

// ————————————————————————————————————————————————————————————————————————————
// Free tier limit
// ————————————————————————————————————————————————————————————————————————————

const MAX_RESTORE_POINTS = 5;

// ————————————————————————————————————————————————————————————————————————————
// Runtime / platform capability helpers
// ————————————————————————————————————————————————————————————————————————————

export { isDesktopApp, isBrowserApp } from '../utils/runtime';


export function canScanFolders(): boolean {
  return isDesktopApp() || isBrowserApp();
}

export function canLinkFolders(): boolean {
  return isDesktopApp() || isBrowserApp();
}

export function canRescanLinkedFolders(): boolean {
  return isDesktopApp() || isBrowserApp();
}

export function canSyncGit(): boolean {
  return isDesktopApp();
}

export function canUseNativeProjectStorage(): boolean {
  return isDesktopApp();
}

export function canDownloadFiles(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export type RuntimeCapabilities = {
  desktopApp: boolean;
  browserApp: boolean;
  folderScan: boolean;
  folderLink: boolean;
  linkedFolderRescan: boolean;
  gitSync: boolean;
  nativeStorage: boolean;
  fileDownload: boolean;
};

export function getRuntimeCapabilities(): RuntimeCapabilities {
  return {
    desktopApp: isDesktopApp(),
    browserApp: isBrowserApp(),
    folderScan: canScanFolders(),
    folderLink: canLinkFolders(),
    linkedFolderRescan: canRescanLinkedFolders(),
    gitSync: canSyncGit(),
    nativeStorage: canUseNativeProjectStorage(),
    fileDownload: canDownloadFiles(),
  };
}

export function getUnavailableFeatureMessage(
  feature: 'folderScan' | 'folderLink' | 'rescan' | 'gitSync' | 'nativeStorage',
): string {
  switch (feature) {
    case 'folderScan':
      return 'Folder selection is not supported by this browser yet. Try the desktop app, or use Import Memephant Project as a backup.';
    case 'folderLink':
      return 'Folder linking is not supported by this browser yet. Try the desktop app, or use Import Memephant Project as a backup.';
    case 'rescan':
      return 'Rescanning a folder requires selecting the folder again on this platform.';
    case 'gitSync':
      return 'Git sync requires the desktop app.';
    case 'nativeStorage':
      return 'This feature uses desktop-native storage and requires the desktop app.';
    default:
      return 'This feature requires the desktop app.';
  }
}

export function getFolderActionLabel(): 'Open Folder' | 'Select Folder' {
  return isDesktopApp() ? 'Open Folder' : 'Select Folder';
}

// ————————————————————————————————————————————————————————————————————————————
// Browser localStorage fallback storage
// ————————————————————————————————————————————————————————————————————————————

const LS_PREFIX = 'mph_project:';

function canonicalProjectStorageKey(projectId: string): string {
  return LS_PREFIX + projectId;
}

function canonicalTauriFileStem(projectId: string): string {
  const trimmed = projectId.trim();
  const safe = trimmed
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 100);
  return safe || 'project';
}

function canonicalTauriFileName(projectId: string): string {
  return `${canonicalTauriFileStem(projectId)}.json`;
}

function canonicalBrowserFileName(projectId: string): string {
  return `${projectId}.json`;
}

const browserStore = {
  save(projectId: string, data: string): void {
    const key = canonicalProjectStorageKey(projectId);
    localStorage.setItem(key, data);
  },
  list(): string[] {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(LS_PREFIX))
      .map((k) => k.slice(LS_PREFIX.length) + '.json');
  },
  load(fileName: string): string {
    const key = LS_PREFIX + fileName.replace(/\.json$/, '');
    const data = localStorage.getItem(key);
    if (!data) throw new Error(`Project not found: ${fileName}`);
    return data;
  },
  exists(fileName: string): boolean {
    const key = LS_PREFIX + fileName.replace(/\.json$/, '');
    return localStorage.getItem(key) !== null;
  },
  delete(fileName: string): void {
    const key = LS_PREFIX + fileName.replace(/\.json$/, '');
    localStorage.removeItem(key);
  },
};

// ————————————————————————————————————————————————————————————————————————————
// Tauri lazy imports (only loaded in Tauri context)
// ————————————————————————————————————————————————————————————————————————————

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

async function openFolderDialog(): Promise<string | null> {
  if (!isDesktopApp()) {
    console.warn(getUnavailableFeatureMessage('folderScan'));
    return null;
  }

  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Open Folder',
    });

    if (Array.isArray(selected)) {
      return typeof selected[0] === 'string' ? selected[0] : null;
    }

    return typeof selected === 'string' ? selected : null;
  } catch (err) {
    console.error('Dialog failed:', err);
    return null;
  }
}

type BrowserFileSystemHandle = {
  kind: 'file' | 'directory';
  name: string;
};

type BrowserFileSystemFileHandle = BrowserFileSystemHandle & {
  kind: 'file';
  getFile: () => Promise<File>;
};

type BrowserFileSystemDirectoryHandle = BrowserFileSystemHandle & {
  kind: 'directory';
  entries: () => AsyncIterable<[string, BrowserFileSystemHandle]>;
};

type BrowserDirectoryWindow = Window & {
  showDirectoryPicker?: () => Promise<BrowserFileSystemDirectoryHandle>;
};

type DirectoryInputElement = HTMLInputElement & {
  webkitdirectory?: boolean;
  directory?: boolean;
};

type BrowserScannedFile = {
  path: string;
  size: number;
  lastModified: number;
  text?: string;
};

type SelectedFolderScan = {
  folderName: string;
  linkedPath: string;
  result: ScanResult;
};

const BROWSER_LINKED_FOLDER_PREFIX = 'browser-folder:';
const BROWSER_SCAN_FILE_LIMIT = 800;
const BROWSER_SCAN_TEXT_LIMIT = 64_000;
const BROWSER_SAFE_TEXT_FILES = new Set([
  'package.json',
  'cargo.toml',
  'readme.md',
  'readme.txt',
  'godot.project',
]);
const IGNORED_FOLDER_NAMES = new Set([
  '.git',
  '.next',
  '.turbo',
  '.vercel',
  'bin',
  'build',
  'binaries',
  'dist',
  'intermediate',
  'library',
  'logs',
  'node_modules',
  'obj',
  'saved',
  'target',
  'temp',
]);
const IGNORED_FILE_NAMES = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.npmrc',
  '.pypirc',
  'credentials.json',
  'secrets.json',
  'service-account.json',
]);
const SECRET_FILE_NAME_PATTERN =
  /(^|[-_.])(secret|secrets|credential|credentials|token|tokens|password|private[-_.]?key)([-_.]|$)/i;
const USEFUL_FILE_EXTENSIONS = [
  '.cs',
  '.css',
  '.gd',
  '.godot',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.lua',
  '.luau',
  '.md',
  '.py',
  '.rbxlx',
  '.rs',
  '.svelte',
  '.toml',
  '.ts',
  '.tscn',
  '.tsx',
  '.unity',
  '.uproject',
  '.vue',
  '.yml',
  '.yaml',
  '.yyp',
];

function isBrowserDirectoryPickerSupported(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (typeof (window as BrowserDirectoryWindow).showDirectoryPicker === 'function') return true;
  const input = document.createElement('input') as DirectoryInputElement;
  return 'webkitdirectory' in input || 'directory' in input;
}

function safeBrowserFolderName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Selected Folder';
}

function browserLinkedFolderPath(folderName: string): string {
  return `${BROWSER_LINKED_FOLDER_PREFIX}${safeBrowserFolderName(folderName)}`;
}

function isIgnoredFolder(name: string): boolean {
  return IGNORED_FOLDER_NAMES.has(name.toLowerCase());
}

function isIgnoredFile(path: string): boolean {
  const parts = path.split('/').map((part) => part.toLowerCase());
  const fileName = parts[parts.length - 1] ?? '';
  const folderParts = parts.slice(0, -1);
  return (
    folderParts.some((part) => IGNORED_FOLDER_NAMES.has(part)) ||
    IGNORED_FILE_NAMES.has(fileName) ||
    fileName.startsWith('.env.') ||
    SECRET_FILE_NAME_PATTERN.test(fileName)
  );
}

function isUsefulFile(path: string): boolean {
  const lower = path.toLowerCase();
  if (isIgnoredFile(lower)) return false;
  return (
    BROWSER_SAFE_TEXT_FILES.has(lower.split('/').pop() ?? '') ||
    USEFUL_FILE_EXTENSIONS.some((extension) => lower.endsWith(extension))
  );
}

async function maybeReadSafeBrowserFile(file: File, relativePath: string): Promise<string | undefined> {
  const fileName = relativePath.toLowerCase().split('/').pop() ?? '';
  if (!BROWSER_SAFE_TEXT_FILES.has(fileName) || file.size > BROWSER_SCAN_TEXT_LIMIT) {
    return undefined;
  }

  try {
    return await file.text();
  } catch {
    return undefined;
  }
}

async function collectBrowserDirectoryFiles(
  directory: BrowserFileSystemDirectoryHandle,
  prefix = '',
  files: BrowserScannedFile[] = [],
): Promise<BrowserScannedFile[]> {
  if (files.length >= BROWSER_SCAN_FILE_LIMIT) return files;

  for await (const [name, handle] of directory.entries()) {
    if (files.length >= BROWSER_SCAN_FILE_LIMIT) break;

    const relativePath = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'directory') {
      if (!isIgnoredFolder(name)) {
        await collectBrowserDirectoryFiles(
          handle as BrowserFileSystemDirectoryHandle,
          relativePath,
          files,
        );
      }
      continue;
    }

    if (!isUsefulFile(relativePath)) continue;

    const file = await (handle as BrowserFileSystemFileHandle).getFile();
    files.push({
      path: relativePath,
      size: file.size,
      lastModified: file.lastModified,
      text: await maybeReadSafeBrowserFile(file, relativePath),
    });
  }

  return files;
}

async function openBrowserDirectoryInput(): Promise<{ folderName: string; files: BrowserScannedFile[] } | null> {
  if (typeof document === 'undefined') return null;

  const input = document.createElement('input') as DirectoryInputElement;
  input.type = 'file';
  input.multiple = true;
  input.webkitdirectory = true;
  input.directory = true;
  input.style.display = 'none';

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: { folderName: string; files: BrowserScannedFile[] } | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(value);
    };

    input.addEventListener('change', async () => {
      const selectedFiles = Array.from(input.files ?? []);
      if (selectedFiles.length === 0) {
        finish(null);
        return;
      }

      const usefulFiles = selectedFiles
        .map((file) => {
          const relativePath =
            (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
          return { file, relativePath };
        })
        .filter(({ relativePath }) => isUsefulFile(relativePath))
        .slice(0, BROWSER_SCAN_FILE_LIMIT);

      const files: BrowserScannedFile[] = [];
      for (const { file, relativePath } of usefulFiles) {
        files.push({
          path: relativePath,
          size: file.size,
          lastModified: file.lastModified,
          text: await maybeReadSafeBrowserFile(file, relativePath),
        });
      }

      const firstPath = (selectedFiles[0] as File & { webkitRelativePath?: string }).webkitRelativePath;
      const folderName = firstPath?.split('/').filter(Boolean)[0] || 'Selected Folder';
      finish({ folderName, files });
    });

    document.body.appendChild(input);
    input.click();
    window.setTimeout(() => {
      if (!input.files || input.files.length === 0) finish(null);
    }, 60_000);
  });
}

async function openBrowserFolder(): Promise<{ folderName: string; files: BrowserScannedFile[] } | null> {
  if (!isBrowserDirectoryPickerSupported()) {
    store().showToast(getUnavailableFeatureMessage('folderScan'), 'info');
    return null;
  }

  const picker = (window as BrowserDirectoryWindow).showDirectoryPicker;
  if (typeof picker === 'function') {
    try {
      const directory = await picker.call(window);
      return {
        folderName: directory.name,
        files: await collectBrowserDirectoryFiles(directory),
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null;
      console.warn('Browser folder picker failed:', err);
      const fallback = await openBrowserDirectoryInput();
      if (fallback) return fallback;
      store().showToast(getUnavailableFeatureMessage('folderScan'), 'info');
      return null;
    }
  }

  return openBrowserDirectoryInput();
}

function parsePackageJson(text: string | undefined): PackageInfo | undefined {
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      description: typeof parsed.description === 'string' ? parsed.description : undefined,
      version: typeof parsed.version === 'string' ? parsed.version : undefined,
    };
  } catch {
    return undefined;
  }
}

function parseCargoToml(text: string | undefined): PackageInfo | undefined {
  if (!text) return undefined;
  const name = /^name\s*=\s*["']([^"']+)["']/m.exec(text)?.[1];
  const version = /^version\s*=\s*["']([^"']+)["']/m.exec(text)?.[1];
  return name || version ? { name, version } : undefined;
}

function summarizeReadme(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const paragraph = text
    .split(/\r?\n\r?\n/)
    .map((part) => part.replace(/^#+\s*/gm, '').replace(/\s+/g, ' ').trim())
    .find((part) => part.length > 24 && !part.startsWith('!['));
  return paragraph ? paragraph.slice(0, 280) : undefined;
}

function detectBrowserStack(files: BrowserScannedFile[]): TechStackInfo {
  const paths = files.map((file) => file.path.toLowerCase());
  const has = (predicate: (path: string) => boolean) => paths.some(predicate);
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const packageManagers = new Set<string>();
  const buildTools = new Set<string>();
  const runtimes = new Set<string>();
  const signals: StackSignal[] = [];

  const addSignal = (source: string, signal: string, detail?: string) => {
    signals.push({ source, signal, detail });
  };

  if (has((path) => path.endsWith('.ts') || path.endsWith('.tsx'))) languages.add('TypeScript');
  if (has((path) => path.endsWith('.js') || path.endsWith('.jsx'))) languages.add('JavaScript');
  if (has((path) => path.endsWith('.lua') || path.endsWith('.luau'))) languages.add('Luau/Lua');
  if (has((path) => path.endsWith('.cs'))) languages.add('C#');
  if (has((path) => path.endsWith('.gd'))) languages.add('GDScript');
  if (has((path) => path.endsWith('.rs'))) languages.add('Rust');
  if (has((path) => path.endsWith('package.json'))) {
    runtimes.add('Node.js');
    addSignal('package.json', 'Node project');
  }
  if (has((path) => path.endsWith('pnpm-lock.yaml'))) packageManagers.add('pnpm');
  if (has((path) => path.endsWith('package-lock.json'))) packageManagers.add('npm');
  if (has((path) => path.endsWith('vite.config.ts') || path.endsWith('vite.config.js'))) {
    buildTools.add('Vite');
    addSignal('vite.config', 'Vite');
  }
  if (has((path) => path.endsWith('next.config.js') || path.endsWith('next.config.ts'))) frameworks.add('Next.js');
  if (has((path) => path.endsWith('godot.project') || path.endsWith('.tscn') || path.endsWith('.gd'))) frameworks.add('Godot');
  if (has((path) => path.endsWith('.unity'))) frameworks.add('Unity');
  if (has((path) => path.endsWith('.uproject'))) frameworks.add('Unreal Engine');
  if (has((path) => path.endsWith('.rbxlx') || path.endsWith('.luau'))) frameworks.add('Roblox');

  return {
    languages: Array.from(languages),
    frameworks: Array.from(frameworks),
    package_managers: Array.from(packageManagers),
    build_tools: Array.from(buildTools),
    runtimes: Array.from(runtimes),
    confidence: signals.length > 0 ? 'medium' : 'low',
    signals,
  };
}

function hashBrowserScannedFiles(files: BrowserScannedFile[]): string {
  const key = files
    .map((file) => `${file.path}:${file.size}:${file.lastModified}`)
    .sort()
    .join('|');
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33) ^ key.charCodeAt(i);
    hash = hash >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function buildBrowserScanResult(folderName: string, files: BrowserScannedFile[]): SelectedFolderScan {
  const readme = files.find((file) => /^readme\.(md|txt)$/i.test(file.path.split('/').pop() ?? ''))?.text;
  const packageJson = parsePackageJson(files.find((file) => file.path.toLowerCase().endsWith('package.json'))?.text);
  const cargoToml = parseCargoToml(files.find((file) => file.path.toLowerCase().endsWith('cargo.toml'))?.text);
  const summary = packageJson?.description || summarizeReadme(readme) || '';
  const stack = detectBrowserStack(files);

  return {
    folderName,
    linkedPath: browserLinkedFolderPath(folderName),
    result: {
      files: files.map((file) => file.path).sort().slice(0, 200),
      scan_hash: hashBrowserScannedFiles(files),
      meta: {
        readme,
        package_json: packageJson,
        cargo_toml: cargoToml,
        stack,
        suggestions: {
          project_name: packageJson?.name || cargoToml?.name || safeBrowserFolderName(folderName),
          summary,
          detected_tags: [...stack.frameworks, ...stack.languages].slice(0, 8),
        },
      },
    },
  };
}

async function selectAndScanProjectFolder(): Promise<SelectedFolderScan | null> {
  if (isDesktopApp()) {
    const selected = await openFolderDialog();
    if (!selected) return null;

    const normalizedPath = selected.replace(/\\/g, '/');
    const folderName = normalizedPath.split('/').filter(Boolean).pop() || 'Imported Project';
    const result = await tauriInvoke<ScanResult>('scan_project_folder', { folderPath: selected });
    return { folderName, linkedPath: selected, result };
  }

  const selected = await openBrowserFolder();
  return selected ? buildBrowserScanResult(selected.folderName, selected.files) : null;
}

export async function syncGitCommits(projectId: string): Promise<GitCommit[]> {
  if (!canSyncGit()) {
    return [];
  }

  const state = store();
  const project = state.projects.find((p) => p.id === projectId);

  if (!project?.linkedFolder?.path) {
    return [];
  }

  try {
    const commits = await tauriInvoke<GitCommit[]>('get_git_log', {
      folderPath: project.linkedFolder.path,
      sinceHash: project.lastGitSync?.hash ?? null,
    });

    if (!Array.isArray(commits) || commits.length === 0) {
      return [];
    }

    state.setPendingGitCommits(projectId, commits);

    const latest = commits[0];
    if (latest) {
      state.setLastGitSync(projectId, {
        hash: latest.hash,
        timestamp: latest.timestamp,
        commitCount: commits.length,
      });
    }

    return commits;
  } catch (err) {
    console.warn('[Memphant] Git sync failed silently:', err);
    return [];
  }
}

export async function generateStateManifest(
  project: ProjectMemory,
): Promise<StateManifestPreview> {
  if (!isDesktopApp()) {
    throw new Error('State manifest preview requires the desktop app.');
  }

  return tauriInvoke<StateManifestPreview>('generate_state_manifest', { project });
}

// ————————————————————————————————————————————————————————————————————————————
// Old ↔ New format conversion
// ————————————————————————————————————————————————————————————————————————————

type LegacyLinkedFolder = {
  path?: string;
  scanHash?: string;
  lastScannedAt?: string;
};

type LegacyCheckpoint = Partial<ProjectCheckpoint> & {
  snapshot?: Record<string, unknown>;
};

type LegacyRestorePoint = Partial<ProjectRestorePoint> & {
  snapshot?: Record<string, unknown>;
};

type LegacyPlatformState = Partial<PlatformState> & {
  lastSentSnapshotId?: string;
};

type LegacyProject = Record<string, unknown> & {
  id?: string;
  projectName?: string;
  name?: string;
  updatedAt?: string;
  lastModified?: string;
  summary?: string;
  goals?: unknown;
  rules?: unknown;
  decisions?: unknown;
  currentState?: string;
  nextSteps?: unknown;
  openQuestions?: unknown;
  importantAssets?: unknown;
  projectCharter?: string;
  aiInstructions?: string | { focus?: string };
  linkedFolder?: LegacyLinkedFolder;
  changelog?: unknown;
  checkpoints?: unknown;
  restorePoints?: unknown;
  platformState?: Record<string, unknown>;
  projectReason?: string;
  recentProgressNote?: string;
  projectBlueprint?: unknown;
};

function normalizeProjectBlueprint(value: unknown): ProjectMemory['projectBlueprint'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as { version?: unknown };
  return candidate.version === '1.0' ? (candidate as ProjectMemory['projectBlueprint']) : undefined;
}

function normalizeLinkedFolder(value: LegacyLinkedFolder | undefined): ProjectMemory['linkedFolder'] {
  if (!value) return undefined;

  const path = typeof value.path === 'string' && value.path.trim().length > 0
    ? value.path
    : undefined;
  const scanHash = typeof value.scanHash === 'string' ? value.scanHash : undefined;
  const lastScannedAt =
    typeof value.lastScannedAt === 'string' ? value.lastScannedAt : undefined;

  if (!path && !scanHash && !lastScannedAt) return undefined;

  return {
    path,
    scanHash,
    lastScannedAt,
  };
}

export function normalizeOldProject(raw: Record<string, unknown>): ProjectMemory {
  const legacy = raw as LegacyProject;
  const normalizedChangelog = Array.isArray(raw.changelog)
    ? raw.changelog.map((entry): ChangelogEntry => {
        const candidate = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
        return {
          timestamp:
            (typeof candidate.date === 'string' && candidate.date) ||
            (typeof candidate.timestamp === 'string' && candidate.timestamp) ||
            new Date().toISOString(),
          field: typeof candidate.field === 'string' ? candidate.field : 'general',
          action:
            candidate.action === 'added' || candidate.action === 'removed' || candidate.action === 'updated'
              ? candidate.action
              : 'updated',
          summary:
            (typeof candidate.description === 'string' && candidate.description) ||
            (typeof candidate.summary === 'string' && candidate.summary) ||
            '',
          source: typeof candidate.source === 'string' ? candidate.source : undefined,
        };
      })
    : [];

  const derivedUpdatedAt =
    (typeof legacy.updatedAt === 'string' && legacy.updatedAt) ||
    (typeof legacy.lastModified === 'string' && legacy.lastModified) ||
    (() => {
      const sorted = normalizedChangelog.map((entry) => entry.timestamp).sort();
      return sorted[sorted.length - 1];
    })() ||
    new Date().toISOString();

  return {
    // Stamp current schema version so the project is upgraded on next disk write.
    // Projects without a schema_version (or with the legacy numeric 1) are treated
    // as pre-1.1.0 and silently migrated — no field values are changed.
    schema_version: SCHEMA_VERSION,
    id:
      (typeof legacy.id === 'string' && legacy.id) ||
      (typeof legacy.projectName === 'string' && legacy.projectName.replace(/\s+/g, '_').toLowerCase()) ||
      crypto.randomUUID(),
    name:
      (typeof legacy.projectName === 'string' && legacy.projectName) ||
      (typeof legacy.name === 'string' && legacy.name) ||
      'Untitled',
    updatedAt: derivedUpdatedAt,
    summary: typeof legacy.summary === 'string' ? legacy.summary : '',
    goals: Array.isArray(raw.goals) ? raw.goals : [],
    rules: Array.isArray(raw.rules) ? raw.rules : [],
    decisions: Array.isArray(raw.decisions)
      ? raw.decisions
          .map((d: unknown) => {
            if (typeof d === 'string') {
              return { decision: d };
            }
            if (d && typeof d === 'object' && typeof (d as { decision?: unknown }).decision === 'string') {
              return d as ProjectMemory['decisions'][number];
            }
            return null;
          })
          .filter((decision): decision is ProjectMemory['decisions'][number] => decision !== null)
      : [],
    currentState: typeof legacy.currentState === 'string' ? legacy.currentState : '',
    nextSteps: Array.isArray(raw.nextSteps) ? raw.nextSteps : [],
    openQuestions: Array.isArray(raw.openQuestions) ? raw.openQuestions : [],
    importantAssets: Array.isArray(raw.importantAssets) ? raw.importantAssets : [],
    projectCharter: typeof legacy.projectCharter === 'string' ? legacy.projectCharter : '',
    aiInstructions:
      typeof legacy.aiInstructions === 'string'
        ? legacy.aiInstructions
        : typeof legacy.aiInstructions === 'object' &&
            legacy.aiInstructions &&
            typeof legacy.aiInstructions.focus === 'string'
          ? legacy.aiInstructions.focus
          : '',
    linkedFolder: normalizeLinkedFolder(legacy.linkedFolder),
    lastGitSync:
      raw.lastGitSync &&
      typeof raw.lastGitSync === 'object' &&
      typeof (raw.lastGitSync as { hash?: unknown }).hash === 'string' &&
      typeof (raw.lastGitSync as { timestamp?: unknown }).timestamp === 'string'
        ? {
            hash: (raw.lastGitSync as { hash: string }).hash,
            timestamp: (raw.lastGitSync as { timestamp: string }).timestamp,
            commitCount:
              typeof (raw.lastGitSync as { commitCount?: unknown }).commitCount === 'number'
                ? (raw.lastGitSync as { commitCount: number }).commitCount
                : 0,
          }
        : undefined,
    pendingGitCommits: Array.isArray(raw.pendingGitCommits)
      ? (raw.pendingGitCommits as unknown[])
          .filter(
            (
              commit,
            ): commit is { hash: string; message: string; timestamp: string; author: string } =>
              typeof commit === 'object' &&
              commit !== null &&
              typeof (commit as { hash?: unknown }).hash === 'string' &&
              typeof (commit as { message?: unknown }).message === 'string' &&
              typeof (commit as { timestamp?: unknown }).timestamp === 'string' &&
              typeof (commit as { author?: unknown }).author === 'string',
          )
          .map((commit) => ({
            hash: commit.hash,
            message: commit.message,
            timestamp: commit.timestamp,
            author: commit.author,
          }))
      : undefined,
    changelog: normalizedChangelog,
    checkpoints: Array.isArray(raw.checkpoints)
      ? raw.checkpoints
          .map((checkpoint: unknown): ProjectCheckpoint | null => {
            if (!checkpoint || typeof checkpoint !== 'object') return null;
            const candidate = checkpoint as LegacyCheckpoint;
            if (!candidate.snapshot || typeof candidate.snapshot !== 'object') return null;

            const normalizedSnapshot = cloneCheckpointSnapshot(normalizeOldProject(candidate.snapshot));

            return {
              id: typeof candidate.id === 'string' ? candidate.id : crypto.randomUUID(),
              platform:
                typeof candidate.platform === 'string' && candidate.platform.trim()
                  ? candidate.platform
                  : 'claude',
              timestamp:
                typeof candidate.timestamp === 'string'
                  ? candidate.timestamp
                  : new Date().toISOString(),
              summary:
                typeof candidate.summary === 'string'
                  ? candidate.summary
                  : typeof candidate.snapshot.summary === 'string'
                    ? candidate.snapshot.summary
                    : 'Export checkpoint',
              snapshot: normalizedSnapshot,
              hash:
                typeof candidate.hash === 'string'
                  ? candidate.hash
                  : hashProjectState(normalizedSnapshot),
            };
          })
          .filter((checkpoint): checkpoint is ProjectCheckpoint => checkpoint !== null)
      : [],
    restorePoints: Array.isArray(raw.restorePoints)
      ? raw.restorePoints
          .map((restorePoint: unknown): ProjectRestorePoint | null => {
            if (!restorePoint || typeof restorePoint !== 'object') return null;
            const candidate = restorePoint as LegacyRestorePoint;
            if (!candidate.snapshot || typeof candidate.snapshot !== 'object') return null;

            return {
              id: typeof candidate.id === 'string' ? candidate.id : crypto.randomUUID(),
              timestamp:
                typeof candidate.timestamp === 'string'
                  ? candidate.timestamp
                  : new Date().toISOString(),
              reason: candidate.reason === 'rescan' ? 'rescan' : 'ai_apply',
              summary: typeof candidate.summary === 'string' ? candidate.summary : 'Restore point',
              snapshot: cloneCheckpointSnapshot(normalizeOldProject(candidate.snapshot)),
            };
          })
          .filter((restorePoint): restorePoint is ProjectRestorePoint => restorePoint !== null)
      : [],
    platformState: raw.platformState
      ? Object.fromEntries(
          Object.entries(raw.platformState).map(([platform, state]) => {
            const platformState = (state && typeof state === 'object' ? state : {}) as LegacyPlatformState;
            return [
              platform,
              {
                lastExportHash: platformState.lastExportHash || platformState.lastSentSnapshotId,
                lastExportedAt: platformState.lastExportedAt || platformState.lastReplyAt,
                lastSeenAt: platformState.lastSeenAt,
                lastReplyAt: platformState.lastReplyAt,
                lastSessionNote: platformState.lastSessionNote,
                exportCount: platformState.exportCount,
              },
            ];
          }),
        )
      : {},
    // ── 1.1.0 optional fields — undefined when not present in raw data ────────
    inProgress: Array.isArray(raw.inProgress)
      ? (raw.inProgress as unknown[]).filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : undefined,
    lastSessionSummary:
      typeof raw.lastSessionSummary === 'string' && raw.lastSessionSummary.trim()
        ? raw.lastSessionSummary
        : undefined,
    openQuestion:
      typeof raw.openQuestion === 'string' && raw.openQuestion.trim()
        ? raw.openQuestion
        : undefined,
    projectReason:
      typeof raw.projectReason === 'string' && raw.projectReason.trim()
        ? raw.projectReason
        : undefined,
    recentProgressNote:
      typeof raw.recentProgressNote === 'string' && raw.recentProgressNote.trim()
        ? raw.recentProgressNote
        : undefined,
    projectBlueprint: normalizeProjectBlueprint(raw.projectBlueprint),
  };
}

export function toOldFormat(project: ProjectMemory): Record<string, unknown> {
  const updatedAt = project.updatedAt || projectUpdatedAt(project) || new Date().toISOString();

  return {
    schema_version: SCHEMA_VERSION,
    id: project.id,
    projectName: project.name,
    created: new Date().toISOString(),
    updatedAt,
    lastModified: updatedAt,
    summary: project.summary,
    goals: project.goals,
    rules: project.rules,
    decisions: project.decisions.map((d) => (typeof d === 'string' ? d : d.decision)),
    currentState: project.currentState,
    projectReason: project.projectReason ?? '',
    recentProgressNote: project.recentProgressNote ?? '',
    projectBlueprint: project.projectBlueprint,
    nextSteps: project.nextSteps,
    openQuestions: project.openQuestions,
    importantAssets: project.importantAssets,
    projectCharter: project.projectCharter ?? '',
    aiInstructions: {
      role: 'You are a project collaborator.',
      tone: 'Clear, direct, structured',
      focus: project.aiInstructions || 'Help move the project forward without losing continuity',
    },
    linkedFolder: project.linkedFolder,
    lastGitSync: project.lastGitSync,
    pendingGitCommits: project.pendingGitCommits,
    checkpoints: project.checkpoints.map((checkpoint) => ({
      ...checkpoint,
      snapshot: checkpoint.snapshot,
    })),
    restorePoints: (project.restorePoints ?? []).map((restorePoint) => ({
      ...restorePoint,
      snapshot: restorePoint.snapshot,
    })),
    changelog: project.changelog.map((entry) => ({
      date: entry.timestamp,
      source: entry.source || 'app',
      description: entry.summary,
    })),
    platformState: project.platformState
      ? Object.fromEntries(
          Object.entries(project.platformState).map(([platform, state]) => [
            platform,
            {
              lastSentSnapshotId: state?.lastExportHash || '',
              lastExportedAt: state?.lastExportedAt,
              lastExportHash: state?.lastExportHash,
              lastSeenAt: state?.lastSeenAt,
              lastReplyAt: state?.lastReplyAt,
              lastSessionNote: state?.lastSessionNote,
              exportCount: state?.exportCount,
            },
          ]),
        )
      : {},
    snapshots: [],
    handoffs: [],
    autoFillState: {},
  };
}

function stripPortablePrivateFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripPortablePrivateFields);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'linkedProjectPath') {
      continue;
    }

    if (key === 'linkedFolder' && nestedValue && typeof nestedValue === 'object') {
      const safeLinkedFolder = { ...(nestedValue as Record<string, unknown>) };
      delete safeLinkedFolder.path;
      result[key] = stripPortablePrivateFields(safeLinkedFolder);
      continue;
    }

    result[key] = stripPortablePrivateFields(nestedValue);
  }

  return result;
}

function toPortableExportFormat(project: ProjectMemory): Record<string, unknown> {
  return stripPortablePrivateFields(toOldFormat(project)) as Record<string, unknown>;
}
// ————————————————————————————————————————————————————————————————————————————
// Scan result types
// ————————————————————————————————————————————————————————————————————————————

type PackageInfo = {
  name?: string;
  description?: string;
  version?: string;
};

type StackSignal = {
  source: string;
  signal: string;
  detail?: string;
};

type TechStackInfo = {
  languages: string[];
  frameworks: string[];
  package_managers: string[];
  build_tools: string[];
  runtimes: string[];
  confidence: string;
  signals: StackSignal[];
};

type ScanSuggestions = {
  project_name?: string;
  summary?: string;
  detected_tags: string[];
};

type ScanMeta = {
  readme?: string;
  package_json?: PackageInfo;
  cargo_toml?: PackageInfo;
  stack: TechStackInfo;
  suggestions: ScanSuggestions;
};

type ScanResult = {
  files: string[];
  scan_hash: string;
  meta: ScanMeta;
};

type RescanResult = {
  project_id: string;
  files: string[];
  scan_hash: string;
  folder_exists: boolean;
  meta?: ScanMeta;
};

export type StateManifestItem = {
  id: string;
  kind: 'decision' | 'goal' | 'rule' | 'open_question';
  content_hash: string;
  preview: string;
};

export type StateManifest = {
  schema_version: string;
  project_id: string;
  generated_at: string;
  item_count: number;
  state_digest: string;
  items: StateManifestItem[];
};

export type StateManifestPreview = {
  manifest: StateManifest;
  text: string;
  digest: string;
  item_count: number;
};

// ————————————————————————————————————————————————————————————————————————————
// Launchpad types
// ————————————————————————————————————————————————————————————————————————————

export type LaunchpadTemplateId = 'blank-project' | 'react-vite' | 'landing-page';

export interface CreateTemplateFolderInput {
  projectName: string;
  description: string;
  templateId: LaunchpadTemplateId;
  targetParentFolder: string;
}

export interface CreateTemplateFolderResult {
  folderPath: string;
  filesCreated: string[];
  scanHash: string;
}

function formatDetectedStack(meta?: ScanMeta): string {
  if (!meta) return '';

  const parts = [
    ...meta.stack.frameworks,
    ...meta.stack.languages.filter((lang) => !meta.stack.frameworks.includes(lang)),
    ...meta.stack.build_tools,
  ].slice(0, 3);

  return parts.length > 0 ? `Detected: ${parts.join(', ')}` : '';
}

function toMarkdownList(items: string[]): string {
  if (!items.length) return '- None';
  return items.map((item) => `- ${item}`).join('\n');
}

function serializeProjectAsMarkdown(project: ProjectMemory): string {
  const decisions = project.decisions.length
    ? project.decisions
        .map((decision) => {
          const rationale =
            typeof decision === 'string'
              ? ''
              : decision.rationale
                ? `\n  - Why: ${decision.rationale}`
                : '';
          const label = typeof decision === 'string' ? decision : decision.decision;
          return `- ${label}${rationale}`;
        })
        .join('\n')
    : '- None';

  const linkedFolder = project.linkedFolder?.path
    ? `\n## Linked Folder\n- Connected\n- Last scanned: ${project.linkedFolder.lastScannedAt ?? 'Unknown'}`
    : '';
  const memoryCoreSection = project.projectCharter?.trim()
    ? ['', '## Memory Core', project.projectCharter.trim()]
    : [];
  return [
    `# ${project.name}`,
    '',
    `Updated: ${project.updatedAt ?? new Date().toISOString()}`,
    '',
    '## Summary',
    project.summary || 'No summary yet.',
    '',
    '## Current State',
    project.currentState || 'No current state recorded.',
    '',
    '## Goals',
    toMarkdownList(project.goals),
    '',
    '## Rules',
    toMarkdownList(project.rules),
    '',
    '## Decisions',
    decisions,
    '',
    '## Next Steps',
    toMarkdownList(project.nextSteps),
    '',
    '## Open Questions',
    toMarkdownList(project.openQuestions),
    '',
    '## Important Assets',
    toMarkdownList(project.importantAssets),
    ...memoryCoreSection,
    linkedFolder,
    '',
  ].join('\n');
}

// ————————————————————————————————————————————————————————————————————————————
// Core storage operations (with browser fallback)
// ————————————————————————————————————————————————————————————————————————————

function projectUpdatedAt(project: ProjectMemory): string {
  if (project.updatedAt) return project.updatedAt;
  if (!project.changelog?.length) return '1970-01-01T00:00:00.000Z';
  const sorted = project.changelog.map((e) => e.timestamp).sort();
  return sorted[sorted.length - 1] ?? '1970-01-01T00:00:00.000Z';
}

function touchProject(project: ProjectMemory, updatedAt = new Date().toISOString()): ProjectMemory {
  return {
    ...project,
    updatedAt,
  };
}

function createRestorePoint(
  project: ProjectMemory,
  reason: ProjectRestorePoint['reason'],
  summary: string,
  timestamp = new Date().toISOString(),
): ProjectRestorePoint {
  return {
    id: crypto.randomUUID(),
    timestamp,
    reason,
    summary,
    snapshot: cloneCheckpointSnapshot(project),
  };
}

export function withRestorePoint(
  project: ProjectMemory,
  reason: ProjectRestorePoint['reason'],
  summary: string,
  timestamp = new Date().toISOString(),
): ProjectMemory {
  const restorePoint = createRestorePoint(project, reason, summary, timestamp);

  return touchProject(
    {
      ...project,
      restorePoints: [...(project.restorePoints ?? []), restorePoint].slice(-MAX_RESTORE_POINTS),
    },
    timestamp,
  );
}

function debugCloudSave(meta: Record<string, unknown>): void {
  try {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem('mph_debug_cloud_save') !== '1') return;
    console.info('[cloud-save]', meta);
  } catch {
    // Debug logging must never affect save behavior.
  }
}

async function attemptCloudPushAfterLocalSave(localProject: ProjectMemory): Promise<void> {
  const latestStore = store();
  const cloudSyncEnabled = latestStore.settings.privacy.cloudSyncEnabled;
  const cloudDisconnecting = latestStore.cloudDisconnecting;
  const hasCloudUser = Boolean(latestStore.cloudUser);
  const willAttemptCloudPush = cloudSyncEnabled && !cloudDisconnecting;

  debugCloudSave({
    localSaved: true,
    cloudSyncEnabled,
    cloudDisconnecting,
    hasCloudUser,
    willAttemptCloudPush,
  });

  if (!cloudSyncEnabled) {
    latestStore.setSyncStatus('saved_local');
    return;
  }

  if (cloudDisconnecting) {
    latestStore.setSyncStatus('saved_local');
    return;
  }

  try {
    const result = await pushProject(localProject, latestStore.cloudUser?.id);
    debugCloudSave({
      localSaved: true,
      cloudPushResult: result.status,
      hasCloudUser,
    });

    if (result.status === 'disabled') {
      latestStore.setSyncStatus('error');
      latestStore.showToast('Saved locally, but cloud sync is not available.', 'error');
      return;
    }

    if (result.status === 'pending') {
      latestStore.setSyncStatus('pending');
      if (latestStore.syncStatus !== 'pending') {
        latestStore.showToast('Saved locally. Cloud sync is pending.', 'info');
      }
      return;
    }

    if (result.status === 'error') {
      latestStore.setSyncStatus('error');
      latestStore.showToast(result.message || 'Saved locally, but cloud sync failed.', 'error');
      return;
    }

    if (result.status === 'saved_local') {
      latestStore.setSyncStatus('saved_local');
    }
  } catch (err) {
    console.error('[Memphant] autosave cloud push unhandled error:', err);
    latestStore.setSyncStatus('error');
    latestStore.showToast('Saved locally, but cloud sync failed.', 'error');
  }
}

export async function saveToDisk(project: ProjectMemory): Promise<void> {
  const storeState = store();
  const localProject = touchProject(project);
  const data = JSON.stringify(toOldFormat(localProject), null, 2);

  const stem = canonicalTauriFileStem(localProject.id);
  const fileName = canonicalTauriFileName(localProject.id);

  if (canUseNativeProjectStorage()) {
    try {
      await tauriInvoke('backup_project_file', { fileName });
    } catch (err) {
      console.warn('[Memphant] Backup failed:', err);
    }

    await tauriInvoke('save_project_file', {
      projectName: stem,
      projectData: data,
    });
  } else {
    browserStore.save(localProject.id, data);
  }

  if (storeState.cloudUser && storeState.settings.privacy.cloudSyncEnabled) {
    storeState.setSyncStatus('saved_local');
  }

  void attemptCloudPushAfterLocalSave(localProject);
}

export async function loadAllFromDisk(): Promise<ProjectMemory[]> {
  const fileNames = canUseNativeProjectStorage()
    ? await tauriInvoke<string[]>('load_projects')
    : browserStore.list();

  const loadedById = new Map<
    string,
    { project: ProjectMemory; updatedAt: string; fileName: string; canonical: boolean }
  >();

  for (const fileName of fileNames) {
    try {
      const content = canUseNativeProjectStorage()
        ? await tauriInvoke<string>('load_project_file', { fileName })
        : browserStore.load(fileName);
      const project = normalizeOldProject(JSON.parse(content));

      if (canUseNativeProjectStorage()) {
        const canonical = canonicalTauriFileName(project.id);
        if (fileName !== canonical) {
          let canonicalExists = false;
          try {
            await tauriInvoke<string>('load_project_file', { fileName: canonical });
            canonicalExists = true;
          } catch {
            canonicalExists = false;
          }

          if (canonicalExists) {
            try {
              await tauriInvoke('delete_project_file', { fileName });
            } catch {
              // Non-fatal: keep legacy file if we can't delete it.
            }
          } else {
            try {
              await tauriInvoke('rename_project_file', {
                fromFileName: fileName,
                toFileName: canonical,
              });
            } catch {
              // Non-fatal: keep legacy file if rename fails.
            }
          }
        }
      } else {
        const canonical = canonicalBrowserFileName(project.id);
        if (fileName !== canonical) {
          if (browserStore.exists(canonical)) {
            browserStore.delete(fileName);
          } else {
            browserStore.save(project.id, content);
            browserStore.delete(fileName);
          }
        }
      }

      const updatedAt = projectUpdatedAt(project);
      const canonical =
        (canUseNativeProjectStorage() && fileName === canonicalTauriFileName(project.id)) ||
        (!canUseNativeProjectStorage() && fileName === canonicalBrowserFileName(project.id));

      const existing = loadedById.get(project.id);
      if (!existing) {
        loadedById.set(project.id, { project, updatedAt, fileName, canonical });
        continue;
      }

      const existingWins =
        existing.updatedAt > updatedAt ||
        (existing.updatedAt === updatedAt && existing.canonical && !canonical);

      if (!existingWins) {
        loadedById.set(project.id, { project, updatedAt, fileName, canonical });
      }
    } catch (err) {
      console.warn(`Failed to load ${fileName}:`, err);
    }
  }

  return Array.from(loadedById.values()).map((v) => v.project);
}

// ————————————————————————————————————————————————————————————————————————————
// Actions
// ————————————————————————————————————————————————————————————————————————————

const store = () => useProjectStore.getState();

/** Early access is fully free, so project creation is never blocked here. */
function checkFreeTierLimit(): boolean {
  return false;
}

export async function createProject(name: string): Promise<void> {
  if (!name.trim()) {
    store().showToast('Please enter a project name.');
    return;
  }

  if (checkFreeTierLimit()) return;

  const now = new Date().toISOString();
  const id = name.trim().replace(/\s+/g, '_').toLowerCase() + '_' + Date.now();

  const baseProject: ProjectMemory = {
    schema_version: SCHEMA_VERSION,
    id,
    name: name.trim(),
    updatedAt: now,
    summary: '',
    goals: [],
    rules: [],
    decisions: [],
    currentState: '',
    nextSteps: [],
    openQuestions: [],
    importantAssets: [],
    projectCharter: '',
    checkpoints: [],
    restorePoints: [],
    changelog: [{ timestamp: now, field: 'general', action: 'added', summary: 'Project created', source: 'app' }],
    platformState: {},
  };

  // Auto-fill empty fields using smart suggestions
  const suggestions = suggestEmptyFields(baseProject);
  const project: ProjectMemory = {
    ...baseProject,
    ...(suggestions.summary && { summary: suggestions.summary }),
    ...(suggestions.currentState && { currentState: suggestions.currentState }),
    ...(suggestions.goals?.length && { goals: suggestions.goals }),
  };

  try {
    await saveToDisk(project);
    store().addProject(project);
    store().setActiveProject(project.id);
    track('project_created');
    store().showToast(`"${project.name}" created.`);
  } catch (err) {
    console.error('Create failed:', err);
    store().showToast('Could not create that project.', 'error');
  }
}

export async function createProjectFromTemplate(
  template: ProjectTemplate,
  name: string,
): Promise<void> {
  if (!name.trim()) {
    store().showToast('Please enter a project name.');
    return;
  }
  if (checkFreeTierLimit()) return;

  const now = new Date().toISOString();
  const id = name.trim().replace(/\s+/g, '_').toLowerCase() + '_' + Date.now();
  const base = template.build(name.trim());

  const project: ProjectMemory = {
    ...base,
    id,
    updatedAt: now,
    checkpoints: [],
    restorePoints: [],
    changelog: [
      {
        timestamp: now,
        field: 'general',
        action: 'added',
        summary: `Project created from "${template.label}" template`,
        source: 'app',
      },
    ],
    platformState: {},
  };

  try {
    await saveToDisk(project);
    store().addProject(project);
    store().setActiveProject(project.id);
    track('project_created');
    store().showToast(`"${project.name}" created from ${template.label} template.`);
  } catch (err) {
    console.error('Create from template failed:', err);
    store().showToast('Could not create that project.', 'error');
  }
}

export async function createProjectFromFolder(): Promise<void> {
  if (!canScanFolders()) {
    store().showToast(getUnavailableFeatureMessage('folderScan'), 'info');
    return;
  }

  if (checkFreeTierLimit()) return;

  try {
    const selected = await selectAndScanProjectFolder();
    if (!selected) return;

    const derivedName =
      selected.result.meta?.suggestions?.project_name ||
      selected.result.meta?.package_json?.name ||
      selected.result.meta?.cargo_toml?.name ||
      selected.folderName;

    const derivedSummary =
      selected.result.meta?.suggestions?.summary ||
      selected.result.meta?.package_json?.description ||
      '';

    const now = new Date().toISOString();
    const id = derivedName.replace(/\s+/g, '_').toLowerCase() + '_' + Date.now();

    const project: ProjectMemory = {
      schema_version: SCHEMA_VERSION,
      id,
      name: derivedName,
      updatedAt: now,
      summary: derivedSummary,
      goals: [],
      rules: [],
      decisions: [],
      currentState: `Project folder scanned. ${selected.result.files.length} useful files identified.`,
      nextSteps: [],
      openQuestions: [],
      importantAssets: selected.result.files.slice(0, 200),
      projectCharter: '',
      checkpoints: [],
      restorePoints: [],
      linkedFolder: {
        path: selected.linkedPath,
        scanHash: selected.result.scan_hash,
        lastScannedAt: now,
      },
      changelog: [
        {
          timestamp: now,
          field: 'general',
          action: 'added',
          summary: `Project created from folder: ${selected.folderName}`,
          source: 'app',
        },
      ],
      platformState: {},
    };

    await saveToDisk(project);
    store().addProject(project);
    store().setActiveProject(project.id);
    track('project_created');
    store().showToast(`"${project.name}" created from folder.`);
  } catch (err) {
    console.error('Folder scan failed:', err);
    store().showToast('Could not create a project from that folder.', 'error');
  }
}

export async function rescanLinkedFolder(): Promise<void> {
  const activeProject = store().activeProject();
  if (!activeProject?.linkedFolder?.path) {
    store().showToast('This project is not linked to a folder.');
    return;
  }

  if (!canRescanLinkedFolders()) {
    store().showToast(getUnavailableFeatureMessage('rescan'), 'info');
    return;
  }

  if (!isDesktopApp()) {
    store().showToast('Select the folder again so Memephant can rescan it locally.', 'info');
    await linkFolder();
    return;
  }

  try {
    const result = await tauriInvoke<RescanResult>('rescan_linked_folder', {
      projectId: activeProject.id,
      folderPath: activeProject.linkedFolder.path,
    });

    if (!result.folder_exists) {
      store().showToast('Linked folder not found — it may have been moved.', 'error');
      return;
    }

    const now = new Date().toISOString();
    const stackSummary = formatDetectedStack(result.meta);
    const projectWithRestore = withRestorePoint(
      activeProject,
      'rescan',
      'Before linked folder rescan',
      now,
    );

    const updatedProject = touchProject(
      {
        ...projectWithRestore,
        importantAssets: result.files.slice(0, 200),
        linkedFolder: {
          path: activeProject.linkedFolder.path,
          scanHash: result.scan_hash,
          lastScannedAt: now,
        },
        changelog: [
          ...activeProject.changelog,
          {
            timestamp: now,
            field: 'general',
            action: 'updated',
            summary: stackSummary
              ? `Linked project rescanned. ${stackSummary}`
              : 'Linked project rescanned',
            source: 'system',
          },
        ],
      },
      now,
    );

    store().updateProject(activeProject.id, updatedProject);
    try {
      await saveToDisk(updatedProject);
    } catch {
      store().showToast('Your changes could not be saved. Please try again.', 'error');
    }
    store().showToast('Rescan complete. Restore available.');
  } catch (err) {
    console.error('Rescan failed:', err);
    store().showToast('Could not rescan the linked folder.', 'error');
  }
}

export async function restoreProjectFromHistory(
  projectId: string,
  restorePointId: string,
): Promise<boolean> {
  const project = store().projects.find((item) => item.id === projectId);
  if (!project) {
    store().showToast('Project not found.', 'error');
    return false;
  }

  const restorePoint = (project.restorePoints ?? []).find((item) => item.id === restorePointId);
  if (!restorePoint) {
    store().showToast('Restore point not found.', 'error');
    return false;
  }

  const now = new Date().toISOString();
  const restoredProject: ProjectMemory = touchProject(
    {
      ...project,
      ...cloneCheckpointSnapshot(restorePoint.snapshot),
      checkpoints: [...(project.checkpoints ?? [])],
      restorePoints: [...(project.restorePoints ?? [])],
      changelog: [
        ...restorePoint.snapshot.changelog.map((entry) => ({ ...entry })),
        {
          timestamp: now,
          field: 'general',
          action: 'updated',
          summary: `Restored project from ${restorePoint.reason === 'rescan' ? 'rescan' : 'AI apply'} history`,
          source: 'app',
        },
      ],
    },
    now,
  );

  store().updateProject(project.id, restoredProject);
  try {
    await saveToDisk(restoredProject);
  } catch {
    store().showToast(
      'Restore saved to memory but could not write to disk. Restart the app if the issue persists.',
      'error'
    );
  }
  store().showToast('Project restored from history.');
  return true;
}

export async function linkFolder(): Promise<void> {
  const activeProject = store().activeProject();
  if (!activeProject) {
    store().showToast('Open a project first.');
    return;
  }

  if (!canLinkFolders()) {
    store().showToast(getUnavailableFeatureMessage('folderLink'), 'info');
    return;
  }

  try {
    const selected = await selectAndScanProjectFolder();
    if (!selected) return;
    const now = new Date().toISOString();

    const updatedProject: ProjectMemory = {
      ...activeProject,
      importantAssets: selected.result.files.slice(0, 200),
      linkedFolder: {
        path: selected.linkedPath,
        scanHash: selected.result.scan_hash,
        lastScannedAt: now,
      },
      updatedAt: now,
      changelog: [
        ...activeProject.changelog,
        {
          timestamp: now,
          field: 'general',
          action: 'added',
          summary: 'Project folder linked and scanned',
          source: 'app',
        },
      ],
    };

    store().updateProject(activeProject.id, updatedProject);
    await saveToDisk(updatedProject); // persist link so it survives app restart

    store().showToast('Folder linked and scanned.');
  } catch (err) {
    console.error('Link folder failed:', err);
    store().showToast('Could not scan that folder.', 'error');
  }
}

export async function unlinkFolder(): Promise<void> {
  const activeProject = store().activeProject();
  if (!activeProject?.linkedFolder) {
    store().showToast('This project is not linked to a folder.');
    return;
  }

  const now = new Date().toISOString();
  const updatedProject: ProjectMemory = {
    ...activeProject,
    linkedFolder: undefined,
    updatedAt: now,
    changelog: [
      ...activeProject.changelog,
      {
        timestamp: now,
        field: 'linkedFolder',
        action: 'removed',
        summary: 'Project folder unlinked',
        source: 'app',
      },
    ],
  };

  store().updateProject(activeProject.id, updatedProject);
  await saveToDisk(updatedProject);
  store().showToast('Folder unlinked. Project memory kept.');
}

export async function importProjectFromFile(file: File): Promise<void> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const project = normalizeOldProject(parsed);

    project.id = project.name.replace(/\s+/g, '_').toLowerCase() + '_' + Date.now();

    const now = new Date().toISOString();
    project.changelog = [
      ...project.changelog,
      { timestamp: now, field: 'general', action: 'added', summary: `Imported from file: ${file.name}`, source: 'app' },
    ];
    project.updatedAt = now;
    project.checkpoints = Array.isArray(project.checkpoints) ? project.checkpoints : [];
    project.restorePoints = Array.isArray(project.restorePoints) ? project.restorePoints : [];

    await saveToDisk(project);
    store().addProject(project);
    store().setActiveProject(project.id);
    track('project_imported');
    store().showToast(`"${project.name}" imported.`);
  } catch (err) {
    console.error('Import failed:', err);
    store().showToast('Could not import that file. Make sure it is a valid Memephant file.', 'error');
  }
}

export async function deleteProject(id: string): Promise<void> {
  const projects = store().projects;
  const project = projects.find((p) => p.id === id);
  if (!project) return;

  const fileName = canUseNativeProjectStorage()
    ? canonicalTauriFileName(project.id)
    : canonicalBrowserFileName(project.id);

  try {
    if (canUseNativeProjectStorage()) {
      await tauriInvoke('delete_project_file', { fileName });
    } else {
      browserStore.delete(fileName);
    }

    store().removeProject(id);
    store().showToast(`"${project.name}" was removed.`);

    await dequeue(id);
    void deleteCloudProject(id);
  } catch (err) {
    console.error('Delete failed:', err);
    store().showToast('Could not remove that project.', 'error');
  }
}

export async function getProjectsPath(): Promise<string> {
  if (!canUseNativeProjectStorage()) {
    return 'Browser storage (localStorage)';
  }
  try {
    return await tauriInvoke<string>('get_projects_path');
  } catch (err) {
    console.error('getProjectsPath failed:', err);
    return 'Unknown path';
  }
}

export async function exportActiveProjectAsMarkdown(): Promise<void> {
  const activeProject = store().activeProject();
  if (!activeProject) {
    store().showToast('Open a project first.', 'error');
    return;
  }

  const markdown = serializeProjectAsMarkdown(activeProject);
  const safeName = canonicalTauriFileStem(activeProject.name || activeProject.id);
  const datePart = new Date().toISOString().slice(0, 10);
  const fileName = `${safeName}-${datePart}.md`;

  try {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    store().showToast('Markdown snapshot downloaded.');
  } catch (err) {
    console.error('Markdown export failed:', err);
    store().showToast('Could not export markdown snapshot.', 'error');
  }
}

export async function exportActiveProjectAsJson(): Promise<void> {
  const activeProject = store().activeProject();
  if (!activeProject) {
    store().showToast('Open a project first.', 'error');
    return;
  }

  try {
    const content = JSON.stringify(toPortableExportFormat(activeProject), null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const safeName = canonicalTauriFileStem(activeProject.name || activeProject.id);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}.json`;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    store().showToast('Project JSON downloaded.');
  } catch (err) {
    console.error('JSON export failed:', err);
    store().showToast('Could not export project JSON.', 'error');
  }
}

/**
 * Copy formatted export text to clipboard and record the sync timestamp
 * on the project's platform state.
 */
export async function copyExportToClipboard(
  exportText: string,
  platform: Platform,
): Promise<void> {
  const { projects, activeProjectId, updateProject, showToast, settings } = store();

  try {
    await navigator.clipboard.writeText(exportText);
  } catch {
    store().showToast('Could not copy to clipboard — please try again.', 'error');
    return;
  }

  const project = projects.find((item) => item.id === activeProjectId);
  if (!project) {
    store().showToast(`Copied for ${platform}.`);
    return;
  }

  const now = new Date().toISOString();
  const snapshot = cloneCheckpointSnapshot(project);
  const hash = hashProjectState(snapshot);
  const checkpoint: ProjectCheckpoint = {
    id: crypto.randomUUID(),
    platform,
    timestamp: now,
    summary: project.summary || `Exported for ${platform}`,
    snapshot,
    hash,
  };
  const maxCheckpoints = Math.max(1, settings.projects.snapshotCount || 20);
  const existingPlatformState = project.platformState?.[platform] ?? {};

  const updatedProject: ProjectMemory = touchProject(
    {
      ...project,
      checkpoints: [...(project.checkpoints ?? []), checkpoint].slice(-maxCheckpoints),
      platformState: {
        ...project.platformState,
        [platform]: {
          ...existingPlatformState,
          lastExportHash: hash,
          lastExportedAt: now,
          exportCount: (existingPlatformState.exportCount ?? 0) + 1,
        },
      },
      changelog: [
        ...project.changelog,
        {
          timestamp: now,
          field: 'general',
          action: 'updated',
          summary: `Copied project context for ${platform}`,
          source: 'app',
        },
      ],
    },
    now,
  );

  const clearedProject: ProjectMemory = {
    ...updatedProject,
    pendingGitCommits: undefined,
    updatedAt: now,
  };

  updateProject(project.id, clearedProject);
  try {
    await saveToDisk(clearedProject);
  } catch {
    store().showToast('Your changes could not be saved. Please try again.', 'error');
  }

  showToast(`Copied for ${platform} — paste into your AI to get started`);
}

export async function downloadAllData(): Promise<void> {
  const { projects, settings } = store();

  const payload = {
    exported_at: new Date().toISOString(),
    app: 'Memephant',
    schema_version: 1,
    projects: projects.map((project) => toPortableExportFormat(project)),
    settings,
  };

  try {
    const content = JSON.stringify(payload, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const datePart = new Date().toISOString().slice(0, 10);
    const link = document.createElement('a');
    link.href = url;
    link.download = `memephant-data-${datePart}.json`;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    store().showToast('Data export downloaded.');
  } catch (err) {
    console.error('downloadAllData failed:', err);
    store().showToast('Could not export your data.', 'error');
  }
}

// ————————————————————————————————————————————————————————————————————————————
// Launchpad service functions
// ————————————————————————————————————————————————————————————————————————————

type RawCreateTemplateFolderResult = {
  folder_path: string;
  files_created: string[];
  scan_hash: string;
};

export async function createTemplateProjectFolder(
  input: CreateTemplateFolderInput,
): Promise<CreateTemplateFolderResult> {
  if (!isDesktopApp()) {
    throw new Error('Creating a project folder requires the desktop app.');
  }

  const result = await tauriInvoke<RawCreateTemplateFolderResult>(
    'create_project_from_template_folder',
    {
      input: {
        project_name: input.projectName,
        description: input.description,
        template_id: input.templateId,
        target_parent_folder: input.targetParentFolder,
      },
    },
  );

  return {
    folderPath: result.folder_path,
    filesCreated: result.files_created,
    scanHash: result.scan_hash,
  };
}

export async function openCreatedProjectFolder(folderPath: string): Promise<void> {
  if (!isDesktopApp()) {
    console.warn('[Memphant] openCreatedProjectFolder: desktop app required.');
    return;
  }

  await tauriInvoke('open_project_folder', { folderPath });
}

export async function getFilesChangedSince(
  folderPath: string,
  sinceIso: string,
): Promise<string[]> {
  if (!isDesktopApp()) {
    return [];
  }

  try {
    return await tauriInvoke<string[]>('get_files_changed_since', {
      folderPath,
      sinceIso,
    });
  } catch {
    return [];
  }
}
