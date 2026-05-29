import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
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

const HELPER_QUESTIONS = [
  {
    id: 'who',
    label: 'Who is this for?',
    example: 'Freelancers managing client work.',
    why: 'This helps launch posts speak to a real person instead of sounding generic.',
  },
  {
    id: 'problem',
    label: 'What frustrating problem does it solve?',
    example: 'Rebuilding project context every time I switch AI tools.',
    why: 'This gives posts a clear reason for someone to care.',
  },
  {
    id: 'outcome',
    label: 'What happens after using it?',
    example: 'Continue work instantly without re-explaining everything.',
    why: 'This helps generated copy explain what gets better.',
  },
  {
    id: 'different',
    label: 'Why is it different?',
    example: 'Local-first and works across multiple AI tools.',
    why: 'This helps launch content say why this project is worth noticing.',
  },
] as const;

type HelperQuestionId = typeof HELPER_QUESTIONS[number]['id'];
type HelperAnswers = Record<HelperQuestionId, string>;

const EMPTY_HELPER_ANSWERS: HelperAnswers = {
  who: '',
  problem: '',
  outcome: '',
  different: '',
};

export function ContentReadinessModal({ project, onClose }: ContentReadinessModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const report = useMemo(() => evaluateContentReadiness(project), [project]);
  const [helperAnswers, setHelperAnswers] = useState<HelperAnswers>(EMPTY_HELPER_ANSWERS);

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

  const handleUseExampleTemplate = () => {
    setHelperAnswers(Object.fromEntries(
      HELPER_QUESTIONS.map((question) => [question.id, question.example]),
    ) as HelperAnswers);
  };

  return (
    <div
      className="export-preview-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Project Clarity"
    >
      <section className="export-preview-modal content-readiness-modal" onClick={(e) => e.stopPropagation()}>
        <div className="export-preview-modal__header">
          <div>
            <h2>Project Clarity</h2>
            <p>
              A local check for whether this project has enough plain context to produce useful launch content.
            </p>
          </div>
          <button
            type="button"
            className="export-preview-modal__close"
            onClick={onClose}
            aria-label="Close Project Clarity"
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

        <section className="content-readiness-helper" aria-label="Improve Launch Content">
          <div className="content-readiness-helper__header">
            <div>
              <h3>Improve Launch Content</h3>
              <p>
                Better summaries create better launch posts. Clearer answers here make generated posts,
                demo captions, and feedback questions sound more specific.
              </p>
            </div>
            <button
              type="button"
              className="content-readiness-helper__template"
              onClick={handleUseExampleTemplate}
            >
              Use Example Template
            </button>
          </div>

          <div className="content-readiness-helper__fields">
            {HELPER_QUESTIONS.map((question) => (
              <label className="content-readiness-helper__field" key={question.id}>
                <span>{question.label}</span>
                <textarea
                  value={helperAnswers[question.id]}
                  onChange={(event) => setHelperAnswers({
                    ...helperAnswers,
                    [question.id]: event.target.value,
                  })}
                  rows={2}
                />
                <small>Example: {question.example}</small>
                <em>{question.why}</em>
              </label>
            ))}
          </div>
        </section>

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
            <h3>Missing basics</h3>
            {listItems(report.missingSignals, 'No missing signals detected.')}
          </section>
        </div>

        <div className="content-readiness-signals" aria-label="Project clarity signal details">
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
