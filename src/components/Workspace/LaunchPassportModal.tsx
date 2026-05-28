import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { ProjectMemory } from '../../types/memphant-types';
import { generateLaunchPassport } from '../../utils/launchPassportGenerator';

interface LaunchPassportModalProps {
  project: ProjectMemory;
  onClose: () => void;
}

export function LaunchPassportModal({ project, onClose }: LaunchPassportModalProps) {
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const passport = generateLaunchPassport(project);

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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(passport.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="export-preview-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Launch Passport"
    >
      <section className="export-preview-modal launch-passport-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-preview-modal__header">
          <div>
            <h2>Launch Passport</h2>
            <p>
              Reusable launch assets generated from this project context. Context Passport is for
              AI handoff; Launch Passport is for explaining and sharing the project.
            </p>
          </div>
          <button
            type="button"
            className="export-preview-modal__close"
            onClick={onClose}
            aria-label="Close Launch Passport"
            title="Close"
          >
            x
          </button>
        </div>

        <div className="launch-passport-sections" aria-label="Launch Passport sections">
          {passport.sections.map((section) => (
            <article className="launch-passport-section" key={section.id}>
              <h3>{section.title}</h3>
              <p>{section.content}</p>
            </article>
          ))}
        </div>

        <textarea
          className="export-preview-textarea launch-passport-textarea"
          readOnly
          value={passport.markdown}
          aria-label="Launch Passport export text"
        />

        <div className="export-preview-actions">
          <button
            type="button"
            className="export-preview-actions__secondary"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="export-preview-actions__primary"
            onClick={() => void handleCopy()}
          >
            {copied ? 'Copied Launch Passport' : 'Copy Launch Passport'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default LaunchPassportModal;
