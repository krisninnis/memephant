import { readFileSync } from 'fs';
import { join } from 'path';

describe('auth session rehydration contract', () => {
  const callbackHtml = readFileSync(
    join(process.cwd(), 'public/auth/callback.html'),
    'utf8',
  );
  const useTauriSync = readFileSync(
    join(process.cwd(), 'src/hooks/useTauriSync.ts'),
    'utf8',
  );
  const supabaseClient = readFileSync(
    join(process.cwd(), 'src/services/supabaseClient.ts'),
    'utf8',
  );
  const indexHtml = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
  const mainTsx = readFileSync(join(process.cwd(), 'src/main.tsx'), 'utf8');
  const runtimeEnvApi = readFileSync(join(process.cwd(), 'api/runtime-env.ts'), 'utf8');
  const runtimeEnv = readFileSync(
    join(process.cwd(), 'src/utils/runtimeEnv.ts'),
    'utf8',
  );
  const authCallbackUrl = readFileSync(
    join(process.cwd(), 'src/utils/authCallbackUrl.ts'),
    'utf8',
  );
  const settingsSync = readFileSync(
    join(process.cwd(), 'src/components/Settings/SettingsSync.tsx'),
    'utf8',
  );
  const cloudSync = readFileSync(
    join(process.cwd(), 'src/services/cloudSync.ts'),
    'utf8',
  );

  it('persists hash callback tokens into Supabase auth storage before returning to the app', () => {
    expect(callbackHtml).toContain('supabase.auth.setSession({');
    expect(callbackHtml).toContain('access_token: hashAccessToken');
    expect(callbackHtml).toContain('refresh_token: hashRefreshToken');
    expect(callbackHtml).toContain("window.location.assign('/')");
  });

  it('rehydrates the app from Supabase initial session events', () => {
    expect(useTauriSync).toContain('supabase.auth.onAuthStateChange');
    expect(useTauriSync).toContain("event === 'INITIAL_SESSION'");
    expect(useTauriSync).toContain("event === 'SIGNED_IN'");
    expect(useTauriSync).toContain('store.setCloudUser(incomingUser)');
  });

  it('creates the app Supabase client from the same runtime config path as the callback flow', () => {
    expect(runtimeEnv).toContain('window.__MEMPHANT_ENV__');
    expect(runtimeEnv).toContain('windowEnv.VITE_SUPABASE_URL ?? viteEnv.VITE_SUPABASE_URL');
    expect(runtimeEnvApi).toContain('process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL');
    expect(runtimeEnvApi).toContain('process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY');
    expect(indexHtml.indexOf('/api/runtime-env')).toBeGreaterThan(-1);
    expect(indexHtml.indexOf('/api/runtime-env')).toBeLessThan(
      indexHtml.indexOf('/src/main.tsx'),
    );
    expect(mainTsx).toContain('...(import.meta.env as Record<string, string | undefined>)');
    expect(mainTsx).toContain('__MEMPHANT_ENV__ ?? {}');
    expect(supabaseClient).toContain("import { getRuntimeEnv } from '../utils/runtimeEnv';");
    expect(supabaseClient).toContain('const supabaseEnv = getRuntimeEnv();');
    expect(supabaseClient).toContain('const url = supabaseEnv.VITE_SUPABASE_URL;');
    expect(supabaseClient).toContain('const key = supabaseEnv.VITE_SUPABASE_ANON_KEY;');
    expect(supabaseClient).not.toContain(
      'const url = import.meta.env.VITE_SUPABASE_URL',
    );
  });

  it('keeps OAuth redirects on the active production origin', () => {
    expect(authCallbackUrl).toContain('export function getCurrentWebOrigin()');
    expect(authCallbackUrl).toContain('window.location.origin');
    expect(authCallbackUrl).toContain("'__TAURI_INTERNALS__' in window");
    expect(authCallbackUrl).toContain("'tauri.localhost'");
    expect(authCallbackUrl).toContain('return `${trimTrailingSlash(currentOrigin)}/auth/callback`;');
    expect(authCallbackUrl).toContain('env.VITE_APP_URL || env.VITE_API_URL');
    expect(settingsSync).toContain("import { getAuthCallbackUrl } from '../../utils/authCallbackUrl';");
    expect(settingsSync).toContain('redirectTo: getAuthCallbackUrl()');
    expect(settingsSync).not.toContain('import.meta.env.VITE_APP_URL');
    expect(cloudSync).toContain("import { getAuthCallbackUrl } from '../utils/authCallbackUrl';");
    expect(cloudSync).toContain('const AUTH_CALLBACK_URL = getAuthCallbackUrl();');
  });

  it('serves runtime app URL from the request origin before deployment env fallbacks', () => {
    expect(runtimeEnvApi).toContain('function requestOrigin(req: VercelRequest): string');
    expect(runtimeEnvApi).toContain(
      'const appUrl = requestOrigin(req) || process.env.VITE_APP_URL || process.env.APP_URL || vercelUrl',
    );
    expect(runtimeEnvApi).toContain(
      'VITE_API_URL: requestOrigin(req) || process.env.VITE_API_URL || appUrl',
    );
  });
});
