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

        <div className="build-update-sections" aria-label="Build Update sections">
          {update.sections.map((section) => (
            <article className="build-update-section" key={section.id}>
              <div>
                <h3>{section.title}</h3>
                <span>{section.bestFor}</span>
              </div>
              <p>{section.content}</p>
              <SocialBridgeActions content={section.content} />
            </article>
          ))}
        </div>

        <textarea
          className="export-preview-textarea build-update-textarea"
          readOnly
          value={update.markdown}
          aria-label="Build Update export text"
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
            {copied ? 'Copied Build Update' : 'Copy Build Update'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default BuildUpdateModal;
