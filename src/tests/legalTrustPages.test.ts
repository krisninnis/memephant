import { readFileSync } from 'fs';
import { join } from 'path';

describe('legal and trust public pages', () => {
  const files = {
    privacy: readFileSync(join(process.cwd(), 'public/privacy/index.html'), 'utf8'),
    terms: readFileSync(join(process.cwd(), 'public/terms/index.html'), 'utf8'),
    billing: readFileSync(join(process.cwd(), 'public/billing/index.html'), 'utf8'),
    dataTrust: readFileSync(join(process.cwd(), 'public/data-handling/index.html'), 'utf8'),
    landing: readFileSync(join(process.cwd(), 'public/index.html'), 'utf8'),
    privacyMarkdown: readFileSync(join(process.cwd(), 'PRIVACY.md'), 'utf8'),
    securityMarkdown: readFileSync(join(process.cwd(), 'SECURITY.md'), 'utf8'),
  };

  const combined = Object.values(files).join('\n');

  it('documents the real optional services and local-first boundaries', () => {
    expect(files.privacy).toContain('stored locally');
    expect(files.privacy).toContain('Supabase');
    expect(files.privacy).toContain('Google OAuth');
    expect(files.privacy).toContain('Stripe');
    expect(files.privacy).toContain('optional crash reporting');
    expect(files.privacy).toContain('does not intentionally call hosted AI APIs');

    expect(files.dataTrust).toContain('Project context');
    expect(files.dataTrust).toContain('Cloud sync enabled');
    expect(files.dataTrust).toContain('Context Passport');
    expect(files.dataTrust).toContain('Nothing is sent to another AI unless you copy/paste it.');
  });

  it('has non-placeholder terms and billing pages', () => {
    expect(files.terms).toContain('Terms of Service');
    expect(files.terms).toContain('early-stage software');
    expect(files.terms).toContain('No professional advice');
    expect(files.billing).toContain('Refund / Billing Policy');
    expect(files.billing).toContain('free during early access');
    expect(files.billing).toContain('reviewed case by case');
    expect(files.terms).not.toContain('Draft placeholder');
    expect(files.terms).not.toContain('starter terms page');
  });

  it('links legal and trust pages from the landing footer', () => {
    expect(files.landing).toContain('href="/data-handling/"');
    expect(files.landing).toContain('href="/privacy/"');
    expect(files.landing).toContain('href="/terms/"');
    expect(files.landing).toContain('href="/billing/"');
  });

  it('avoids old overclaims in public legal copy', () => {
    expect(combined).not.toContain('Your secrets stay on your machine, always');
    expect(combined).not.toContain('before every single export');
    expect(combined).not.toContain('Your data never leaves your machine unless you explicitly enable cloud backup');
    expect(combined).not.toContain('No data leaves your machine unless you explicitly sign in and enable cloud backup');
    expect(combined).not.toContain('GDPR compliance');
    expect(combined).not.toContain('full GDPR');
  });
});
