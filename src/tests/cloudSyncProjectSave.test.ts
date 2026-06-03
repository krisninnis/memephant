import { readFileSync } from 'fs';
import { join } from 'path';

describe('cloud project save auth path', () => {
  const cloudSyncSource = readFileSync(
    join(process.cwd(), 'src/services/cloudSync.ts'),
    'utf8',
  );
  const tauriActionsSource = readFileSync(
    join(process.cwd(), 'src/services/tauriActions.ts'),
    'utf8',
  );

  it('does not scrape browser storage for Supabase write tokens', () => {
    expect(cloudSyncSource).not.toContain('getCachedSupabaseAccessToken');
    expect(cloudSyncSource).not.toContain('currentSession?: { access_token?: unknown }');
    expect(cloudSyncSource).not.toContain('session?: { access_token?: unknown }');
    expect(cloudSyncSource).not.toContain('looksLikeSupabaseAuthKey');
  });

  it('requires the active Supabase session before autosave upsert', () => {
    expect(cloudSyncSource).toContain('async function getAuthenticatedWriteSession');
    expect(cloudSyncSource).toContain('supabase.auth.getSession()');
    expect(cloudSyncSource).toContain('write_session_user_mismatch');
    expect(cloudSyncSource).toContain('user_id: userId');
    expect(cloudSyncSource).toContain('writeSession.accessToken');
  });

  it('keeps cloud-disabled saves local without showing pending sync', () => {
    expect(tauriActionsSource).toContain('if (!latestStore.settings.privacy.cloudSyncEnabled)');
    expect(tauriActionsSource).toContain("latestStore.setSyncStatus('saved_local');");
    expect(tauriActionsSource.indexOf('browserStore.save(localProject.id, data)')).toBeLessThan(
      tauriActionsSource.indexOf('setTimeout(() => {'),
    );
  });

  it('attempts cloud push when sync is enabled even if store cloud user has not hydrated', () => {
    expect(tauriActionsSource).not.toContain('if (!latestStore.cloudUser ||');
    expect(tauriActionsSource).toContain(
      'const result = await pushProject(localProject, latestStore.cloudUser?.id);',
    );
  });
});
