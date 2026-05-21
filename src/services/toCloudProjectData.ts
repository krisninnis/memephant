import type { ProjectMemory } from '../types/memphant-types';

const REDACTED_LOCAL_PATH = '[local-path-redacted]';
const REDACTED_SECRET = '[secret-redacted]';
const FILE_URL_PATH_PATTERN = /file:\/\/\/?[^\s"'`<>)]+/gi;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /\b[A-Za-z]:[\\/][^\s"'`<>|?*]+/g;
const UNC_ABSOLUTE_PATH_PATTERN = /\\\\[^\\/\s"'`<>|?*]+[\\/][^\s"'`<>|?*]+/g;
const UNIX_ABSOLUTE_PATH_PATTERN =
  /(^|[\s(["'`])((?:\/(?:Users|home|private|Volumes|mnt|var|tmp|Desktop))[^\s"'`<>)]*)/g;
const SECRET_VALUE_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
  /sk_(?:live|test)_[A-Za-z0-9]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /gh[pousr]_[A-Za-z0-9]{30,}/g,
  /github_pat_[A-Za-z0-9_]{40,}/g,
  /xox[baprs]-[A-Za-z0-9-]{20,}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /hf_[A-Za-z0-9]{30,}/g,
  /SG\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{40,}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
  /-----BEGIN [A-Z ]+ KEY-----/g,
  /(postgres|postgresql|mysql|mongodb|redis|mongodb\+srv):\/\/[^\s"']+/gi,
  /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{20,}/gi,
];
const SECRET_ASSIGNMENT_PATTERN =
  /\b(api[_-]?key|password|passwd|secret|token|access[_-]?token|refresh[_-]?token|service[_-]?role[_-]?key)\s*[:=]\s*["']?[^\s"',;]+["']?/gi;
const ENV_SECRET_LINE_PATTERN =
  /^([A-Z][A-Z0-9_]*(?:API[_-]?KEY|KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL|SERVICE_ROLE)[A-Z0-9_]*\s*=\s*)(.+)$/gim;

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

function redactSecrets(value: string): string {
  let out = value.replace(ENV_SECRET_LINE_PATTERN, (_match, prefix: string) => {
    return `${prefix}${REDACTED_SECRET}`;
  });

  out = out.replace(SECRET_ASSIGNMENT_PATTERN, (match, key: string) => {
    const separator = match.includes(':') ? ':' : '=';
    const beforeSeparator = match.split(separator)[0] ?? key;
    return `${beforeSeparator}${separator} ${REDACTED_SECRET}`;
  });

  for (const pattern of SECRET_VALUE_PATTERNS) {
    out = out.replace(pattern, REDACTED_SECRET);
  }

  return out;
}

function cloneCloudSafe(value: unknown, knownPaths: string[], key = ''): unknown {
  if (typeof value === 'string') {
    if (isLocalPathField(key, value)) {
      return undefined;
    }

    return redactAbsoluteLocalPaths(redactSecrets(redactKnownPaths(value, knownPaths)));
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
