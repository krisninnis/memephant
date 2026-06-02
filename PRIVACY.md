# Privacy Policy - Memephant

**Last updated: June 2026**

This is a plain-English summary for an early beta product. It is not legal advice.

## The short version

Memephant is designed to be local-first. By default, project memory starts on your device and core handoff features can be used without an account.

Data may leave your device when you choose optional or network-backed flows, including Cloud Backup, Supabase Auth, Google OAuth, Stripe billing, update emails, optional crash reporting, Social Bridge composer links, or copying/pasting an export into another service.

## What Memephant stores locally

Memephant stores the project data you put into the app, including project names, summaries, goals, decisions, notes, linked-folder metadata, checkpoints, Project Blueprint data, Launch Studio fields, and other structured project memory.

Desktop data is stored in the operating system application data folder. Web/PWA data may be stored in browser storage for the active origin. Local settings may include privacy preferences, platform preferences, and Supabase auth session data after sign-in.

## What may be stored in Supabase

Supabase is used for optional account, auth, sync, subscription lookup, account deletion, and update-email flows.

If Cloud Backup is enabled, project data is saved to Supabase and associated with the signed-in user. Cloud sync attempts to redact obvious local paths and secrets before upload, but you should still avoid storing secrets in project memory.

If you submit the landing-page email update form, the email address is stored in Supabase for update notifications.

## What Stripe handles

Stripe is integrated for hosted checkout, customer portal, subscription webhooks, invoices, and payment method handling where paid plans are available. Memephant does not intentionally store full card details.

## What Google OAuth / Supabase Auth handles

If you sign in with Google, the OAuth flow is handled by Google and Supabase Auth. Memephant receives the authenticated Supabase session and basic account details needed to sign you in, such as a user ID and email address.

## AI processing

Memephant does not intentionally call hosted AI APIs for the core Context Passport, Launch Studio, Build Update, Daily Content Pack, or Project Blueprint features. Exports are generated locally and copied only when you choose.

Optional Local AI/Private Mode may call a local Ollama endpoint you configure on your device.

## Crash reporting and telemetry

Memephant does not use product analytics or ad-tracking code in the core app. Crash reporting is optional, disabled by default, and controlled in Settings. The crash-reporting path is designed to strip user-authored content where possible, but leave it disabled if you do not want diagnostics sent to a third-party crash reporting provider.

## Your control

- You can use core Memephant features without signing in.
- You can download your local data from the app.
- You can delete local project data from the app.
- You can disconnect Cloud Backup if you enabled it.
- You can request cloud account deletion from the app where available.

## Contact

Privacy, access, deletion, or billing questions can be sent to hello@memephant.com.
