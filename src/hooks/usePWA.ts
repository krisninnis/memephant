import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

export interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  updateAvailable: boolean;
  updateReady: boolean;
  isChecking: boolean;
  isApplyingUpdate: boolean;
  lastChecked: Date | null;
  updateMessage: string | null;
  install: () => Promise<void>;
  checkForUpdates: () => Promise<boolean>;
  applyUpdate: () => Promise<void>;
  dismissUpdate: () => void;
}

function getIsInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

const PWAContext = createContext<PWAState | null>(null);

export function PWAProvider({ children }: { children: ReactNode }) {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(getIsInstalled);
  const [isChecking, setIsChecking] = useState(false);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const updateIntervalRef = useRef<number | null>(null);
  const updateDismissedForSessionRef = useRef(false);

  const {
    needRefresh: [updateAvailable, setUpdateAvailable],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() {
      if (updateDismissedForSessionRef.current) {
        setUpdateReady(false);
        setUpdateAvailable(false);
        setUpdateMessage(null);
        return;
      }

      const ready = Boolean(registrationRef.current?.waiting);
      setUpdateReady(ready);

      if (ready) {
        setUpdateMessage(null);
        return;
      }

      setUpdateAvailable(false);
      setUpdateMessage('A web update was found, but it is not ready to reload yet. You can keep working.');
    },
    onOfflineReady() {},
    onRegisteredSW(_swUrl, registration) {
      registrationRef.current = registration || null;

      if (isTauri() || !registration) return;

      if (updateIntervalRef.current) {
        window.clearInterval(updateIntervalRef.current);
      }

      window.setTimeout(() => {
        void registration.update().then(
          () => setLastChecked(new Date()),
          (error) => console.error('[PWA] Startup update check failed:', error),
        );
      }, 1500);

      updateIntervalRef.current = window.setInterval(() => {
        void registration.update().then(
          () => setLastChecked(new Date()),
          (error) => console.error('[PWA] Periodic update check failed:', error),
        );
      }, 60 * 60 * 1000);
    },
    onRegisterError(error) {
      console.error('[PWA] Registration error:', error);
    },
  });

  useEffect(() => {
    if (!updateAvailable) {
      return;
    }

    if (updateDismissedForSessionRef.current) {
      setUpdateReady(false);
      setUpdateAvailable(false);
      setUpdateMessage(null);
      return;
    }

    const ready = Boolean(registrationRef.current?.waiting);
    setUpdateReady(ready);

    if (!ready) {
      setUpdateAvailable(false);
      setUpdateMessage('A web update was found, but it is not ready to reload yet. You can keep working.');
    }
  }, [updateAvailable]);

  useEffect(() => {
    if (typeof window === 'undefined' || isTauri()) return;

    const handleBeforeInstall = (event: Event) => {
      const e = event as BeforeInstallPromptEvent;
      e.preventDefault();
      deferredPromptRef.current = e;
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      deferredPromptRef.current = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(display-mode: standalone)');

    const syncInstalledState = () => {
      setIsInstalled(getIsInstalled());
    };

    syncInstalledState();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncInstalledState);
      return () => mediaQuery.removeEventListener('change', syncInstalledState);
    }

    mediaQuery.addListener(syncInstalledState);
    return () => mediaQuery.removeListener(syncInstalledState);
  }, []);

  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) {
        window.clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPromptRef.current || isTauri()) return;

    await deferredPromptRef.current.prompt();
    const { outcome } = await deferredPromptRef.current.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
    }

    deferredPromptRef.current = null;
  }, []);

  const checkForUpdates = useCallback(async (): Promise<boolean> => {
    const registration = registrationRef.current;
    if (isTauri() || !registration) return false;

    setIsChecking(true);

    try {
      await registration.update();
      setLastChecked(new Date());

      await new Promise((resolve) => window.setTimeout(resolve, 1200));

      const ready = Boolean(registration.waiting);
      setUpdateReady(ready);
      setUpdateAvailable(ready);
      if (ready) {
        updateDismissedForSessionRef.current = false;
        setUpdateMessage(null);
      }

      return ready;
    } catch (err) {
      console.error('[PWA] Update check failed:', err);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    if (isTauri()) {
      console.warn('[PWA] applyUpdate ignored in Tauri environment');
      setIsApplyingUpdate(false);
      setUpdateReady(false);
      setUpdateAvailable(false);
      setUpdateMessage('Web updates apply when the web app reloads.');
      return;
    }

    const registration = registrationRef.current;

    if (!registration) {
      console.warn('[PWA] applyUpdate aborted: no service worker registration');
      setIsApplyingUpdate(false);
      setUpdateReady(false);
      setUpdateAvailable(false);
      setUpdateMessage('The web update is not ready to reload yet. You can keep working and try again later.');
      return;
    }

    const waitingWorker = registration.waiting;

    if (!waitingWorker) {
      console.warn('[PWA] applyUpdate aborted: no waiting worker');
      setIsApplyingUpdate(false);
      setUpdateReady(false);
      setUpdateAvailable(false);
      setUpdateMessage('The web update is not ready to reload yet. You can keep working and try again later.');
      return;
    }

    setIsApplyingUpdate(true);
    setUpdateReady(true);
    setUpdateMessage(null);

    let controllerChangeTimeout: number | undefined;

    const handleControllerChange = () => {
      if (controllerChangeTimeout !== undefined) {
        window.clearTimeout(controllerChangeTimeout);
      }
      window.location.reload();
    };

    try {
      controllerChangeTimeout = window.setTimeout(() => {
        console.warn('[PWA] controllerchange timeout while applying update');
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        setIsApplyingUpdate(false);
        setUpdateReady(false);
        setUpdateAvailable(false);
        updateDismissedForSessionRef.current = true;
        setUpdateMessage('The update is still finishing. You can keep working and reload later.');
      }, 5000);

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, {
        once: true,
      });

      await updateServiceWorker(true);

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    } catch (error) {
      console.error('[PWA] applyUpdate failed:', error);
      if (controllerChangeTimeout !== undefined) {
        window.clearTimeout(controllerChangeTimeout);
      }
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      setUpdateReady(false);
      setUpdateAvailable(false);
      setUpdateMessage('The web update could not be applied. You can dismiss this and keep working.');
      setIsApplyingUpdate(false);
    }
  }, [setUpdateAvailable, updateServiceWorker]);

  const dismissUpdate = useCallback(() => {
    updateDismissedForSessionRef.current = true;
    setUpdateMessage(null);
    setIsApplyingUpdate(false);
    setUpdateReady(false);
    setUpdateAvailable(false);
  }, [setUpdateAvailable]);

  const value = useMemo<PWAState>(
    () => ({
      isInstallable,
      isInstalled,
      updateAvailable,
      updateReady,
      isChecking,
      isApplyingUpdate,
      lastChecked,
      updateMessage,
      install,
      checkForUpdates,
      applyUpdate,
      dismissUpdate,
    }),
    [
      isInstallable,
      isInstalled,
      updateAvailable,
      updateReady,
      isChecking,
      isApplyingUpdate,
      lastChecked,
      updateMessage,
      install,
      checkForUpdates,
      applyUpdate,
      dismissUpdate,
    ],
  );

  return createElement(PWAContext.Provider, { value }, children);
}

export function usePWA(): PWAState {
  const context = useContext(PWAContext);

  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider');
  }

  return context;
}
