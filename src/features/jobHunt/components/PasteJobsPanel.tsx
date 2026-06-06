import { useState } from 'react';

type Props = {
  onImport: (text: string) => number;
  lastImportCount: number;
};

export function PasteJobsPanel({ onImport, lastImportCount }: Props) {
  const [pastedText, setPastedText] = useState('');
  const [feedback, setFeedback] = useState('');

  const handleImport = () => {
    if (!pastedText.trim()) {
      setFeedback('Paste a job list first.');
      return;
    }
    const count = onImport(pastedText);
    if (count > 0) {
      setPastedText('');
      setFeedback(`${count} ${count === 1 ? 'job' : 'jobs'} added.`);
      return;
    }
    setFeedback('No jobs were detected. Try pasting a numbered or bulleted list.');
  };

  return (
    <section className="job-hunt-card" aria-label="Paste Jobs">
      <div className="job-hunt-card__header">
        <div>
          <div className="field-label">Paste Jobs</div>
          <h2>Import a ChatGPT job list</h2>
        </div>
      </div>

      <textarea
        className="field-textarea job-hunt-paste"
        value={pastedText}
        onChange={(event) => setPastedText(event.target.value)}
        placeholder="Paste numbered or bulleted job suggestions here..."
      />

      <div className="job-hunt-card__actions">
        <button
          type="button"
          className="github-scan-btn"
          onClick={handleImport}
        >
          Import jobs
        </button>
        {(feedback || lastImportCount > 0) && (
          <span className="job-hunt-import-count">
            {feedback || `${lastImportCount} ${lastImportCount === 1 ? 'job' : 'jobs'} added`}
          </span>
        )}
      </div>
    </section>
  );
}
