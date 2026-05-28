import { useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import type { ProjectMemory } from '../../types/memphant-types';
import { evaluateContentReadiness } from '../../utils/contentReadiness';

interface ContentReadinessModalProps {
  project: ProjectMemory;
  onClose: () => void;
}

function listItems(items: string[], emptyText: string) {
  if (items.length === 0) {
    return <p className="content-readiness-empty">{emptyText}</p>;
  }

  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function ContentReadinessModal({ project, onClose }: ContentReadinessModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const report = useMemo(() => evaluateContentReadiness(project), [project]);

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
      aria-label="Content Readiness"
    >
      <section className="export-preview-modal content-readiness-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-preview-modal__header">
          <div>
            <h2>Content Readiness</h2>
            <p>
              Deterministic checks for whether this project context can produce useful launch content.
            </p>
          </div>
          <button
            type="button"
            className="export-preview-modal__close"
            onClick={onClose}
            aria-label="Close Content Readiness"
            title="Close"
          >
            x
          </button>
        </div>

        <div className="content-readiness-score" aria-label="Overall readiness score">
          <strong>{report.score}</strong>
          <span>/100</span>
        </div>

        {report.warning && (
          <p className="content-readiness-warning">{report.warning}</p>
        )}

        <div className="content-readiness-grid">
          <section>
            <h3>Strengths</h3>
            {listItems(report.strengths, 'No strong positioning signals yet.')}
          </section>

          <section>
            <h3>Weak areas</h3>
            {listItems(report.weakAreas, 'No weak areas detected.')}
          </section>

          <section>
            <h3>Suggested improvements</h3>
            {listItems(report.suggestedImprovements, 'No suggestions right now.')}
          </section>

          <section>
            <h3>Missing positioning signals</h3>
            {listItems(report.missingSignals, 'No missing signals detected.')}
          </section>
        </div>

        <div className="content-readiness-signals" aria-label="Content readiness signal details">
          {report.signals.map((signal) => (
            <article className={`content-readiness-signal content-readiness-signal--${signal.status}`} key={signal.id}>
              <div>
                <h3>{signal.label}</h3>
                <span>{signal.score}/10</span>
              </div>
              <p>{signal.evidence}</p>
            </article>
          ))}
        </div>

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

export default ContentReadinessModal;
