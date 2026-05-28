import { useState } from 'react';
import { useActiveProject } from '../../hooks/useActiveProject';
import { LaunchPassportModal } from '../Workspace/LaunchPassportModal';
import { BuildUpdateModal } from '../Workspace/BuildUpdateModal';
import { DailyContentPackModal } from './DailyContentPackModal';

export function LaunchStudio() {
  const activeProject = useActiveProject();
  const [launchPassportOpen, setLaunchPassportOpen] = useState(false);
  const [buildUpdateOpen, setBuildUpdateOpen] = useState(false);
  const [dailyContentPackOpen, setDailyContentPackOpen] = useState(false);

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
          <section className="launch-studio__grid" aria-label="Launch Studio tools">
            <article className="launch-studio-card">
              <div>
                <h2>Launch Passport</h2>
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
                <small>Launch posts, demo outline, and checklist</small>
              </button>
            </article>

            <article className="launch-studio-card">
              <div>
                <h2>Build Update</h2>
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
                <small>Progress posts, release notes, and feedback requests</small>
              </button>
            </article>

            <article className="launch-studio-card">
              <div>
                <h2>Daily Content Pack</h2>
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
                <small>X, LinkedIn, Reddit, meme idea, replies, demo caption</small>
              </button>
            </article>
          </section>
        )}
      </main>

      {launchPassportOpen && activeProject && (
        <LaunchPassportModal
          project={activeProject}
          onClose={() => setLaunchPassportOpen(false)}
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
