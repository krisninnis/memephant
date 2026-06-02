import posthog from "posthog-js";

export type AnalyticsEvent =
  | "landing_page_view"
  | "sign_up_started"
  | "sign_up_completed"
  | "sign_in_completed"
  | "project_created"
  | "project_imported"
  | "project_blueprint_created"
  | "context_passport_generated"
  | "context_passport_copied"
  | "launch_studio_opened"
  | "launch_passport_generated"
  | "build_update_generated"
  | "demo_project_opened";

let initialized = false;
let enabled = false;

type AnalyticsRuntimeEnv = Record<string, string | boolean | undefined>;

function getAnalyticsRuntimeEnv(): AnalyticsRuntimeEnv {
  const runtimeEnv = (
    globalThis as typeof globalThis & {
      __MEMPHANT_ENV__?: AnalyticsRuntimeEnv;
    }
  ).__MEMPHANT_ENV__;

  return runtimeEnv ?? {};
}

function isProductionRuntime(env: AnalyticsRuntimeEnv): boolean {
  return env.PROD === true || env.PROD === "true" || env.MODE === "production";
}

function isDesktopRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function isLocalHost(): boolean {
  if (typeof window === "undefined") return true;

  const host = window.location.hostname.toLowerCase();

  return (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost")
  );
}

function isProductionWebHost(): boolean {
  if (typeof window === "undefined") return false;

  const host = window.location.hostname.toLowerCase();

  return host === "memephant.com" || host.endsWith(".vercel.app");
}

export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;

  const env = getAnalyticsRuntimeEnv();
  const key = env.VITE_POSTHOG_KEY;

  const canRunAnalytics =
    Boolean(key) &&
    !isDesktopRuntime() &&
    !isLocalHost() &&
    (isProductionRuntime(env) || isProductionWebHost());

  if (!canRunAnalytics) {
    enabled = false;
    return;
  }

  posthog.init(String(key), {
    api_host: String(env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com"),
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
    person_profiles: "never",
  });

  enabled = true;
}

export function track(event: AnalyticsEvent): void {
  if (!enabled) return;
  posthog.capture(event);
}

export function isAnalyticsEnabled(): boolean {
  return enabled;
}
