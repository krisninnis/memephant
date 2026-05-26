# Privacy Review Checklist

Use this before major releases, store submissions, or changes to export/sync behavior.

## Local-First Defaults

- App can be used without signing in.
- Cloud backup remains off until the user chooses it.
- Crash reporting remains off until the user chooses it.
- Local AI remains off until the user chooses it.

## Export Boundaries

- Project exports do not include Personal Memory Vault contents unless explicitly designed and reviewed.
- Passport exports do not mutate stored project memory.
- Export transformations happen after generation and before copy/export only.
- Secret redaction and linked-folder path redaction tests pass.

## Cloud and Accounts

- Cloud sync paths redact obvious secrets before upload.
- Sign-in flows do not auto-upload local projects on account switch.
- Account deletion and disconnect flows remain available.
- Offline queue behavior is scoped to the signed-in user.

## Logs and Diagnostics

- Console logs do not include project content, secrets, full local paths, or private vault values.
- Crash reporting does not intentionally include project content.
- Any future telemetry has clear opt-in language and a visible off switch.

## Public Disclosures

- Privacy policy matches actual product behavior.
- Terms page does not make unsupported legal claims.
- Store disclosures match optional cloud, billing, update, and crash reporting flows.
