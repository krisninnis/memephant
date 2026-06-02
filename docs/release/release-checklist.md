# Release Checklist

Use this before publishing any standalone desktop or web release.

## Versioning

- Confirm `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` have the same version.
- Confirm release notes match the final build.
- Confirm the release channel is `stable` unless intentionally preparing a beta.

## Build Validation

- Run `npm run release:check`.
- Run focused tests for any changed export, sync, privacy, update, or onboarding code.
- For desktop releases, run `npm run build:desktop` on the target OS.
- Smoke-test launch, project load, project edit, export copy, Settings, and update UI.

## Privacy Boundary

- Confirm cloud backup is still opt-in.
- Confirm crash reporting is still opt-in and default-off.
- Confirm Personal Memory Vault is not included in project exports.
- Confirm linked-folder paths are redacted from exported text.
- Confirm secret scanner tests pass.

## Packaging

- Confirm icons render correctly in installer, taskbar/dock, and app switcher.
- Confirm installer name and app name use `Memephant`.
- Confirm generated artifacts are stored under the release folder or GitHub release draft.
- Confirm no `.env`, local project data, debug output, or `src-tauri/target` content is shipped unexpectedly.

## Final Human Checks

- Review public privacy, terms, billing, data-handling, and local-first pages.
- Review screenshots and product copy for accurate claims.
- Review known limitations and support contact.
- Tag the release only after artifacts have been verified.
