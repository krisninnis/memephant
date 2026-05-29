import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { ProjectMemory } from '../../types/memphant-types';
import { copyExportToClipboard } from '../../services/tauriActions';
import { generateLaunchPassport } from '../../utils/launchPassportGenerator';
import { SocialBridgeActions } from '../LaunchStudio/SocialBridgeActions';

interface LaunchPassportModalProps {
  project: ProjectMemory;
  onClose: () => void;
}

export function LaunchPassportModal({ project, onClose }: LaunchPassportModalProps) {
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
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
      await copyExportToClipboard(passport.markdown, 'launch-passport');
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
      aria-label="Launch Kit"
    >
      <section className="export-preview-modal launch-passport-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-preview-modal__header">
          <div>
            <h2>Launch Kit</h2>
            <p>
              Reusable launch assets generated from this project context. Context Passport is for
              AI handoff; Launch Kit is for explaining and sharing the project.
            </p>
          </div>
          <button
            type="button"
            className="export-preview-modal__close"
            onClick={onClose}
            aria-label="Close Launch Kit"
            title="Close"
          >
            x
          </button>
        </div>

        <div className="export-preview-modal__body">
          <div className="launch-passport-sections" aria-label="Launch Kit sections">
            {passport.sections.map((section) => {
              const canToggle = section.content.length > 220;
              const expanded = expandedSections[section.id] ?? false;

              return (
                <article className="launch-passport-section" key={section.id}>
                  <h3>{section.title}</h3>
                  <p className={!expanded && canToggle ? 'launch-studio-preview-text--collapsed' : undefined}>
                    {section.content}
                  </p>
                  {canToggle && (
                    <button
                      type="button"
                      className="launch-studio-section-toggle"
                      onClick={() => setExpandedSections((current) => ({
                        ...current,
                        [section.id]: !expanded,
                      }))}
                    >
                      {expanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                  <SocialBridgeActions content={section.content} />
                </article>
              );
            })}
          </div>

          <textarea
            className="export-preview-textarea launch-passport-textarea"
            readOnly
            value={passport.markdown}
            aria-label="Launch Kit export text"
          />
        </div>

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
            {copied ? 'Copied Launch Kit' : 'Copy Launch Kit'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default LaunchPassportModal;
