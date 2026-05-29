import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { ProjectMemory } from '../../types/memphant-types';
import { copyExportToClipboard } from '../../services/tauriActions';
import { generateDailyContentPack } from '../../utils/dailyContentPackGenerator';
import { SocialBridgeActions } from './SocialBridgeActions';

interface DailyContentPackModalProps {
  project: ProjectMemory;
  onClose: () => void;
}

export function DailyContentPackModal({ project, onClose }: DailyContentPackModalProps) {
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pack = generateDailyContentPack(project);

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
      await copyExportToClipboard(pack.markdown, 'daily-content-pack');
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
      aria-label="Daily Content Pack"
    >
      <section className="export-preview-modal daily-content-pack-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-preview-modal__header">
          <div>
            <h2>Daily Content Pack</h2>
            <p>
              Copy-ready daily content ideas generated locally from this project context.
            </p>
          </div>
          <button
            type="button"
            className="export-preview-modal__close"
            onClick={onClose}
            aria-label="Close Daily Content Pack"
            title="Close"
          >
            x
          </button>
        </div>

        <div className="daily-content-pack-sections" aria-label="Daily Content Pack sections">
          {pack.sections.map((section) => (
            <article className="daily-content-pack-section" key={section.id}>
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
          className="export-preview-textarea daily-content-pack-textarea"
          readOnly
          value={pack.markdown}
          aria-label="Daily Content Pack export text"
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
            {copied ? 'Copied Daily Content Pack' : 'Copy Daily Content Pack'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default DailyContentPackModal;
