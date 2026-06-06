import type { LinkedFolder, ProjectMemory } from '../types/memphant-types';

export const BROWSER_LINKED_FOLDER_PREFIX = 'browser-folder:';

export type LinkedFolderConnectionState = 'connected' | 'reconnect-needed' | 'not-connected';

function cleanPath(path: string | undefined): string {
  return path?.trim() ?? '';
}

export function hasRestorableLinkedFolderAccess(linkedFolder: LinkedFolder | undefined): boolean {
  const path = cleanPath(linkedFolder?.path);
  return Boolean(path) && !path.startsWith(BROWSER_LINKED_FOLDER_PREFIX);
}

export function hasSafeLinkedFolderScanMetadata(project: ProjectMemory): boolean {
  const linkedFolder = project.linkedFolder;
  if (!linkedFolder) return false;

  return Boolean(
    linkedFolder.scanHash ||
    linkedFolder.lastScannedAt ||
    (project.importantAssets ?? []).length > 0,
  );
}

export function getLinkedFolderConnectionState(project: ProjectMemory): LinkedFolderConnectionState {
  if (hasRestorableLinkedFolderAccess(project.linkedFolder)) return 'connected';
  if (hasSafeLinkedFolderScanMetadata(project)) return 'reconnect-needed';
  return 'not-connected';
}

function sharesImportantAsset(remoteProject: ProjectMemory, localProject: ProjectMemory): boolean {
  const localAssets = new Set(
    (localProject.importantAssets ?? [])
      .map((asset) => asset.trim().toLowerCase())
      .filter(Boolean),
  );

  if (localAssets.size === 0) return false;

  return (remoteProject.importantAssets ?? [])
    .map((asset) => asset.trim().toLowerCase())
    .filter(Boolean)
    .some((asset) => localAssets.has(asset));
}

function hasMatchingSafeScanMetadata(remoteProject: ProjectMemory, localProject: ProjectMemory): boolean {
  const remoteFolder = remoteProject.linkedFolder;
  const localFolder = localProject.linkedFolder;
  if (!remoteFolder || !localFolder) return false;

  if (remoteFolder.scanHash && localFolder.scanHash) {
    return remoteFolder.scanHash === localFolder.scanHash;
  }

  if (remoteFolder.lastScannedAt && localFolder.lastScannedAt) {
    return remoteFolder.lastScannedAt === localFolder.lastScannedAt;
  }

  return sharesImportantAsset(remoteProject, localProject);
}

export function preserveLocalLinkedFolderState(
  remoteProject: ProjectMemory,
  localProject: ProjectMemory | undefined,
): ProjectMemory {
  if (!localProject) return remoteProject;
  if (hasRestorableLinkedFolderAccess(remoteProject.linkedFolder)) return remoteProject;
  if (!hasRestorableLinkedFolderAccess(localProject.linkedFolder)) return remoteProject;
  if (!hasSafeLinkedFolderScanMetadata(remoteProject)) return remoteProject;
  if (!hasMatchingSafeScanMetadata(remoteProject, localProject)) return remoteProject;

  return {
    ...remoteProject,
    linkedFolder: {
      ...remoteProject.linkedFolder,
      path: localProject.linkedFolder?.path,
      scanHash: remoteProject.linkedFolder?.scanHash ?? localProject.linkedFolder?.scanHash,
      lastScannedAt:
        remoteProject.linkedFolder?.lastScannedAt ?? localProject.linkedFolder?.lastScannedAt,
    },
  };
}

export function preserveLocalLinkedFolderStateForProjects(
  remoteProjects: ProjectMemory[],
  localProjects: ProjectMemory[],
): ProjectMemory[] {
  const localById = new Map(localProjects.map((project) => [project.id, project]));
  return remoteProjects.map((project) =>
    preserveLocalLinkedFolderState(project, localById.get(project.id)),
  );
}
