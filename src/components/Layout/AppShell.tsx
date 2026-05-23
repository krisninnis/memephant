import { useState } from 'react';
import { useTauriSync } from '../../hooks/useTauriSync';
import { useProjectStore } from '../../store/projectStore';
import { useActiveProject } from '../../hooks/useActiveProject';
import Sidebar from '../Sidebar/Sidebar';
import ActionBar from '../Workspace/ActionBar';
import WorkflowGuide from '../Workspace/WorkflowGuide';
import PasteZone from '../Workspace/PasteZone';
import ProjectEditor from '../Editor/ProjectEditor';
import TrustFooter from './TrustFooter';
import Toast from './Toast';
import WelcomeScreen from './WelcomeScreen';
import SettingsPage from '../Settings/SettingsPage';
import SettingsMemoryVault from '../Settings/SettingsMemoryVault';
import TourOverlay from '../Tour/TourOverlay';
import { CommandPalette } from '../CommandPalette/CommandPalette';
import { PWAInstallButton } from '../PWAInstallButton';
import { PassportPage } from '../../features/passport/components/PassportPage';

export function AppShell() {
  useTauriSync();

  const isLoading = useProjectStore((s) => s.isLoading);
  const currentView = useProjectStore((s) => s.currentView);
  const setCurrentView = useProjectStore((s) => s.setCurrentView);
  const projects = useProjectStore((s) => s.projects);
  const activeProject = useActiveProject();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="app-shell app-shell--loading">
        <p className="app-shell__loading-text">Loading projects...</p>
      </div>
    );
  }

  const showWelcome = projects.length === 0;

  const closeMobileDrawer = () => setMobileDrawerOpen(false);

  const openProjectsDrawer = () => {
    setCurrentView('projects');
    setMobileDrawerOpen(true);
  };

  const openSearch = () => {
    window.dispatchEvent(new Event('memephant:open-search'));
  };

  async function handleShare() {
    const shareData = {
      title: 'Memephant',
      text: 'Move your project context between AI tools without rebuilding it every time.',
      url: 'https://memephant.com',
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText('https://memephant.com');
      alert('Memephant link copied to clipboard');
    } catch (error) {
      console.error('Share failed', error);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Sidebar onNavigate={closeMobileDrawer} />
      </aside>

      {mobileDrawerOpen && (
        <div className="mobile-drawer-overlay" onClick={closeMobileDrawer}>
          <div className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <Sidebar onNavigate={closeMobileDrawer} />
          </div>
        </div>
      )}

      <main className="workspace">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            padding: '0.9rem 1rem 0',
            flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            marginBottom: '0.75rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
            }}
          >
            <img
              src="/icons/source-elephant-1024.png"
              alt="Memephant"
              style={{
                width: '42px',
                height: '42px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 10px rgba(245,158,11,0.18))',
              }}
            />

            <div>
              <div
                style={{
                  color: '#f8fafc',
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                }}
              >
                Memephant
              </div>

              <div
                style={{
                  color: '#94a3b8',
                  fontSize: '0.78rem',
                  marginTop: '0.2rem',
                }}
              >
                Your AI context, ready for any AI.
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <button
              type="button"
              onClick={handleShare}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.7rem 0.95rem',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
                color: '#cbd5e1',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
            >
              <span aria-hidden="true">↗</span>
              <span>Share</span>
            </button>

            <button
              type="button"
              className="app-search-button"
              onClick={openSearch}
              aria-label="Search Memephant"
              title="Search Memephant (Ctrl+K / Cmd+K)"
            >
              <span aria-hidden="true">⌕</span>
              <span>Search</span>
            </button>

            <PWAInstallButton variant="header" />
          </div>
        </div>

        {currentView === 'settings' ? (
          <SettingsPage />
        ) : currentView === 'memory-vault' ? (
          <div className="workspace-scroll workspace-scroll--memory-vault">
            <div className="workspace-main workspace-main--memory-vault">
              <SettingsMemoryVault />
            </div>
            <TrustFooter />
          </div>
        ) : currentView === 'passport' ? (
          <PassportPage />
        ) : showWelcome ? (
          <WelcomeScreen />
        ) : (
          <div className="workspace-scroll">
            <ActionBar />

            <div className="workspace-main">
              {activeProject && <WorkflowGuide />}

              <PasteZone />

              {activeProject ? (
                <ProjectEditor />
              ) : (
                <div className="workspace-hint">
                  <p>Select a project from the sidebar to get started.</p>
                </div>
              )}
            </div>

            <TrustFooter />
          </div>
        )}
      </main>

      <div className="mobile-bottom-bar">
        <button
          type="button"
          className={`mobile-bottom-bar__btn${mobileDrawerOpen ? ' mobile-bottom-bar__btn--active' : ''}`}
          onClick={() => setMobileDrawerOpen((open) => !open)}
        >
          <span className="mobile-bottom-bar__icon" aria-hidden="true">
            📁
          </span>

          <span className="mobile-bottom-bar__label">
            Projects{projects.length > 0 ? ` (${projects.length})` : ''}
          </span>
        </button>

        <button
          type="button"
          className={`mobile-bottom-bar__btn${currentView === 'settings' ? ' mobile-bottom-bar__btn--active' : ''}`}
          onClick={() => {
            setCurrentView('settings');
            closeMobileDrawer();
          }}
        >
          <span className="mobile-bottom-bar__icon" aria-hidden="true">
            ⚙️
          </span>

          <span className="mobile-bottom-bar__label">Settings</span>
        </button>

        <button
          type="button"
          className={`mobile-bottom-bar__btn${currentView === 'memory-vault' ? ' mobile-bottom-bar__btn--active' : ''}`}
          onClick={() => {
            setCurrentView('memory-vault');
            closeMobileDrawer();
          }}
        >
          <span className="mobile-bottom-bar__icon" aria-hidden="true">
            V
          </span>

          <span className="mobile-bottom-bar__label">Vault</span>
        </button>

        <button
          type="button"
          className={`mobile-bottom-bar__btn${currentView === 'projects' && !mobileDrawerOpen ? ' mobile-bottom-bar__btn--active' : ''}`}
          onClick={() => {
            setCurrentView('projects');
            closeMobileDrawer();
          }}
        >
          <span className="mobile-bottom-bar__icon" aria-hidden="true">
            🐘
          </span>

          <span className="mobile-bottom-bar__label">Workspace</span>
        </button>
      </div>

      {(currentView === 'settings' ||
        currentView === 'memory-vault' ||
        currentView === 'passport') && (
        <button
          type="button"
          className="mobile-projects-fab"
          onClick={openProjectsDrawer}
          aria-label="Open projects"
          title="Open projects"
        >
          <span aria-hidden="true">📁</span>
        </button>
      )}

      <Toast />
      <TourOverlay />
      <CommandPalette />
    </div>
  );
}

export default AppShell;
