import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { ProjectMemory } from '../../types/memphant-types';
import { copyExportToClipboard } from '../../services/tauriActions';
import { generateBuildUpdate } from '../../utils/buildUpdateGenerator';
import { SocialBridgeActions } from '../LaunchStudio/SocialBridgeActions';

interface BuildUpdateModalProps {
  project: ProjectMemory;
  onClose: () => void;
}

export function BuildUpdateModal({ project, onClose }: BuildUpdateModalProps) {
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const overlayRef = useRef<HTMLDivElement>(null);
  const update = generateBuildUpdate(project);

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
      await copyExportToClipboard(update.markdown, 'build-update');
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
      aria-label="Build Update"
    >
      <section className="export-preview-modal build-update-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-preview-modal__header">
          <div>
            <h2>Build Update</h2>
            <p>
              Ongoing progress posts generated from this project context. Review before sharing.
            </p>
          </div>
          <button
            type="button"
            className="export-preview-modal__close"
            onClick={onClose}
            aria-label="Close Build Update"
            title="Close"
          >
            x
          </button>
        </div>

        <div className="export-preview-modal__body">
          <div className="build-update-sections" aria-label="Build Update sections">
            {update.sections.map((section) => {
              const canToggle = section.content.length > 220;
              const expanded = expandedSections[section.id] ?? false;

              return (
                <article className="launch-studio-generated-card build-update-section" key={section.id}>
                  <div className="launch-studio-generated-card__header">
                    <h3>{section.title}</h3>
                    <span>{section.bestFor}</span>
                  </div>
                  <p className={`launch-studio-generated-card__content${!expanded && canToggle ? ' launch-studio-preview-text--collapsed' : ''}`}>
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
                  <SocialBridgeActions
                    content={section.content}
                    disabled={!section.shareable}
                    disabledReason={section.shareDisabledReason}
                  />
                </article>
              );
            })}
          </div>

          <textarea
            className="export-preview-textarea build-update-textarea"
            readOnly
            value={update.markdown}
            aria-label="Build Update export text"
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
            {copied ? 'Copied Build Update' : 'Copy Build Update'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default BuildUpdateModal;
