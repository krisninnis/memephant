import { useEffect, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useActiveProject } from '../../hooks/useActiveProject';
import {
  isDesktopApp,
  linkFolder,
  rescanLinkedFolder,
  exportActiveProjectAsMarkdown,
  exportActiveProjectAsJson,
  generateStateManifest,
  syncGitCommits,
  type StateManifestPreview,
} from '../../services/tauriActions';
import ExportButtons from './ExportButtons';
import TaskField from './TaskField';
import { compressPrompt, splitPrompt } from '../../utils/promptUtils';

/** The prompt users paste into their AI to activate the memphant_update protocol */
const ACTIVATION_PROMPT = `After every response, please include a project update block at the end so I can sync your changes back to my Memephant app:

memphant_update
\`\`\`json
{
  "schemaVersion": "1.1.0",
  "currentState": "what is true right now after your work",
  "lastSessionSummary": "2-4 sentence recap of what just happened",
  "inProgress": ["what you are actively working on right now"],
  "nextSteps": ["immediate next actions after this session"],
  "openQuestion": "the single most important unresolved question",
  "goals": ["any new goals that emerged this session"],
  "decisions": [{"decision": "any new decisions", "rationale": "why"}]
}
\`\`\`

Only include fields that changed. Keep the JSON valid.
currentState and lastSessionSummary are always required.`;

type GitSyncState = 'idle' | 'syncing' | 'found' | 'up_to_date';
type PromptPreview = {
  mode: 'compress' | 'split';
  text: string;
  part2?: string;
};

const PROMPT_BRIDGE_EVENT = 'MEMEPHANT_QUEUE_COMPOSER_DRAFT';

function sanitizeBridgePrompt(text: string): string {
  return text
    .replace(/\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, '[REDACTED]')
    .replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[REDACTED]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, '[REDACTED]')
    .replace(/\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^"'\s]+/gi, '[REDACTED]')
    .replace(/\b[A-Z]:[\\/][^\s"'<>]+/g, '[local-path]')
    .replace(/(^|\s)\/Users\/[^\s"'<>]+/g, '$1[local-path]')
    .replace(/(^|\s)\/home\/[^\s"'<>]+/g, '$1[local-path]');
}

function hasBlockedUpdatePayload(text: string): boolean {
  return /\bmemphant_update\b/i.test(text);
}

export function ActionBar() {
  const activeProject = useActiveProject();
  const memoryBridgeMode = useProjectStore((s) => s.memoryBridgeMode);
  const preAiBackup = useProjectStore((s) => s.preAiBackup);
  const setPreAiBackup = useProjectStore((s) => s.setPreAiBackup);
  const updateProject = useProjectStore((s) => s.updateProject);
  const showToast = useProjectStore((s) => s.showToast);
  const currentTask = useProjectStore((s) => s.currentTask);

  const [activationCopied, setActivationCopied] = useState(false);
  const [gitSyncState, setGitSyncState] = useState<GitSyncState>('idle');
  const [gitSyncCount, setGitSyncCount] = useState(0);
  const [manifestPreview, setManifestPreview] = useState<StateManifestPreview | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [promptPreview, setPromptPreview] = useState<PromptPreview | null>(null);

  const desktopApp = isDesktopApp();

  const handleRollback = () => {
    if (!preAiBackup) {
      showToast('Nothing to undo.');
      return;
    }

    updateProject(preAiBackup.id, preAiBackup);
    setPreAiBackup(null);
    showToast('Last AI update rolled back.');
  };

  const handleCopyActivation = async () => {
    try {
      await navigator.clipboard.writeText(ACTIVATION_PROMPT);
      setActivationCopied(true);
      showToast('Copied - paste this into your AI at the start of a session');
      setTimeout(() => setActivationCopied(false), 3000);
    } catch {
      showToast('Could not copy to clipboard', 'error');
    }
  };

  const handleSyncGit = async () => {
    if (!desktopApp) {
      showToast('Git sync requires the desktop app.', 'info');
      return;
    }

    if (!activeProject?.id || !activeProject.linkedFolder?.path || gitSyncState === 'syncing') {
      return;
    }

    setGitSyncState('syncing');

    try {
      const commits = await syncGitCommits(activeProject.id);

      if (commits.length > 0) {
        setGitSyncCount(commits.length);
        setGitSyncState('found');
        showToast(
          `${commits.length} commit${commits.length === 1 ? '' : 's'} will be included in your next AI export`,
          'info',
        );

        window.setTimeout(() => {
          setGitSyncState('idle');
          setGitSyncCount(0);
        }, 3000);

        return;
      }

      setGitSyncState('up_to_date');
      window.setTimeout(() => {
        setGitSyncState('idle');
      }, 2000);
    } catch {
      setGitSyncState('idle');
      showToast('Could not sync Git commits', 'error');
    }
  };

  const handlePreviewManifest = async () => {
    if (!activeProject || manifestLoading) return;

    setManifestLoading(true);
    setManifestError(null);

    try {
      const preview = await generateStateManifest(activeProject);
      setManifestPreview(preview);
      showToast('Project snapshot ready.', 'info');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setManifestPreview(null);
      setManifestError(message || 'Could not prepare the full context preview.');
      showToast(message || 'Could not prepare the full context preview.', 'error');
    } finally {
      setManifestLoading(false);
    }
  };

  const handleCopyManifestText = async () => {
    if (!manifestPreview) return;

    try {
      await navigator.clipboard.writeText(manifestPreview.text);
      showToast('Copied with full context.', 'info');
    } catch {
      showToast('Could not copy the full context.', 'error');
    }
  };

  const handleCopyManifestDigest = async () => {
    if (!manifestPreview) return;

    try {
      await navigator.clipboard.writeText(manifestPreview.digest);
      showToast('Reference ID copied.', 'info');
    } catch {
      showToast('Could not copy the reference ID.', 'error');
    }
  };

  const handleCompress = async () => {
    if (!currentTask.trim()) return;
    if (hasBlockedUpdatePayload(currentTask)) {
      showToast('Composer drafts cannot include memphant_update blocks.', 'error');
      return;
    }

    const compressed = compressPrompt(currentTask);
    if (compressed === currentTask.trim()) {
      showToast('Nothing to compress', 'info');
      return;
    }
    setPromptPreview({ mode: 'compress', text: sanitizeBridgePrompt(compressed) });
    showToast('Compressed draft ready to preview.', 'info');
  };

  const handleCopyPromptPreview = async () => {
    if (!promptPreview) return;

    const text = promptPreview.part2
      ? `${promptPreview.text}\n\n--- Part 2 ---\n\n${promptPreview.part2}`
      : promptPreview.text;

    try {
      await navigator.clipboard.writeText(text);
      showToast('Preview copied to clipboard');
    } catch {
      showToast('Could not copy preview', 'error');
    }
  };

  const handleSplit = async () => {
    if (!currentTask.trim()) return;
    if (hasBlockedUpdatePayload(currentTask)) {
      showToast('Composer drafts cannot include memphant_update blocks.', 'error');
      return;
    }

    const [part1, part2] = splitPrompt(currentTask);
    if (!part2) {
      showToast('Prompt is too short to split', 'info');
      return;
    }
    setPromptPreview({
      mode: 'split',
      text: sanitizeBridgePrompt(part1),
      part2: sanitizeBridgePrompt(part2),
    });
    showToast('Split draft ready to preview.', 'info');
  };

  const handleSendPromptPreviewToComposer = () => {
    if (!promptPreview) return;

    const hasUpdateBlock =
      hasBlockedUpdatePayload(promptPreview.text) ||
      hasBlockedUpdatePayload(promptPreview.part2 ?? '');

    if (hasUpdateBlock) {
      showToast('Composer drafts cannot include memphant_update blocks.', 'error');
      return;
    }

    window.dispatchEvent(new CustomEvent(PROMPT_BRIDGE_EVENT, {
      detail: {
        source: 'memephant-app',
        type: PROMPT_BRIDGE_EVENT,
        payload: {
          mode: promptPreview.mode,
          text: promptPreview.text,
          part2: promptPreview.part2,
          createdAt: new Date().toISOString(),
        },
      },
    }));

    showToast(
      'Draft queued. Open the Memephant extension on your AI page and click Insert pending draft.',
      'info',
    );
  };

  useEffect(() => {
    setGitSyncState('idle');
    setGitSyncCount(0);
    setManifestPreview(null);
    setManifestError(null);
    setPromptPreview(null);
  }, [activeProject?.id]);

  if (!activeProject) {
    return (
      <div className="action-bar">
        <p className="action-bar__empty">Select or create a project to get started.</p>
      </div>
    );
  }

  const hasLinkedFolder = !!activeProject.linkedFolder?.path;
  const pendingGitCommits = activeProject.pendingGitCommits ?? [];

  let syncGitLabel = 'Sync Git';
  if (gitSyncState === 'syncing') syncGitLabel = 'Syncing...';
  if (gitSyncState === 'found') {
    syncGitLabel = `${gitSyncCount} new commit${gitSyncCount === 1 ? '' : 's'}`;
  }
  if (gitSyncState === 'up_to_date') syncGitLabel = 'Up to date';

  return (
    <div className="action-bar">
      <div className="action-bar__top-row">
        <ExportButtons />
      </div>

      {memoryBridgeMode === 'manual' && (
        <>
          <TaskField />

          {currentTask.trim() && (
            <div className="task-field__actions">
              <button
                type="button"
                className="task-field__action-btn"
                onClick={() => void handleCompress()}
                title="Strip filler words and shorten the prompt"
              >
                ✂️ Compress
              </button>
              <button
                type="button"
                className="task-field__action-btn"
                onClick={() => void handleSplit()}
                title="Split the prompt into two parts — Part 1 stays here, Part 2 is copied to clipboard"
              >
                ✂️ Split
              </button>
            </div>
          )}

          {promptPreview && (
            <div className="prompt-preview">
              <div className="prompt-preview__header">
                <div>
                  <div className="prompt-preview__title">
                    {promptPreview.mode === 'compress' ? 'Compressed draft' : 'Split preview'}
                  </div>
                  <div className="prompt-preview__subtitle">
                    Preview only. Nothing is sent to an AI automatically.
                  </div>
                </div>
                <button
                  type="button"
                  className="state-manifest-preview__close"
                  onClick={() => setPromptPreview(null)}
                  title="Close prompt preview"
                >
                  Close
                </button>
              </div>

              <label className="prompt-preview__label">
                {promptPreview.mode === 'split' ? 'Part 1' : 'Draft'}
              </label>
              <textarea
                className="prompt-preview__text"
                value={promptPreview.text}
                readOnly
                spellCheck={false}
              />

              {promptPreview.part2 && (
                <>
                  <label className="prompt-preview__label">Part 2</label>
                  <textarea
                    className="prompt-preview__text"
                    value={promptPreview.part2}
                    readOnly
                    spellCheck={false}
                  />
                </>
              )}

              <div className="prompt-preview__actions">
                <button
                  type="button"
                  className="action-bar__btn"
                  onClick={() => void handleCopyPromptPreview()}
                >
                  Copy
                </button>
                <button
                  type="button"
                  className="action-bar__btn"
                  onClick={handleSendPromptPreviewToComposer}
                >
                  Send to AI composer
                </button>
              </div>
            </div>
          )}

          {desktopApp && pendingGitCommits.length > 0 && (
        <div className="action-bar__git-note">
          {pendingGitCommits.length} commit{pendingGitCommits.length === 1 ? '' : 's'} will be included in your next AI export.
        </div>
      )}

      <div className="action-bar__secondary">
        <button
          type="button"
          className={`action-bar__btn action-bar__btn--activation${activationCopied ? ' action-bar__btn--copied' : ''}`}
          onClick={() => void handleCopyActivation()}
          title="Copy setup instructions so your AI can send updates back to Memephant"
        >
          {activationCopied ? 'Copied — paste into your AI' : 'Set up auto-updates'}
        </button>

        {desktopApp && (
          !hasLinkedFolder ? (
            <button
              type="button"
              className="action-bar__btn"
              onClick={() => void linkFolder()}
              title="Choose a local project folder so Memephant can scan files and track changes"
            >
              Select project folder
            </button>
          ) : (
            <button
              type="button"
              className="action-bar__btn"
              onClick={() => void rescanLinkedFolder()}
              title="Scan the linked project folder again for updated files"
            >
              Rescan linked folder
            </button>
          )
        )}

        {desktopApp && (
          <button
            type="button"
            className={`action-bar__btn${gitSyncState === 'found' ? ' action-bar__btn--success' : ''}`}
            onClick={() => void handleSyncGit()}
            disabled={!hasLinkedFolder || gitSyncState === 'syncing'}
            title={
              !hasLinkedFolder
                ? 'Link a project folder before reading recent Git commits'
                : 'Read recent Git commits from the linked project folder'
            }
          >
            {syncGitLabel}
          </button>
        )}

        {desktopApp && (
          <button
            type="button"
            className="action-bar__btn"
            onClick={() => void handlePreviewManifest()}
            disabled={manifestLoading}
            title="Preview the full project context before copying it"
          >
            {manifestLoading ? 'Preparing full context...' : 'Preview full context'}
          </button>
        )}

        <button
          type="button"
          className="action-bar__btn"
          onClick={() => void exportActiveProjectAsMarkdown()}
          title="Save a readable Markdown snapshot of this project"
        >
          Save as file
        </button>

        {!desktopApp && (
          <button
            type="button"
            className="action-bar__btn"
            onClick={() => void exportActiveProjectAsJson()}
            title="Download this project as a JSON backup file"
          >
            Export project JSON
          </button>
        )}

        {preAiBackup && (
          <button
            type="button"
            className="action-bar__btn action-bar__btn--undo"
            onClick={handleRollback}
            title="Restore the project to how it looked before the last AI update"
          >
            Undo last AI update
          </button>
        )}
          </div>
        </>
      )}

      {memoryBridgeMode === 'manual' && (manifestPreview || manifestError) && (
        <div className="state-manifest-preview">
          <div className="state-manifest-preview__header">
            <div>
              <div className="state-manifest-preview__title">Full context preview</div>
              <div className="state-manifest-preview__subtitle">
                Preview only. Normal AI export and import flows are unchanged.
              </div>
            </div>
            <button
              type="button"
              className="state-manifest-preview__close"
              onClick={() => {
                setManifestPreview(null);
                setManifestError(null);
              }}
              aria-label="Close full context preview"
              title="Close the full context preview"
            >
              Close
            </button>
          </div>

          {manifestError ? (
            <div className="state-manifest-preview__error">{manifestError}</div>
          ) : manifestPreview ? (
            <>
              <div className="state-manifest-preview__meta">
                <span>Reference ID: {manifestPreview.digest}</span>
                <span>{manifestPreview.item_count} item{manifestPreview.item_count === 1 ? '' : 's'}</span>
              </div>
              <textarea
                className="state-manifest-preview__text"
                value={manifestPreview.text}
                readOnly
                spellCheck={false}
                aria-label="Full context text"
                title="Read the full project context that will be copied"
              />
              <div className="state-manifest-preview__actions">
                <button
                  type="button"
                  className="action-bar__btn"
                  onClick={() => void handleCopyManifestText()}
                  title="Copy the full project context preview"
                >
                  Copy with full context
                </button>
                <button
                  type="button"
                  className="action-bar__btn"
                  onClick={() => void handleCopyManifestDigest()}
                  title="Copy the reference ID for this full context preview"
                >
                  Copy reference ID
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default ActionBar;
