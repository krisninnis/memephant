import { useState } from 'react';
import { useActiveProject } from '../../hooks/useActiveProject';
import { LaunchPassportModal } from '../Workspace/LaunchPassportModal';
import { BuildUpdateModal } from '../Workspace/BuildUpdateModal';
import { ContentReadinessModal } from './ContentReadinessModal';
import { DailyContentPackModal } from './DailyContentPackModal';

export function LaunchStudio() {
  const activeProject = useActiveProject();
  const [launchPassportOpen, setLaunchPassportOpen] = useState(false);
  const [buildUpdateOpen, setBuildUpdateOpen] = useState(false);
  const [dailyContentPackOpen, setDailyContentPackOpen] = useState(false);
  const [contentReadinessOpen, setContentReadinessOpen] = useState(false);

  return (
    <div className="workspace-scroll">
      <main className="launch-studio" aria-labelledby="launch-studio-title">
        <header className="launch-studio__header">
          <div>
            <p className="launch-studio__eyebrow">Launch and distribution</p>
            <h1 id="launch-studio-title">Launch Studio</h1>
            <p>
              Turn this project context into launch posts, build updates, demo scripts,
              and feedback requests.
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
          <div className="launch-studio-workflow" aria-label="Launch Studio workflow">
            <section className="launch-studio-step launch-studio-step--prepare" aria-labelledby="launch-studio-prepare">
              <div className="launch-studio-step__header">
                <span>Step 1</span>
                <div>
                  <h2 id="launch-studio-prepare">Improve clarity</h2>
                  <p>Make sure the project is easy to explain before generating public copy.</p>
                </div>
              </div>
              <article className="launch-studio-card">
                <div>
                  <h3>Content Readiness</h3>
                  <p>
                    Check whether the project has enough plain context to generate useful
                    launch and social content.
                  </p>
                </div>
                <button
                  type="button"
                  className="content-readiness-btn"
                  onClick={() => setContentReadinessOpen(true)}
                  title="Evaluate content readiness from local project context"
                >
                  <span>Check Content Readiness</span>
                  <small>Score, weak areas, missing basics, suggestions</small>
                </button>
              </article>
            </section>

            <section className="launch-studio-step" aria-labelledby="launch-studio-generate">
              <div className="launch-studio-step__header">
                <span>Step 2</span>
                <div>
                  <h2 id="launch-studio-generate">Generate content</h2>
                  <p>Choose the kind of public communication you need right now.</p>
                </div>
              </div>
              <div className="launch-studio__grid" aria-label="Launch Studio content generators">
                <article className="launch-studio-card">
                  <div>
                    <h3>Launch Passport</h3>
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
                    <span>Generate Launch Passport</span>
                    <small>How do I launch this project?</small>
                  </button>
                </article>

                <article className="launch-studio-card">
                  <div>
                    <h3>Build Update</h3>
                    <p>
                      Draft progress posts, release notes, feedback asks, and short
                      update captions grounded in the current project state.
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

                <article className="launch-studio-card">
                  <div>
                    <h3>Daily Content Pack</h3>
                    <p>
                      Generate today&apos;s copy-ready social ideas from current context,
                      recent progress, goals, workflow mode, and next steps.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="daily-content-pack-btn"
                    onClick={() => setDailyContentPackOpen(true)}
                    title="Generate a local daily content pack from this project context"
                  >
                    <span>Generate Daily Content Pack</span>
                    <small>What can I post today?</small>
                  </button>
                </article>
              </div>
            </section>

            <section className="launch-studio-step launch-studio-step--share" aria-labelledby="launch-studio-share">
              <div className="launch-studio-step__header">
                <span>Step 3</span>
                <div>
                  <h2 id="launch-studio-share">Share safely</h2>
                  <p>Open selected generated sections in social composers for manual review.</p>
                </div>
              </div>
              <article className="launch-studio-card launch-studio-card--info">
                <div>
                  <h3>Social Bridge</h3>
                  <p>
                    Share buttons appear beside each generated section in Launch Passport,
                    Build Update, and Daily Content Pack.
                  </p>
                </div>
                <div className="social-bridge-card-note">
                  <p>Generate content first, then choose the section you want to share.</p>
                  <p>Preview before posting. Memephant never posts automatically.</p>
                </div>
              </article>
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
