import type { ProjectMemory } from '../types/memphant-types';

const REDACTED_LOCAL_PATH = '[local-path-redacted]';
const FILE_URL_PATH_PATTERN = /file:\/\/\/?[^\s"'`<>)]+/gi;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /\b[A-Za-z]:[\\/][^\s"'`<>|?*]+/g;
const UNC_ABSOLUTE_PATH_PATTERN = /\\\\[^\\/\s"'`<>|?*]+[\\/][^\s"'`<>|?*]+/g;
const UNIX_ABSOLUTE_PATH_PATTERN =
  /(^|[\s(["'`])((?:\/(?:Users|home|private|Volumes|mnt|var|tmp|Desktop))[^\s"'`<>)]*)/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pathVariants(path: string): string[] {
  return Array.from(new Set([
    path,
    path.replace(/\\/g, '/'),
    path.replace(/\//g, '\\'),
  ])).filter(Boolean);
}

function looksLikeLocalPath(value: string): boolean {
  const trimmed = value.trim();

  return (
    /^[A-Za-z]:[\\/]/.test(trimmed) ||
    /^\\\\[^\\]+\\[^\\]+/.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('~/') ||
    trimmed.startsWith('file://')
  );
}

function isLocalPathField(key: string, value: unknown): boolean {
  if (typeof value !== 'string' || !looksLikeLocalPath(value)) return false;

  const normalizedKey = key.toLowerCase();
  return (
    normalizedKey.includes('path') ||
    normalizedKey.includes('folder') ||
    normalizedKey.includes('directory')
  );
}

function redactKnownPaths(value: string, paths: string[]): string {
  return paths.reduce(
    (out, path) => out.replace(new RegExp(escapeRegExp(path), 'g'), REDACTED_LOCAL_PATH),
    value,
  );
}

function trimTrailingPathPunctuation(path: string): { path: string; trailing: string } {
  const match = /[.,;:!?]+$/.exec(path);
  if (!match) return { path, trailing: '' };

  return {
    path: path.slice(0, -match[0].length),
    trailing: match[0],
  };
}

function redactAbsoluteLocalPaths(value: string): string {
  return value
    .replace(FILE_URL_PATH_PATTERN, REDACTED_LOCAL_PATH)
    .replace(WINDOWS_ABSOLUTE_PATH_PATTERN, (match) => {
      const trimmed = trimTrailingPathPunctuation(match);
      return `${REDACTED_LOCAL_PATH}${trimmed.trailing}`;
    })
    .replace(UNC_ABSOLUTE_PATH_PATTERN, (match) => {
      const trimmed = trimTrailingPathPunctuation(match);
      return `${REDACTED_LOCAL_PATH}${trimmed.trailing}`;
    })
    .replace(UNIX_ABSOLUTE_PATH_PATTERN, (_match, prefix: string, path: string) => {
      const trimmed = trimTrailingPathPunctuation(path);
      return `${prefix}${REDACTED_LOCAL_PATH}${trimmed.trailing}`;
    });
}

function cloneCloudSafe(value: unknown, knownPaths: string[], key = ''): unknown {
  if (typeof value === 'string') {
    if (isLocalPathField(key, value)) {
      return undefined;
    }

    return redactAbsoluteLocalPaths(redactKnownPaths(value, knownPaths));
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => cloneCloudSafe(item, knownPaths))
      .filter((item) => item !== undefined);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    if (nestedKey === 'linkedFolder' && nestedValue && typeof nestedValue === 'object') {
      const linkedFolder: Record<string, unknown> = {};

      for (const [folderKey, folderValue] of Object.entries(nestedValue as Record<string, unknown>)) {
        if (folderKey === 'path') continue;

        const safeValue = cloneCloudSafe(folderValue, knownPaths, folderKey);
        if (safeValue !== undefined) {
          linkedFolder[folderKey] = safeValue;
        }
      }

      if (Object.keys(linkedFolder).length > 0) {
        result[nestedKey] = linkedFolder;
      }

      continue;
    }

    if (isLocalPathField(nestedKey, nestedValue)) {
      continue;
    }

    const safeValue = cloneCloudSafe(nestedValue, knownPaths, nestedKey);
    if (safeValue !== undefined) {
      result[nestedKey] = safeValue;
    }
  }

  return result;
}

export function toCloudProjectData(project: ProjectMemory): Record<string, unknown> {
  const knownPaths = project.linkedFolder?.path ? pathVariants(project.linkedFolder.path) : [];

  return cloneCloudSafe(project, knownPaths) as Record<string, unknown>;
}
