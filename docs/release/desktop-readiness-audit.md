# Memephant Desktop Readiness Audit

Last updated: May 2026

This is a preparation audit only. It does not approve, submit, notarize, or publish Memephant to any app store.

## Current App Metadata

- Product name: `Memephant`
- npm package: `memephant-desktop`
- App version: `0.2.23` in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`
- Tauri identifier: `com.kris.memephant-desktop`
- Tauri frontend output: `../dist`
- Desktop window title: `Memephant`
- Public web domain: `https://memephant.com`

## Build and Installer Status

- Tauri v2 is configured and `bundle.active` is enabled.
- Bundle targets are currently `all`.
- Updater artifacts are enabled with `createUpdaterArtifacts: true`.
- Icons exist for Windows, macOS, iOS, Android, and generic PNG/ICO/ICNS outputs.
- A desktop build script now exists as `npm run build:desktop`.
- A release validation script now exists as `npm run release:check`.

## Updater Readiness

- The Tauri updater plugin is present in npm and Cargo dependencies.
- The default capability grants `updater:default`.
- Update UI exists in Settings > About.
- The updater endpoint points at GitHub release metadata.
- Auto-install is not enabled. User-controlled check/install/restart remains the current behavior.

## Signing and Store Readiness Gaps

- Windows code signing certificate is not configured.
- Apple Developer Team ID, signing identity, entitlements, and notarization credentials are not configured.
- Microsoft Store Partner Center packaging and identity are not configured.
- Mac App Store-specific sandbox entitlements are not configured.
- Store screenshots, age rating inputs, review notes, support URL, and final legal review remain future work.

## Permissions and Local Storage

- Tauri capabilities currently allow core, opener, dialog, and updater access for the main window.
- Project storage uses the OS application data directory under a `projects` folder.
- Linked-folder scanning uses allowlists and redaction safeguards documented in `docs/folder-watcher-*`.
- Cloud backup remains opt-in. Local-first behavior is preserved.

## Production Env Handling

- Web/backend environment variables are used for optional Supabase, Stripe, API, and Sentry flows.
- Client-visible variables use `VITE_` prefixes.
- Server-only Stripe/Supabase service role keys are referenced only in API routes.
- No new telemetry or cloud dependency was added in this readiness pass.

## Security and Privacy Observations

- Export secret redaction and linked-folder path redaction have focused tests.
- Personal Memory Vault and Passport boundaries have focused tests.
- Crash reporting is opt-in and default-off, but legal/security wording must stay aligned with that behavior.
- Noisy cloud sync and webhook diagnostics have been reduced or gated behind development/debug logging.
- Before store submission, complete one final production-console pass across updater, desktop actions, and support flows.

## Production-Ready Already

- Local-first project storage model.
- User-controlled copy/export flow.
- Secret/path redaction tests around major export surfaces.
- Tauri bundle configuration and icon set.
- Manual desktop update UI and updater plugin wiring.
- Public web presence and static privacy/terms/data-handling pages.

## Should Wait Until Real Store Submission

- Paid store developer account setup.
- Code signing certificates and notarization credentials.
- Store-specific package identifiers, categories, screenshots, review notes, and age ratings.
- Auto-update channel rollout and staged release automation.
- Final legal terms review.
