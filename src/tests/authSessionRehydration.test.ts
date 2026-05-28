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
});
