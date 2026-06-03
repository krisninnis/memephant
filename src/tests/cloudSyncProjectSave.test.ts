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

  it('keeps signed-out local saves from attempting cloud push', () => {
    expect(tauriActionsSource).toContain(
      'if (!latestStore.cloudUser || latestStore.cloudDisconnecting || !latestStore.settings.privacy.cloudSyncEnabled)',
    );
    expect(tauriActionsSource.indexOf('browserStore.save(localProject.id, data)')).toBeLessThan(
      tauriActionsSource.indexOf('setTimeout(() => {'),
    );
  });
});
