# App Store Readiness Checklist

This checklist is for future Microsoft Store and Mac App Store preparation. Do not submit until each store-specific item has been reviewed.

## Shared Store Materials

- App name: Memephant
- Short description: local-first project memory for moving work between AI tools.
- Category: productivity/developer tools, subject to final store taxonomy.
- Support URL: `https://memephant.com/`
- Privacy URL: `https://memephant.com/privacy/`
- Terms URL: `https://memephant.com/terms/`
- Data handling URL: `https://memephant.com/data-handling/`
- Screenshots: prepare current desktop screenshots for each required size.
- Review notes: explain local-first storage, optional cloud backup, optional crash reporting, and no forced account.

## Microsoft Store

- Reserve/finalize package identity in Partner Center.
- Configure MSIX/AppX identity only after store identity exists.
- Configure Windows code signing.
- Verify installer behavior on a clean Windows machine.
- Complete privacy, data safety, age rating, and commerce disclosures.

## Mac App Store

- Finalize bundle identifier strategy before changing Tauri identifier.
- Configure Apple Developer Team ID and signing identity.
- Decide whether Mac App Store sandboxing is viable for linked-folder scanning.
- Prepare entitlements and notarization flow.
- Verify app permissions, file picker behavior, and updater policy against App Store rules.

## Standalone Installers

- Confirm code signing for Windows and macOS.
- Confirm notarization for macOS outside the Mac App Store.
- Confirm GitHub release metadata is signed for Tauri updater.
- Confirm rollback/manual download path remains available.
