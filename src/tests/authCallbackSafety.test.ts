import { readFileSync } from 'fs';
import { join } from 'path';

describe('auth callback safety', () => {
  const callbackHtml = readFileSync(
    join(process.cwd(), 'public/auth/callback.html'),
    'utf8',
  );
  const serviceWorker = readFileSync(
    join(process.cwd(), 'public/sw.js'),
    'utf8',
  );
  const viteConfig = readFileSync(
    join(process.cwd(), 'vite.config.ts'),
    'utf8',
  );

  it('does not include placeholder Supabase credentials', () => {
    expect(callbackHtml).not.toContain(`your_project.${'supabase.co'}`);
    expect(callbackHtml).not.toContain(`YOUR_PROJECT.${'supabase.co'}`);
    expect(callbackHtml).not.toContain(`YOUR_${'ANON_KEY'}`);
  });

  it('clears OAuth hash fragments before auth callback work can log errors', () => {
    expect(callbackHtml).toContain('function clearSensitiveHash()');
    expect(callbackHtml).toContain('window.location.pathname + window.location.search');
    expect(callbackHtml.indexOf('clearSensitiveHash();')).toBeLessThan(
      callbackHtml.indexOf('window.supabase.createClient'),
    );
  });

  it('does not log full callback URLs or token fragments', () => {
    expect(callbackHtml).not.toContain(`console.log(window.${'location'}`);
    expect(callbackHtml).not.toContain('window.location.href');
    expect(callbackHtml).not.toContain('console.error(\'[Memephant] Auth callback error:\', err)');
    expect(callbackHtml).toContain("access_token=[redacted]");
    expect(callbackHtml).toContain("refresh_token=[redacted]");
    expect(callbackHtml).toContain("provider_token=[redacted]");
  });

  it('prevents service worker caching for auth callback routes', () => {
    expect(serviceWorker).toContain("const CACHE_NAME = 'memephant-v3'");
    expect(serviceWorker).toContain("url.pathname === '/auth/callback'");
    expect(serviceWorker).toContain("url.pathname === '/api/auth-callback'");
    expect(serviceWorker).toContain("fetch(request, { cache: 'no-store' })");
    expect(viteConfig).toContain('globIgnores: ["auth/callback.html"]');
    expect(viteConfig).toContain('navigateFallbackDenylist');
  });
});
