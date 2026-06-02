# Deployment Checklist

## Web/Vercel

- Run `npm run build`.
- Confirm `dist/index.html` contains current Open Graph/Twitter metadata.
- Confirm `/privacy/`, `/terms/`, `/billing/`, `/data-handling/`, and `/local-first/` build into `dist`.
- Confirm public download page points to the intended release source.
- Confirm serverless API environment variables are configured only in Vercel.

## Desktop

- Run `npm run build:desktop` on each target operating system.
- Confirm generated installer formats for the target release.
- Confirm updater artifacts are generated when intended.
- Confirm generated artifacts are not committed unless explicitly required.
- Confirm no developer-only `.env` files or local project data are packaged.

## Release Publication

- Draft GitHub release first.
- Attach verified desktop artifacts.
- Attach signed updater metadata only after signing is configured.
- Publish release notes after final smoke test.
- Update website/download links after the release exists.
