// Pure, deterministic run-context classifier for Roblox Luau scripts.
//
// classifyRobloxScript() derives a Roblox run context purely from a file path
// and name. It performs NO file-content reads, NO I/O, and NO Tauri invoke, so
// it behaves identically in the browser scan path and the desktop scan path.
//
// Priority (highest first):
//   1. Rojo filename suffix  -> basis 'filename'
//   2. Path / folder segment -> basis 'path'
//   3. Nothing matched       -> { runContext: 'Unknown', basis: 'none' }
// Non-.lua/.luau paths return null (they are not individual scripts).

export type RobloxRunContext = 'LocalScript' | 'Script' | 'ModuleScript' | 'Unknown';

export interface RobloxScriptClassification {
  runContext: RobloxRunContext;
  basis: 'filename' | 'path' | 'none';
}

const LUAU_FILE = /\.luau?$/i;
const CLIENT_SUFFIX = /\.client\.luau?$/i;
const SERVER_SUFFIX = /\.server\.luau?$/i;
const INIT_MODULE = /^init\.luau?$/i;

// Path-segment families (compared case-insensitively against whole segments).
const LOCAL_SCRIPT_SEGMENTS = new Set([
  'client',
  'starterplayer',
  'starterplayerscripts',
  'startercharacterscripts',
  'startergui',
  'playerscripts',
  'replicatedfirst',
]);
const SERVER_SCRIPT_SEGMENTS = new Set([
  'server',
  'serverscriptservice',
  'serverstorage',
]);
const MODULE_SCRIPT_SEGMENTS = new Set([
  'shared',
  'common',
  'replicatedstorage',
  'modules',
]);

function splitSegments(filePath: string): string[] {
  return filePath
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean);
}

function baseName(filePath: string): string {
  // Only ever called after the LUAU_FILE guard, so there is always at least
  // one non-empty segment (a path ending in .lua/.luau cannot be all slashes).
  const segments = splitSegments(filePath);
  return segments[segments.length - 1];
}

export function classifyRobloxScript(filePath: string): RobloxScriptClassification | null {
  if (typeof filePath !== 'string' || !LUAU_FILE.test(filePath)) {
    return null;
  }

  const name = baseName(filePath);

  // 1. Rojo filename suffix (strongest). Handles plain *.client/*.server and the
  //    init.client / init.server forms (which also carry the suffix).
  if (CLIENT_SUFFIX.test(name)) {
    return { runContext: 'LocalScript', basis: 'filename' };
  }
  if (SERVER_SUFFIX.test(name)) {
    return { runContext: 'Script', basis: 'filename' };
  }
  if (INIT_MODULE.test(name)) {
    return { runContext: 'ModuleScript', basis: 'filename' };
  }

  // 2. Path / folder heuristic. Match any whole segment, LocalScript family
  //    first, then server, then module/shared.
  const segments = splitSegments(filePath).map((segment) => segment.toLowerCase());
  if (segments.some((segment) => LOCAL_SCRIPT_SEGMENTS.has(segment))) {
    return { runContext: 'LocalScript', basis: 'path' };
  }
  if (segments.some((segment) => SERVER_SCRIPT_SEGMENTS.has(segment))) {
    return { runContext: 'Script', basis: 'path' };
  }
  if (segments.some((segment) => MODULE_SCRIPT_SEGMENTS.has(segment))) {
    return { runContext: 'ModuleScript', basis: 'path' };
  }

  // 3. Weak signals: be honest rather than guess.
  return { runContext: 'Unknown', basis: 'none' };
}
