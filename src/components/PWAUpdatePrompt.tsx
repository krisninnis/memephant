import { usePWA } from '../hooks/usePWA';

export function PWAUpdatePrompt() {
  const {
    updateAvailable,
    updateReady,
    isApplyingUpdate,
    updateMessage,
    applyUpdate,
    dismissUpdate,
  } = usePWA();

  const canReload = updateAvailable && updateReady;

  if (!canReload && !updateMessage) return null;

  return (
    <div className="pwa-update-prompt" role="status" aria-live="polite">
      <div className="pwa-update-prompt__header">
        <div className="pwa-update-prompt__title">
          {canReload ? 'Update available' : 'Update notice'}
        </div>
        <button
          type="button"
          className="pwa-update-prompt__close"
          onClick={dismissUpdate}
          aria-label="Dismiss update prompt"
          disabled={isApplyingUpdate}
        >
          x
        </button>
      </div>
      <div className="pwa-update-prompt__body">
        {canReload
          ? 'A newer web/PWA build of Memephant is ready. This does not update the installed desktop app.'
          : 'Memephant checked for a web/PWA update. You can keep working.'}
      </div>
      {updateMessage ? <div className="pwa-update-prompt__body">{updateMessage}</div> : null}
      <div className="pwa-update-prompt__actions">
        {canReload && (
          <button
            type="button"
            onClick={applyUpdate}
            className="pwa-update-prompt__btn pwa-update-prompt__btn--primary"
            disabled={isApplyingUpdate}
          >
            {isApplyingUpdate ? 'Reloading...' : 'Reload now'}
          </button>
        )}
        <button
          type="button"
          onClick={dismissUpdate}
          className="pwa-update-prompt__btn pwa-update-prompt__btn--secondary"
          disabled={isApplyingUpdate}
        >
          {canReload ? 'Later' : 'Dismiss'}
        </button>
      </div>
    </div>
  );
}
