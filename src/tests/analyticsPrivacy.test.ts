import { readFileSync } from "fs";
import { join } from "path";

describe("analytics privacy contract", () => {
  const analyticsSource = readFileSync(
    join(process.cwd(), "src/lib/analytics.ts"),
    "utf8",
  );
  const mainSource = readFileSync(join(process.cwd(), "src/main.tsx"), "utf8");

  it("keeps tracking event-name-only with no payload parameter", () => {
    expect(analyticsSource).toContain(
      "export function track(event: AnalyticsEvent): void",
    );
    expect(analyticsSource).toContain("posthog.capture(event);");
    expect(analyticsSource).not.toContain("properties");
    expect(analyticsSource).not.toContain("distinctId");
    expect(analyticsSource).not.toContain("identify(");
  });

  it("disables passive PostHog collection features", () => {
    expect(analyticsSource).toContain("autocapture: false");
    expect(analyticsSource).toContain("capture_pageview: false");
    expect(analyticsSource).toContain("capture_pageleave: false");
    expect(analyticsSource).toContain("disable_session_recording: true");
    expect(analyticsSource).toContain("disable_surveys: true");
    expect(analyticsSource).toContain('person_profiles: "never"');
  });

  it("guards analytics to production web with a configured key", () => {
    expect(analyticsSource).toContain("Boolean(key)");
    expect(analyticsSource).toContain("!isDesktopRuntime()");
    expect(analyticsSource).toContain("!isLocalHost()");
    expect(analyticsSource).toContain(
      "isProductionRuntime(env) || isProductionWebHost()",
    );
  });

  it("allows the production web host fallback when runtime PROD flags are missing", () => {
    expect(analyticsSource).toContain(
      "function isProductionWebHost(): boolean",
    );
    expect(analyticsSource).toContain('host === "memephant.com"');
    expect(analyticsSource).toContain('host.endsWith(".vercel.app")');
  });

  it("fires the first anonymous landing event from app bootstrap", () => {
    expect(mainSource).toContain('import { initAnalytics, track } from "./lib/analytics";');
    expect(mainSource).toContain("initAnalytics();");
    expect(mainSource).toContain('track("landing_page_view");');
  });
});
