import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { ProjectMemory } from '../../types/memphant-types';
import {
  compareCurrentProjectToExport,
  getChangesSinceExport,
  getExportHistory,
} from '../../utils/exportHistory';
import { getPlatformConfig } from '../../utils/platformRegistry';
import { getWorkflowModeConfig } from '../../utils/workflowModes';

interface ExportHistoryModalProps {
  project: ProjectMemory;
  onClose: () => void;
}

function formatHistoryTime(isoString: string): string {
  return new Date(isoString).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function platformName(platform: string): string {
  if (platform === 'launch-passport') return 'Launch Kit';
  if (platform === 'build-update') return 'Build Update';
  if (platform === 'daily-content-pack') return 'Daily Content Pack';
  if (platform === 'context-passport') return 'Context Passport';
  return getPlatformConfig(platform).name;
}

export function ExportHistoryModal({ project, onClose }: ExportHistoryModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const history = useMemo(() => getExportHistory(project), [project]);
  const [selectedId, setSelectedId] = useState(history[0]?.id ?? '');
  const selected = history.find((item) => item.id === selectedId) ?? history[0];
  const comparisons = selected ? compareCurrentProjectToExport(project, selected.checkpoint) : [];
  const changedComparisons = comparisons.filter((item) => item.changed);
  const changesSince = selected ? getChangesSinceExport(project, selected.checkpoint) : [];
  const lastPlatform = selected ? platformName(selected.platform) : 'AI';
  const currentWorkflowMode = getWorkflowModeConfig(project.workflowMode)?.label ?? 'Not set';

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleOverlayClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <div
      className="export-preview-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Export History"
    >
      <section className="export-preview-modal export-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-preview-modal__header">
          <div>
            <h2>Export History</h2>
            <p>
              See what each AI last received and what changed since. Stored locally from export
              checkpoints.
            </p>
          </div>
          <button
            type="button"
            className="export-preview-modal__close"
            onClick={onClose}
            aria-label="Close Export History"
            title="Close"
          >
            x
          </button>
        </div>

        {history.length === 0 ? (
          <div className="export-history-empty">
            <strong>No exports yet.</strong>
            <span>Copy a Context Passport or platform export to create the first checkpoint.</span>
          </div>
        ) : (
          <>
            <div className="export-history-current">
              <span>Last exported to {lastPlatform}: {formatHistoryTime(selected.timestamp)}</span>
              <span>Workflow Mode: {currentWorkflowMode}</span>
            </div>

            <div className="export-history-layout">
              <div className="export-history-list" aria-label="Export history list">
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`export-history-item${item.id === selected.id ? ' export-history-item--active' : ''}`}
                    onClick={() => setSelectedId(item.id)}
                    aria-pressed={item.id === selected.id}
                  >
                    <strong>{platformName(item.platform)} export</strong>
                    <span>{formatHistoryTime(item.timestamp)}</span>
                    <small>{item.exportType} · Workflow: {item.workflowModeLabel}</small>
                  </button>
                ))}
              </div>

              <div className="export-history-compare">
                <section className="export-history-card">
                  <h3>What changed since this export?</h3>
                  {changesSince.length > 0 ? (
                    <ul>
                      {changesSince.map((change) => (
                        <li key={change}>{change}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No logged changes since this export.</p>
                  )}
                </section>

                <section className="export-history-card">
                  <h3>Compare current project to exported snapshot</h3>
                  {changedComparisons.length > 0 ? (
                    <div className="export-history-diffs">
                      {changedComparisons.map((item) => (
                        <article key={item.field}>
                          <strong>{item.label}</strong>
                          <p><span>Then:</span> {item.before}</p>
                          <p><span>Now:</span> {item.after}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p>Current project state matches this export for the tracked fields.</p>
                  )}
                </section>
              </div>
            </div>
          </>
        )}

        <div className="export-preview-actions">
          <button
            type="button"
            className="export-preview-actions__primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}

export default ExportHistoryModal;
