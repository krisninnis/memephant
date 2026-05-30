import { useState } from 'react';
import { useActiveProject } from '../../hooks/useActiveProject';
import { LaunchPassportModal } from '../Workspace/LaunchPassportModal';
import { BuildUpdateModal } from '../Workspace/BuildUpdateModal';
import { ContentReadinessModal } from './ContentReadinessModal';
import { DailyContentPackModal } from './DailyContentPackModal';

type LaunchStudioPage = 'clarity' | 'launch' | 'postToday' | 'share';

const LAUNCH_STUDIO_PAGES: Array<{
  id: LaunchStudioPage;
  label: string;
  question: string;
}> = [
  {
    id: 'clarity',
    label: 'Project Clarity',
    question: 'Is this project clear enough to explain publicly?',
  },
  {
    id: 'launch',
    label: 'Launch Kit',
    question: 'How do I launch this project?',
  },
  {
    id: 'postToday',
    label: 'Post Today',
    question: 'What can I post today?',
  },
  {
    id: 'share',
    label: 'Share',
    question: 'Where do I post this?',
  },
];

export function LaunchStudio() {
  const activeProject = useActiveProject();
  const [activePage, setActivePage] = useState<LaunchStudioPage>('clarity');
  const [launchPassportOpen, setLaunchPassportOpen] = useState(false);
  const [buildUpdateOpen, setBuildUpdateOpen] = useState(false);
  const [dailyContentPackOpen, setDailyContentPackOpen] = useState(false);
  const [contentReadinessOpen, setContentReadinessOpen] = useState(false);

  const activePageConfig = LAUNCH_STUDIO_PAGES.find((page) => page.id === activePage) ?? LAUNCH_STUDIO_PAGES[0]!;

  return (
    <div className="workspace-scroll">
      <main className="launch-studio" aria-labelledby="launch-studio-title">
        <header className="launch-studio__header">
          <div>
            <p className="launch-studio__eyebrow">Launch and distribution</p>
            <h1 id="launch-studio-title">Launch Studio</h1>
            <p>
              Turn project context into clear public communication without making
              Memephant a social scheduler.
            </p>
          </div>
          {activeProject && (
            <span className="launch-studio__project">
              Project: {activeProject.name}
            </span>
          )}
        </header>

        {!activeProject ? (
          <section className="launch-studio__empty" aria-label="Launch Studio empty state">
            <h2>Open a project first</h2>
            <p>
              Launch Studio uses the current project context, so it needs an active
              project before it can generate public-facing drafts.
            </p>
          </section>
        ) : (
          <div className="launch-studio-workspace" aria-label="Launch Studio workflow">
            <nav className="launch-studio-tabs" aria-label="Launch Studio sections">
              {LAUNCH_STUDIO_PAGES.map((page) => (
                <button
                  type="button"
                  key={page.id}
                  className={`launch-studio-tab${activePage === page.id ? ' launch-studio-tab--active' : ''}`}
                  aria-current={activePage === page.id ? 'page' : undefined}
                  onClick={() => setActivePage(page.id)}
                >
                  <span>{page.label}</span>
                  <small>{page.question}</small>
                </button>
              ))}
            </nav>

            <section
              className="launch-studio-page"
              aria-labelledby={`launch-studio-page-${activePage}`}
            >
              <div className="launch-studio-page__header">
                <p className="launch-studio-page__eyebrow">Launch Studio</p>
                <h2 id={`launch-studio-page-${activePage}`}>{activePageConfig.label}</h2>
                <p>{activePageConfig.question}</p>
              </div>

              {activePage === 'clarity' && (
              <article className="launch-studio-card">
                <div>
                  <h3>Project Clarity</h3>
                  <p>
                    Check whether the project has enough plain context to generate useful
                    launch and social content before you create anything public.
                  </p>
                </div>
                <button
                  type="button"
                  className="content-readiness-btn"
                  onClick={() => setContentReadinessOpen(true)}
                  title="Evaluate project clarity from local project context"
                >
                  <span>Check Project Clarity</span>
                  <small>Score, weak areas, missing basics, suggestions</small>
                </button>
              </article>
              )}

              {activePage === 'launch' && (
                <article className="launch-studio-card">
                  <div>
                    <h3>Launch Kit</h3>
                    <p>
                      Create launch posts, a founder story, demo outline, screenshot
                      checklist, and feedback request from this project.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="launch-passport-btn"
                    onClick={() => setLaunchPassportOpen(true)}
                    title="Generate launch copy and checklist assets from this project context"
                  >
                    <span>Generate Launch Kit</span>
                    <small>How do I launch this project?</small>
                  </button>
                </article>
              )}

              {activePage === 'postToday' && (
              <div className="launch-studio__grid launch-studio__grid--post-today" aria-label="Post Today generators">
                <article className="launch-studio-card launch-studio-card--primary">
                  <div>
                    <h3>Post Today</h3>
                    <p>
                      Generate X, LinkedIn, Reddit, founder reflection, demo caption,
                      feedback question, and what-shipped-today drafts.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="daily-content-pack-btn"
                    onClick={() => setDailyContentPackOpen(true)}
                    title="Generate today's copy-ready social ideas from this project context"
                  >
                    <span>Generate Post Today</span>
                    <small>What can I post today?</small>
                  </button>
                </article>

                <article className="launch-studio-card">
                  <div>
                    <h3>Build Update</h3>
                    <p>
                      Draft progress posts, release notes, feedback asks, and short
                      update captions. This will merge into Post Today later.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="build-update-btn"
                    onClick={() => setBuildUpdateOpen(true)}
                    title="Generate progress posts and release updates from this project context"
                  >
                    <span>Generate Build Update</span>
                    <small>What did I ship or improve recently?</small>
                  </button>
                </article>
              </div>
              )}

              {activePage === 'share' && (
              <article className="launch-studio-card launch-studio-card--info">
                <div>
                  <h3>Share safely</h3>
                  <p>
                    Open generated content in X, LinkedIn, Reddit, or Facebook for
                    manual review. Memephant never posts automatically.
                  </p>
                </div>
                <div className="social-bridge-card-note">
                  <p>Generate a Launch Kit or Post Today draft first.</p>
                  <p>Share buttons stay beside generated sections, not on this page.</p>
                </div>
              </article>
              )}
            </section>
          </div>
        )}
      </main>

      {launchPassportOpen && activeProject && (
        <LaunchPassportModal
          project={activeProject}
          onClose={() => setLaunchPassportOpen(false)}
        />
      )}

      {contentReadinessOpen && activeProject && (
        <ContentReadinessModal
          project={activeProject}
          onClose={() => setContentReadinessOpen(false)}
        />
      )}

      {buildUpdateOpen && activeProject && (
        <BuildUpdateModal
          project={activeProject}
          onClose={() => setBuildUpdateOpen(false)}
        />
      )}

      {dailyContentPackOpen && activeProject && (
        <DailyContentPackModal
          project={activeProject}
          onClose={() => setDailyContentPackOpen(false)}
        />
      )}
    </div>
  );
}

export default LaunchStudio;
