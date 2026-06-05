import type { JobApplicationStatus, JobItem } from '../types';

const STATUS_OPTIONS: Array<{ value: JobApplicationStatus; label: string }> = [
  { value: 'not_applied', label: 'Not applied' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'applied', label: 'Applied' },
  { value: 'follow_up', label: 'Follow up' },
  { value: 'interview', label: 'Interview' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'offer', label: 'Offer' },
];

type Props = {
  jobs: JobItem[];
  selectedJobId: string | null;
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: JobApplicationStatus) => void;
  onNotesChange: (id: string, notes: string) => void;
  onDelete: (id: string) => void;
};

export function JobTrackerList({
  jobs,
  selectedJobId,
  onSelect,
  onStatusChange,
  onNotesChange,
  onDelete,
}: Props) {
  return (
    <section className="job-hunt-card job-hunt-card--tracker" aria-label="Job Tracker">
      <div className="job-hunt-card__header">
        <div>
          <div className="field-label">Job Tracker</div>
          <h2>{jobs.length} {jobs.length === 1 ? 'role' : 'roles'}</h2>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="job-hunt-empty">
          <strong>No jobs imported yet.</strong>
          <p>Paste a ChatGPT-generated list above to create local job cards.</p>
        </div>
      ) : (
        <div className="job-hunt-job-list">
          {jobs.map((job) => (
            <article
              key={job.id}
              className={`job-hunt-job-card${selectedJobId === job.id ? ' job-hunt-job-card--active' : ''}`}
            >
              <button
                type="button"
                className="job-hunt-job-card__select"
                onClick={() => onSelect(job.id)}
              >
                <strong>{job.title || 'Untitled role'}</strong>
                <span>{job.company || 'Company not detected'}</span>
              </button>

              <div className="job-hunt-job-card__meta">
                {job.location && <span>{job.location}</span>}
                <span>{job.remoteType ?? 'unknown'}</span>
                {job.salary && <span>{job.salary}</span>}
                <span>Fit: {job.fitScore ?? 'unknown'}</span>
              </div>

              {job.url && (
                <a href={job.url} target="_blank" rel="noreferrer" className="job-hunt-job-card__link">
                  Open job link
                </a>
              )}

              <div className="job-hunt-job-card__controls">
                <label>
                  Status
                  <select
                    className="field-input"
                    value={job.status}
                    onChange={(event) => onStatusChange(job.id, event.target.value as JobApplicationStatus)}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Notes
                  <textarea
                    className="field-textarea"
                    value={job.notes ?? ''}
                    onChange={(event) => onNotesChange(job.id, event.target.value)}
                    placeholder="Application notes"
                  />
                </label>
              </div>

              <button
                type="button"
                className="memory-cleanup-preview__ghost-btn"
                onClick={() => onDelete(job.id)}
              >
                Delete job
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
