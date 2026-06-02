/**
 * Serves public runtime configuration for the static web app.
 *
 * The Supabase anon key is intentionally public client config. Do not add
 * service-role keys, signing secrets, or private API tokens here.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

type RuntimeEnv = {
  VITE_APP_URL?: string;
  VITE_API_URL?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_SENTRY_DSN?: string;
};

function requestOrigin(req: VercelRequest): string {
  const forwardedHost = Array.isArray(req.headers['x-forwarded-host'])
    ? req.headers['x-forwarded-host'][0]
    : req.headers['x-forwarded-host'];
  const hostHeader = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;
  const host = forwardedHost || hostHeader || '';
  if (!host) return '';

  const forwardedProto = Array.isArray(req.headers['x-forwarded-proto'])
    ? req.headers['x-forwarded-proto'][0]
    : req.headers['x-forwarded-proto'];
  const protocol = forwardedProto || (host.includes('localhost') ? 'http' : 'https');

  return `${protocol}://${host}`;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';
  const appUrl = requestOrigin(req) || process.env.VITE_APP_URL || process.env.APP_URL || vercelUrl;

  const runtimeEnv: RuntimeEnv = {
    VITE_APP_URL: appUrl,
    VITE_API_URL: requestOrigin(req) || process.env.VITE_API_URL || appUrl,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    VITE_SUPABASE_ANON_KEY:
      process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '',
    VITE_SENTRY_DSN: process.env.VITE_SENTRY_DSN ?? '',
  };

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(
    `window.__MEMPHANT_ENV__ = Object.assign({}, window.__MEMPHANT_ENV__ || {}, ${JSON.stringify(runtimeEnv)});`,
  );
}
